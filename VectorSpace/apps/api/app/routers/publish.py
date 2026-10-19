"""Project content routes: every save is a numbered revision of the project's scene.

The scene itself (objects, audio, rules) is stored as an opaque JSON blob; the API checks
only that it is an object carrying a schemaVersion, and leaves the rest to the editor.
Activate (publishing a chosen revision) is not built yet.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..access import can_write
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, ContentSnapshot, ProjectVersion
from ._skeleton import not_implemented
from .projects import _load

router = APIRouter(prefix="/projects/{project_id}/versions", tags=["publish"])


class SaveRequest(BaseModel):
    # the revision the editor loaded (0 for a project with no saves yet); anything else means
    # someone saved in between and this save would overwrite their work
    base_revision: int
    data: dict[str, Any]
    label: str | None = None


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
