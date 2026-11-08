"""Media library routes: uploaded files (media_assets) and approved external links (media_links).

A project's media library is what an info card's media slot points at. The card stores only
an entry id; these routes turn that id into something playable.

Who may do what (app.access decides who can see a project at all):
- teachers and admins who can change the project upload files, add links and delete entries;
- teachers and admins who can see the project approve or send back links;
- everyone who can see the project lists and opens entries, but a student only ever sees
  uploaded files and approved links, never pending, failed or sent-back ones.

A project copied from a template (a student's copy) keeps the card's media ids, so entries
are shared across that family: a copy reads and lists its template's entries as well as its
own. Only the project that owns an entry can confirm, delete or review it. Revoking a link on
the template therefore reaches every copy at once.

Uploading is three calls: POST "" returns a presigned PUT URL, the browser PUTs the file to
storage, then POST "/{id}/confirm" checks what actually arrived and marks it uploaded.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import storage
from ..access import can_read, can_write
from ..auth import get_current_actor
from ..db import get_db
from ..media_policy import MEDIA_KIND_SPECS, LinkError, parse_media_link
from ..models import Actor, MediaAsset, MediaLink, Project

router = APIRouter(prefix="/projects/{project_id}/media", tags=["media"])

DOWNLOAD_URL_EXPIRES_IN = 900  # seconds; the client must not cache a URL longer than this
MAX_COMMENT_LENGTH = 500


class MediaUploadRequest(BaseModel):
    kind: str = Field(max_length=30)
    content_type: str = Field(max_length=100)
    size_bytes: int
    filename: str = Field(max_length=255)


class MediaUploadResponse(BaseModel):
    media_asset_id: uuid.UUID
    upload_url: str
    storage_key: str


class MediaLinkRequest(BaseModel):
    url: str = Field(max_length=2048)


class MediaApprovalRequest(BaseModel):
    approval: str = Field(max_length=20)  # 'approved' or 'rejected' (sent back)
    comment: str | None = Field(None, max_length=MAX_COMMENT_LENGTH)


class MediaEntryResponse(BaseModel):
    """One library entry, file or link, in one shape (overview section 6, MediaEntry)."""

    id: uuid.UUID
    project_id: uuid.UUID
    kind: str
    source: str  # 'file' or 'external'
    label: str  # what a picker shows: the uploaded file's name, or "YouTube video <id>"
    # file only
    status: str | None = None  # pending, uploaded or failed
    content_type: str | None = None
    size_bytes: int | None = None
    # external only
    provider: str | None = None
    provider_id: str | None = None
    url: str | None = None
    approval: str | None = None  # pending, approved or rejected
    approved_by_id: uuid.UUID | None = None
    approved_at: datetime | None = None
    review_comment: str | None = None
    # GET one only, and only for an uploaded file
    download_url: str | None = None
    download_expires_in: int | None = None
    created_at: datetime
    updated_at: datetime


def _is_staff(actor: Actor) -> bool:
    return actor.role in ("teacher", "admin")


def _load_project(db: Session, actor: Actor, project_id: uuid.UUID) -> Project:
    """404 for anything the caller cannot see, the same rule as the project routes."""
    project = db.get(Project, project_id)
    if project is None or not can_read(db, actor, project):
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _require_editor(actor: Actor, project: Project) -> None:
    if not _is_staff(actor) or not can_write(actor, project):
        raise HTTPException(status_code=403, detail="Only a teacher or admin who can change this project can do this")


def _visible(actor: Actor, entry: MediaAsset | MediaLink) -> bool:
    """Students see only what is ready to play."""
    if _is_staff(actor):
        return True
    if isinstance(entry, MediaAsset):
        return entry.status == "uploaded"
    return entry.approval == "approved"


def _file_entry(asset: MediaAsset) -> MediaEntryResponse:
    return MediaEntryResponse(
        id=asset.id, project_id=asset.project_id, kind=asset.kind, source="file",
        label=asset.storage_key.rsplit("/", 1)[-1],
        status=asset.status, content_type=asset.content_type, size_bytes=asset.size_bytes,
        created_at=asset.created_at, updated_at=asset.updated_at,
    )


def _link_entry(link: MediaLink) -> MediaEntryResponse:
    return MediaEntryResponse(
        id=link.id, project_id=link.project_id, kind=link.kind, source="external",
        label=f"YouTube video {link.provider_id}",
        provider=link.provider, provider_id=link.provider_id, url=link.url,
        approval=link.approval, approved_by_id=link.approved_by_id, approved_at=link.approved_at,
        review_comment=link.review_comment, created_at=link.created_at, updated_at=link.updated_at,
    )


def _family(project: Project) -> list[uuid.UUID]:
    """The project and, for a copy, the template it came from. Seeing the copy is what grants seeing these entries."""
    return [project.id] + ([project.template_id] if project.template_id else [])


def _find(db: Session, project: Project, media_id: uuid.UUID, own_only: bool = False) -> MediaAsset | MediaLink | None:
    allowed = [project.id] if own_only else _family(project)
    for model in (MediaAsset, MediaLink):
        entry = db.get(model, media_id)
        if entry is not None and entry.project_id in allowed:
            return entry
    return None


def _safe_filename(filename: str) -> str:
    """The stored name keeps letters, digits, dot, dash and underscore only; it is a label, never a path."""
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1])[-100:].lstrip(".")
    return cleaned or "file"


@router.get("", response_model=list[MediaEntryResponse])
def list_media(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> list[MediaEntryResponse]:
    project = _load_project(db, actor, project_id)
    family = _family(project)
    assets = db.scalars(select(MediaAsset).where(MediaAsset.project_id.in_(family), MediaAsset.kind.in_(list(MEDIA_KIND_SPECS))))
    links = db.scalars(select(MediaLink).where(MediaLink.project_id.in_(family)))
    entries = [_file_entry(a) for a in assets if _visible(actor, a)] + [_link_entry(l) for l in links if _visible(actor, l)]
    return sorted(entries, key=lambda entry: entry.created_at)


@router.post("", response_model=MediaUploadResponse, status_code=201)
def request_media_upload(
    project_id: uuid.UUID,
    body: MediaUploadRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> MediaUploadResponse:
    project = _load_project(db, actor, project_id)
    _require_editor(actor, project)
    spec = MEDIA_KIND_SPECS.get(body.kind)
    if spec is None:
        raise HTTPException(status_code=422, detail="Only images and videos can be uploaded here")
    if body.content_type not in spec["content_types"]:
        raise HTTPException(status_code=422, detail=f"That file type is not allowed for {body.kind}")
    if body.size_bytes <= 0:
        raise HTTPException(status_code=422, detail="The file is empty")
    if body.size_bytes > spec["max_bytes"]:
        raise HTTPException(status_code=413, detail="The file is too large")

    media_id = uuid.uuid4()
    storage_key = f"projects/{project.id}/media/{media_id}/{_safe_filename(body.filename)}"
    asset = MediaAsset(
        id=media_id, project_id=project.id, uploaded_by_id=actor.id, kind=body.kind,
        storage_key=storage_key, content_type=body.content_type, size_bytes=body.size_bytes, status="pending",
    )
    db.add(asset)
    db.commit()
    return MediaUploadResponse(
        media_asset_id=media_id,
        upload_url=storage.generate_presigned_upload_url(storage_key, body.content_type),
        storage_key=storage_key,
    )


@router.post("/{media_id}/confirm", response_model=MediaEntryResponse)
def confirm_media_upload(
    project_id: uuid.UUID, media_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> MediaEntryResponse:
    """Check what actually landed in storage, then mark the file uploaded or failed."""
    project = _load_project(db, actor, project_id)
    _require_editor(actor, project)
    asset = _find(db, project, media_id, own_only=True)
    if not isinstance(asset, MediaAsset):
        raise HTTPException(status_code=404, detail="Upload not found")
    if asset.status != "pending":
        return _file_entry(asset)
    found = storage.head_object(asset.storage_key)
    if found is None:
        raise HTTPException(status_code=409, detail="The file has not arrived in storage yet")
    size, content_type = found
    spec = MEDIA_KIND_SPECS[asset.kind]
    # the presigned PUT cannot enforce the size or type, so a mismatch is caught here
    if size != asset.size_bytes or size > spec["max_bytes"] or content_type != asset.content_type:
        asset.status = "failed"
        db.commit()
        storage.delete_object(asset.storage_key)
        raise HTTPException(status_code=422, detail="The uploaded file does not match what was requested")
    asset.status = "uploaded"
    db.commit()
    db.refresh(asset)
    return _file_entry(asset)


@router.get("/{media_id}", response_model=MediaEntryResponse)
def get_media(
    project_id: uuid.UUID, media_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> MediaEntryResponse:
    project = _load_project(db, actor, project_id)
    entry = _find(db, project, media_id)
    if entry is None or not _visible(actor, entry):
        raise HTTPException(status_code=404, detail="Media not found")
    if isinstance(entry, MediaLink):
        return _link_entry(entry)
    response = _file_entry(entry)
    if entry.status == "uploaded":
        response.download_url = storage.generate_presigned_download_url(entry.storage_key, DOWNLOAD_URL_EXPIRES_IN)
        response.download_expires_in = DOWNLOAD_URL_EXPIRES_IN
    return response


@router.delete("/{media_id}", status_code=204, response_model=None)
def delete_media(
    project_id: uuid.UUID, media_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> None:
    project = _load_project(db, actor, project_id)
    _require_editor(actor, project)
    entry = _find(db, project, media_id, own_only=True)
    if entry is None:
        raise HTTPException(status_code=404, detail="Media not found")
    storage_key = entry.storage_key if isinstance(entry, MediaAsset) else None
    db.delete(entry)
    db.commit()
    if storage_key is not None:
        storage.delete_object(storage_key)


@router.post("/links", response_model=MediaEntryResponse, status_code=201)
def add_media_link(
    project_id: uuid.UUID,
    body: MediaLinkRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> MediaEntryResponse:
    """Add an external link. It starts 'pending' and plays for students only once approved."""
    project = _load_project(db, actor, project_id)
    _require_editor(actor, project)
    try:
        parsed = parse_media_link(body.url)
    except LinkError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    existing = db.scalar(
        select(MediaLink).where(
            MediaLink.project_id == project.id,
            MediaLink.provider == parsed.provider,
            MediaLink.provider_id == parsed.provider_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="This video is already in the library")
    link = MediaLink(
        project_id=project.id, created_by_id=actor.id, kind=parsed.kind, provider=parsed.provider,
        provider_id=parsed.provider_id, url=parsed.canonical_url, approval="pending",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _link_entry(link)


@router.patch("/links/{link_id}", response_model=MediaEntryResponse)
def review_media_link(
    project_id: uuid.UUID,
    link_id: uuid.UUID,
    body: MediaApprovalRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> MediaEntryResponse:
    """Approve a link, or send it back with a comment. Any teacher or admin who can see the project may review."""
    project = _load_project(db, actor, project_id)
    if not _is_staff(actor):
        raise HTTPException(status_code=403, detail="Only a teacher or admin can review links")
    link = db.get(MediaLink, link_id)
    if link is None or link.project_id != project.id:
        raise HTTPException(status_code=404, detail="Link not found")
    if body.approval not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="approval must be 'approved' or 'rejected'")
    if body.comment is not None and len(body.comment) > MAX_COMMENT_LENGTH:
        raise HTTPException(status_code=422, detail="The comment is too long")
    link.approval = body.approval
    link.approved_by_id = actor.id
    link.approved_at = datetime.now(UTC)
    link.review_comment = body.comment
    db.commit()
    db.refresh(link)
    return _link_entry(link)
