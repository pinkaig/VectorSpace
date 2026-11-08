"""Project content routes: every save is a numbered revision of the project's scene.

The scene itself (objects, audio, rules) is stored as an opaque JSON blob; the API checks
only that it is an object carrying a schemaVersion, and leaves the rest to the editor.
Activate (publishing a chosen revision) is not built yet.

History is kept to checkpoints, not every autosave: a save by the same person within
MERGE_WINDOW of their last one replaces that revision's content instead of adding a revision,
and only the newest KEEP_REVISIONS revisions are kept, plus every labelled one (such as
"Sent by Ms Tan") and every one a hand-in points at (routers/submissions.py). A revision someone
else saved, a labelled one, or a handed-in one is never merged into.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..access import can_write
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, ContentSnapshot, ProjectVersion, Submission
from ._skeleton import not_implemented
from .projects import _load

router = APIRouter(prefix="/projects/{project_id}/versions", tags=["publish"])

# saves by one person closer together than this are one revision
MERGE_WINDOW = timedelta(minutes=10)
# unlabelled revisions kept per project, newest first
KEEP_REVISIONS = 20


class SaveRequest(BaseModel):
    # the revision the editor loaded (0 for a project with no saves yet); anything else means
    # someone saved in between and this save would overwrite their work
    base_revision: int
    data: dict[str, Any]
    label: str | None = Field(None, max_length=200)


class ProjectVersionResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    revision: int
    label: str | None
    content_snapshot_id: uuid.UUID | None
    created_at: datetime
    created_by_name: str = ""

    model_config = {"from_attributes": True}


class ProjectVersionDetail(ProjectVersionResponse):
    data: dict[str, Any] | None = None


def _current_revision(db: Session, current_version_id: uuid.UUID | None) -> int:
    version = db.get(ProjectVersion, current_version_id) if current_version_id else None
    return version.revision if version else 0


def _checksum(data: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _utc(moment: datetime) -> datetime:
    """Postgres hands back aware times, SQLite (the tests) naive ones in UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def _drop_unused_snapshots(db: Session, snapshot_ids: set[uuid.UUID]) -> None:
    """Deletes those snapshots no revision points at any more."""
    if not snapshot_ids:
        return
    used = set(db.scalars(select(ProjectVersion.content_snapshot_id).where(ProjectVersion.content_snapshot_id.in_(snapshot_ids))))
    if snapshot_ids - used:
        db.execute(delete(ContentSnapshot).where(ContentSnapshot.id.in_(snapshot_ids - used)))


def _handed_in(db: Session, version_id: uuid.UUID) -> bool:
    """True for a revision a hand-in points at: what the teacher reviews, and once approved what
    visitors see. It is never merged into or pruned, so a student's later edits stay a draft."""
    return db.scalar(select(Submission.id).where(Submission.version_id == version_id).limit(1)) is not None


def _prune(db: Session, project_id: uuid.UUID, current_id: uuid.UUID) -> None:
    """Keeps the newest KEEP_REVISIONS unlabelled revisions, every labelled one, every handed-in
    one and the current one."""
    handed_in = select(Submission.version_id).where(Submission.project_id == project_id, Submission.version_id.is_not(None))
    old = list(
        db.scalars(
            select(ProjectVersion)
            .where(
                ProjectVersion.project_id == project_id,
                ProjectVersion.label.is_(None),
                ProjectVersion.id != current_id,
                ProjectVersion.id.not_in(handed_in),
            )
            .order_by(ProjectVersion.revision.desc())
            .offset(KEEP_REVISIONS - 1)  # the current one counts towards the kept
        )
    )
    if not old:
        return
    snapshots = {v.content_snapshot_id for v in old if v.content_snapshot_id}
    db.execute(delete(ProjectVersion).where(ProjectVersion.id.in_([v.id for v in old])))
    _drop_unused_snapshots(db, snapshots)


@router.get("", response_model=list[ProjectVersionResponse])
def list_versions(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> list[ProjectVersionResponse]:
    _load(db, actor, project_id)
    rows = list(
        db.scalars(
            select(ProjectVersion).where(ProjectVersion.project_id == project_id).order_by(ProjectVersion.revision.desc())
        )
    )
    names = {a.id: a.display_name for a in db.scalars(select(Actor).where(Actor.id.in_({v.created_by_id for v in rows})))}
    return [ProjectVersionResponse.model_validate(v).model_copy(update={"created_by_name": names.get(v.created_by_id, "")}) for v in rows]


@router.post("", response_model=ProjectVersionResponse, status_code=201)
def save_version(
    project_id: uuid.UUID,
    body: SaveRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> ProjectVersion:
    project = _load(db, actor, project_id)
    if not can_write(actor, project):
        raise HTTPException(status_code=403, detail="You cannot change this project")
    if not isinstance(body.data.get("schemaVersion"), int):
        raise HTTPException(status_code=422, detail="data must be a project carrying an integer schemaVersion")

    current = _current_revision(db, project.current_version_id)
    conflict = HTTPException(status_code=409, detail={"message": "Saved elsewhere since you loaded it", "current_revision": current})
    if body.base_revision != current:
        raise conflict

    checksum = _checksum(body.data)
    latest = db.get(ProjectVersion, project.current_version_id) if project.current_version_id else None
    if latest and latest.content_snapshot and latest.content_snapshot.checksum == checksum:
        return latest  # nothing changed, e.g. a retried save: no new revision

    snapshot = db.scalar(
        select(ContentSnapshot).where(ContentSnapshot.project_id == project.id, ContentSnapshot.checksum == checksum)
    )
    if snapshot is None:
        snapshot = ContentSnapshot(project_id=project.id, data=body.data, checksum=checksum)
        db.add(snapshot)
        db.flush()

    # the same person saving again soon after: the latest revision takes the new content
    now = datetime.now(UTC)
    if (
        latest is not None
        and latest.created_by_id == actor.id
        and latest.label is None
        and body.label is None
        and now - _utc(latest.created_at) < MERGE_WINDOW
        and not _handed_in(db, latest.id)
    ):
        replaced = latest.content_snapshot_id
        latest.content_snapshot_id, latest.created_at = snapshot.id, now
        db.flush()
        _drop_unused_snapshots(db, {replaced} - {snapshot.id} if replaced else set())
        project.updated_at = now
        db.commit()
        db.refresh(latest)
        return latest

    version = ProjectVersion(
        project_id=project.id, revision=current + 1, created_by_id=actor.id, content_snapshot_id=snapshot.id, label=body.label
    )
    db.add(version)
    try:
        db.flush()
    except IntegrityError:  # two saves from the same revision at once: the second loses
        db.rollback()
        raise conflict
    project.current_version_id = version.id
    db.flush()
    _prune(db, project.id, version.id)
    db.commit()
    db.refresh(version)
    return version


@router.get("/{version_id}", response_model=ProjectVersionDetail)
def get_version(
    project_id: uuid.UUID,
    version_id: uuid.UUID,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> ProjectVersionDetail:
    _load(db, actor, project_id)
    version = db.get(ProjectVersion, version_id)
    if version is None or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Version not found")
    detail = ProjectVersionDetail.model_validate(version)
    detail.data = version.content_snapshot.data if version.content_snapshot else None
    return detail


@router.post("/{version_id}/activate", response_model=ProjectVersionResponse)
def activate_version(project_id: uuid.UUID, version_id: uuid.UUID) -> ProjectVersionResponse:
    raise not_implemented("activate_version is not implemented")
