"""Asset packs: an admin groups library files into a pack, publishes it, and schools get it.

Who may do what:
- admins: every route here except GET /packs/mine. Like the library, packs are platform-wide
  (decision D2), so these depend on require_admin and never call _school_scope.
- anyone signed in: GET /packs/mine, the packs their own school has switched on. This is the
  read path a teacher's catalogue and (later, P7) a student's editor use, because /library itself
  is admin-only.

A pack is a draft until it is published. Publishing builds a manifest -- one JSON file that lists
each file with its public URL -- and writes it to library/packs/<slug>/<revision>.json. The order
is the rule: write the manifest first, then bump published_revision. Reversed, the database would
point at a file that is not in the bucket yet. A manifest at a revision is never rewritten, so it
is cached forever like the files it names; editing the draft and publishing again makes a new
revision.

Which schools may use a pack is in admin.py (/admin/schools/{school}/packs), next to the other
per-school settings.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import storage
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, AssetPack, LibraryAsset, PackAsset, PackGrant
from .admin import require_admin
from .library import IMMUTABLE_CACHE_CONTROL

router = APIRouter(prefix="/packs", tags=["packs"])

_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,99}$")
PACK_KINDS = ("objects", "environments")
# what each kind of pack may hold: room shells go in environment packs, everything else in objects
_ALLOWED_ASSET_KINDS = {"objects": {"model", "image", "audio", "video"}, "environments": {"environment"}}
MANIFEST_CONTENT_TYPE = "application/json"


def manifest_key(slug: str, revision: int) -> str:
    return f"library/packs/{slug}/{revision}.json"


class PackCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    kind: str = Field("objects", max_length=30)


class PackPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)


class PackAssetsUpdate(BaseModel):
    # the whole ordered list; it replaces what the draft held
    asset_ids: list[uuid.UUID] = Field(max_length=500)


class PackResponse(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    kind: str
    # the draft's files, in order
    asset_ids: list[uuid.UUID]
    published_revision: int | None
    published_at: datetime | None
    # the published manifest's address, or None for a pack that was never published
    manifest_url: str | None
    # True when the draft differs from what was last published (or it was never published)
    unpublished_changes: bool
    created_at: datetime
    updated_at: datetime


class MyPackResponse(BaseModel):
    slug: str
    title: str
    description: str | None
    kind: str
    revision: int
    manifest_url: str
    item_count: int


def _manifest_url(pack: AssetPack) -> str | None:
    if pack.published_revision is None:
        return None
    try:
        return storage.public_url(manifest_key(pack.slug, pack.published_revision))
    except RuntimeError:
        return None


def _aware(moment: datetime) -> datetime:
    # SQLite (the tests) hands back naive datetimes; Postgres gives aware ones
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _describe(pack: AssetPack) -> PackResponse:
    return PackResponse(
        id=pack.id, slug=pack.slug, title=pack.title, description=pack.description, kind=pack.kind,
        asset_ids=[item.library_asset_id for item in pack.items],
        published_revision=pack.published_revision, published_at=pack.published_at,
        manifest_url=_manifest_url(pack),
        # updated_at moves on every draft edit (title, description, contents); publish sets both
        # to the same moment, so a later updated_at means work that is not published yet
        unpublished_changes=pack.published_at is None or _aware(pack.updated_at) > _aware(pack.published_at),
        created_at=pack.created_at, updated_at=pack.updated_at,
    )


def _get_pack(db: Session, slug: str) -> AssetPack:
    pack = db.scalar(select(AssetPack).where(AssetPack.slug == slug))
    if pack is None:
        raise HTTPException(status_code=404, detail="Pack not found")
    return pack


def _touch(pack: AssetPack) -> None:
    # a change to the pack's rows alone does not fire the column's onupdate, so stamp it here
    pack.updated_at = datetime.now(UTC)


def build_manifest(pack: AssetPack, revision: int, published_at: datetime) -> dict[str, object]:
    """The JSON a school's browser reads to know what this pack holds. Self-contained: every file
    has an absolute public URL, and its attribution travels with it so the licence survives."""
    assets = []
    for item in pack.items:
        asset = item.asset
        assets.append({
            "id": str(asset.id), "title": asset.title, "kind": asset.kind, "content_type": asset.content_type,
            "size_bytes": asset.size_bytes, "sha256": asset.content_sha256, "attribution": asset.attribution,
            "url": storage.public_url(asset.storage_key),
        })
    return {
        "slug": pack.slug, "revision": revision, "kind": pack.kind, "title": pack.title,
        "description": pack.description, "published_at": published_at.isoformat().replace("+00:00", "Z"),
        "assets": assets,
    }


@router.get("/mine", response_model=list[MyPackResponse])
def my_packs(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> list[MyPackResponse]:
    """The published packs the caller's own school has switched on."""
    rows = db.scalars(
        select(AssetPack)
        .join(PackGrant, PackGrant.pack_id == AssetPack.id)
        .where(
            PackGrant.organisation_id == actor.organisation_id,
            PackGrant.enabled.is_(True),
            AssetPack.published_revision.is_not(None),
        )
        .order_by(AssetPack.title)
    )
    mine = []
    for pack in rows:
        url = _manifest_url(pack)
        if url is None or pack.published_revision is None:
            continue  # the public prefix is not configured, so nobody could read it anyway
        mine.append(MyPackResponse(
            slug=pack.slug, title=pack.title, description=pack.description, kind=pack.kind,
            revision=pack.published_revision, manifest_url=url, item_count=len(pack.items),
        ))
    return mine


@router.get("", response_model=list[PackResponse])
def list_packs(actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> list[PackResponse]:
    return [_describe(pack) for pack in db.scalars(select(AssetPack).order_by(AssetPack.title))]


@router.post("", response_model=PackResponse, status_code=201)
def create_pack(body: PackCreate, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> PackResponse:
    if not _SLUG.match(body.slug):
        raise HTTPException(status_code=422, detail="A pack's short name may use only a-z, 0-9 and dashes")
    if body.kind not in PACK_KINDS:
        raise HTTPException(status_code=422, detail="A pack holds either objects or environments")
    if db.scalar(select(AssetPack.id).where(AssetPack.slug == body.slug)) is not None:
        raise HTTPException(status_code=409, detail="A pack with that short name already exists")
    pack = AssetPack(slug=body.slug, title=body.title, description=body.description, kind=body.kind, created_by_id=actor.id)
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return _describe(pack)


@router.get("/{slug}", response_model=PackResponse)
def get_pack(slug: str, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> PackResponse:
    return _describe(_get_pack(db, slug))


@router.patch("/{slug}", response_model=PackResponse)
def update_pack(
    slug: str, body: PackPatch, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> PackResponse:
    pack = _get_pack(db, slug)
    fields = body.model_fields_set
    if "title" in fields and body.title is not None:
        pack.title = body.title
    if "description" in fields:
        pack.description = body.description
    _touch(pack)
    db.commit()
    db.refresh(pack)
    return _describe(pack)


@router.put("/{slug}/assets", response_model=PackResponse)
def set_pack_assets(
    slug: str, body: PackAssetsUpdate, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> PackResponse:
    pack = _get_pack(db, slug)
    if len(set(body.asset_ids)) != len(body.asset_ids):
        raise HTTPException(status_code=422, detail="A file can be in a pack only once")
    found = {asset.id: asset for asset in db.scalars(select(LibraryAsset).where(LibraryAsset.id.in_(body.asset_ids)))}
    missing = [str(asset_id) for asset_id in body.asset_ids if asset_id not in found]
    if missing:
        raise HTTPException(status_code=422, detail=f"Not in the library: {', '.join(missing)}")
    allowed = _ALLOWED_ASSET_KINDS[pack.kind]
    wrong = [found[i].title for i in body.asset_ids if found[i].kind not in allowed]
    if wrong:
        raise HTTPException(status_code=422, detail=f"A pack of {pack.kind} cannot hold: {', '.join(wrong)}")
    not_ready = [found[i].title for i in body.asset_ids if found[i].status != "uploaded"]
    if not_ready:
        raise HTTPException(status_code=422, detail=f"Still uploading or failed: {', '.join(not_ready)}")
    # clear first and flush, so the new rows never collide with the old ones on the primary key
    pack.items.clear()
    db.flush()
    pack.items.extend(PackAsset(library_asset_id=asset_id, position=index) for index, asset_id in enumerate(body.asset_ids))
    _touch(pack)
    db.commit()
    db.refresh(pack)
    return _describe(pack)


@router.post("/{slug}/publish", response_model=PackResponse)
def publish_pack(slug: str, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> PackResponse:
    pack = _get_pack(db, slug)
    if not pack.items:
        raise HTTPException(status_code=422, detail="Add at least one file before publishing")
    revision = (pack.published_revision or 0) + 1
    published_at = datetime.now(UTC)
    try:
        manifest = build_manifest(pack, revision, published_at)
    except RuntimeError as error:  # S3_PUBLIC_BASE_URL unset: a manifest without URLs is useless
        raise HTTPException(status_code=503, detail="The public library address is not configured") from error
    # 1. the file first ...
    storage.put_object(
        manifest_key(pack.slug, revision), json.dumps(manifest, indent=2).encode("utf-8"),
        MANIFEST_CONTENT_TYPE, cache_control=IMMUTABLE_CACHE_CONTROL,
    )
    # 2. ... then the pointer to it
    pack.published_revision = revision
    pack.published_at = published_at
    pack.updated_at = published_at
    db.commit()
    db.refresh(pack)
    return _describe(pack)


@router.delete("/{slug}", status_code=204, response_model=None)
def delete_pack(slug: str, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    pack = _get_pack(db, slug)
    if pack.published_revision is not None:
        # a published manifest may already be in a school's catalogue or a saved project
        raise HTTPException(status_code=409, detail="A published pack cannot be deleted; switch it off for each school instead")
    db.delete(pack)
    db.commit()
    return Response(status_code=204)
