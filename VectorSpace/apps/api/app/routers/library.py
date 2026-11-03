"""The shared asset library: files an admin curates once and every school's packs can draw on.

Who may do what: admins only, every route. These routes depend on require_admin and never call
_school_scope, on purpose (decision D3): library files and packs are platform-wide, so there is no
school to scope to, and any admin of any school may edit any entry. If an operator role ever
arrives it narrows this one dependency and nothing else.

Uploading is hash-first, because the key is the hash and that makes re-uploads free:
- POST "/tickets" takes the SHA-256 the browser computed. A file the library already holds comes
  back as 200 with the existing row and no upload URL. A new file gets a pending row and a
  presigned PUT for library/<sha256>/<filename>, as 201.
- the browser PUTs the bytes, sending the headers in upload_headers exactly;
- POST "/{id}/confirm" asks storage what really arrived and marks the row uploaded.

The hash is the client's claim until the bytes are in the bucket. Confirm re-checks the real size
and type; it cannot recompute the hash, because that would mean downloading the file. That is
acceptable here because only an admin can write to this prefix.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import storage
from ..db import get_db
from ..media_policy import GLB_ONLY_KINDS, LIBRARY_KIND_SPECS
from ..models import Actor, LibraryAsset
from .admin import require_admin
from .media import _safe_filename

router = APIRouter(prefix="/library", tags=["library"])

# Library objects never change (the key contains the hash of the bytes), so a CDN and every
# browser may keep them for a year. The upload must carry this header or it is not honest.
IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class LibraryTicketRequest(BaseModel):
    content_sha256: str
    filename: str = Field(min_length=1, max_length=255)
    kind: str
    content_type: str
    size_bytes: int
    title: str | None = Field(default=None, max_length=200)
    attribution: str | None = Field(default=None, max_length=500)


class LibraryPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    attribution: str | None = Field(default=None, max_length=500)
    visibility: str | None = None


class LibraryAssetResponse(BaseModel):
    id: uuid.UUID
    content_sha256: str
    storage_key: str
    kind: str
    content_type: str
    size_bytes: int
    filename: str
    title: str
    attribution: str | None
    visibility: str
    status: str
    # The public address, once the file is uploaded and the public prefix is configured.
    url: str | None = None
    created_at: datetime
    updated_at: datetime


class LibraryTicketResponse(BaseModel):
    asset: LibraryAssetResponse
    # Absent when the library already holds this file: there is nothing to upload.
    upload_url: str | None = None
    # The browser must send these headers with the PUT, byte for byte, or the signature fails.
    upload_headers: dict[str, str] | None = None


def _entry(asset: LibraryAsset) -> LibraryAssetResponse:
    url = None
    if asset.status == "uploaded" and asset.visibility == "public":
        try:
            url = storage.public_url(asset.storage_key)
        except RuntimeError:
            url = None  # the public prefix is not configured; a listing should still work
    return LibraryAssetResponse(
        id=asset.id, content_sha256=asset.content_sha256, storage_key=asset.storage_key, kind=asset.kind,
        content_type=asset.content_type, size_bytes=asset.size_bytes, filename=asset.filename, title=asset.title,
        attribution=asset.attribution, visibility=asset.visibility, status=asset.status, url=url,
        created_at=asset.created_at, updated_at=asset.updated_at,
    )


def _validate_request(body: LibraryTicketRequest) -> dict[str, object]:
    """The allowlist checks, shared by every path that can start an upload. Returns the kind's spec."""
    if not _SHA256.match(body.content_sha256):
        raise HTTPException(status_code=422, detail="content_sha256 must be 64 lowercase hex characters")
    spec = LIBRARY_KIND_SPECS.get(body.kind)
    if spec is None:
        raise HTTPException(status_code=422, detail="That kind cannot be added to the library")
    if body.content_type not in spec["content_types"]:
        raise HTTPException(status_code=422, detail=f"That file type is not allowed for {body.kind}")
    if body.kind in GLB_ONLY_KINDS and not body.filename.lower().endswith(".glb"):
        raise HTTPException(status_code=422, detail="Models must be single .glb files; .gltf is not accepted")
    if body.size_bytes <= 0:
        raise HTTPException(status_code=422, detail="The file is empty")
    if body.size_bytes > spec["max_bytes"]:
        raise HTTPException(status_code=413, detail="The file is too large")
    return spec


def _ticket(asset: LibraryAsset) -> LibraryTicketResponse:
    headers = {"Content-Type": asset.content_type, "Cache-Control": IMMUTABLE_CACHE_CONTROL}
    return LibraryTicketResponse(
        asset=_entry(asset),
        upload_url=storage.generate_presigned_upload_url(
            asset.storage_key, asset.content_type, cache_control=IMMUTABLE_CACHE_CONTROL
        ),
        upload_headers=headers,
    )


@router.post("/tickets", response_model=LibraryTicketResponse)
def request_library_ticket(
    body: LibraryTicketRequest,
    response: Response,
    actor: Actor = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LibraryTicketResponse:
    _validate_request(body)
    existing = db.scalar(select(LibraryAsset).where(LibraryAsset.content_sha256 == body.content_sha256))
    if existing is not None and existing.status == "uploaded":
        return LibraryTicketResponse(asset=_entry(existing))  # a dedup hit: 200, nothing to upload

    response.status_code = 201
    if existing is not None:
        # an earlier upload never finished or failed its check: let it try again under the same key
        existing.kind, existing.content_type, existing.size_bytes, existing.status = (
            body.kind, body.content_type, body.size_bytes, "pending",
        )
        db.commit()
        db.refresh(existing)
        return _ticket(existing)

    filename = _safe_filename(body.filename)
    asset = LibraryAsset(
        content_sha256=body.content_sha256,
        storage_key=f"library/{body.content_sha256}/{filename}",
        kind=body.kind, content_type=body.content_type, size_bytes=body.size_bytes,
        filename=filename, title=(body.title or filename.rsplit(".", 1)[0])[:200],
        attribution=body.attribution, visibility="public", status="pending", uploaded_by_id=actor.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _ticket(asset)


@router.post("/{asset_id}/confirm", response_model=LibraryAssetResponse)
def confirm_library_upload(
    asset_id: uuid.UUID, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> LibraryAssetResponse:
    """Check what actually landed in storage, then mark the file uploaded or failed."""
    asset = db.get(LibraryAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Library asset not found")
    if asset.status == "uploaded":
        return _entry(asset)
    found = storage.head_object(asset.storage_key)
    if found is None:
        raise HTTPException(status_code=409, detail="The file has not arrived in storage yet")
    size, content_type = found
    spec = LIBRARY_KIND_SPECS[asset.kind]
    # a presigned PUT cannot enforce size or type, so a mismatch is caught here
    if size != asset.size_bytes or size > spec["max_bytes"] or content_type != asset.content_type:
        asset.status = "failed"
        db.commit()
        storage.delete_object(asset.storage_key)
        raise HTTPException(status_code=422, detail="The uploaded file does not match what was requested")
    asset.status = "uploaded"
    db.commit()
    db.refresh(asset)
    return _entry(asset)


@router.get("", response_model=list[LibraryAssetResponse])
def list_library(
    kind: str | None = None, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> list[LibraryAssetResponse]:
    if kind is not None and kind not in LIBRARY_KIND_SPECS:
        raise HTTPException(status_code=422, detail="Unknown kind")
    query = select(LibraryAsset).order_by(LibraryAsset.created_at.desc())
    if kind is not None:
        query = query.where(LibraryAsset.kind == kind)
    return [_entry(asset) for asset in db.scalars(query)]


@router.patch("/{asset_id}", response_model=LibraryAssetResponse)
def update_library_asset(
    asset_id: uuid.UUID, body: LibraryPatch, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> LibraryAssetResponse:
    asset = db.get(LibraryAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Library asset not found")
    fields = body.model_fields_set
    if "visibility" in fields and body.visibility != asset.visibility:
        # 'signed' is reserved for the one asset that must not be public. Its bytes would still sit
        # under the public library/ prefix, so accepting it now would promise protection it cannot give.
        raise HTTPException(status_code=422, detail="Signed library assets are not supported yet")
    if "title" in fields and body.title is not None:
        asset.title = body.title
    if "attribution" in fields:
        asset.attribution = body.attribution
    db.commit()
    db.refresh(asset)
    return _entry(asset)


@router.delete("/{asset_id}", status_code=204, response_model=None)
def delete_library_asset(
    asset_id: uuid.UUID, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> None:
    asset = db.get(LibraryAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Library asset not found")
    # PR 3 adds the 409 here once packs exist: a published manifest outlives a deleted asset, so
    # an asset any pack references must be refused with a readable message.
    storage_key = asset.storage_key
    db.delete(asset)
    db.commit()
    storage.delete_object(storage_key)
