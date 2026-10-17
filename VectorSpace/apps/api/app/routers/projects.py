"""Project CRUD routes. Every handler is scoped to the caller's school by app.access."""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..access import can_read, can_write, class_ids, visible_projects
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, ContentSnapshot, Project, ProjectVersion
from ._skeleton import not_implemented

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    name: str
    kind: str = "project"
    class_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    status: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    organisation_id: uuid.UUID
    created_by_id: uuid.UUID
    class_id: uuid.UUID | None
    template_id: uuid.UUID | None
    template_revision: int | None
    kind: str
    name: str
    slug: str
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def _load(db: Session, actor: Actor, project_id: uuid.UUID) -> Project:
    """404 for anything the caller cannot see, so ids from other schools are not confirmed to exist."""
    project = db.get(Project, project_id)
    if project is None or not can_read(db, actor, project):
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:150] or "project"
    return f"{base}-{uuid.uuid4().hex[:8]}"


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    kind: str | None = Query(None, pattern="^(project|template)$"),
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> list[Project]:
    query = visible_projects(db, actor).order_by(Project.created_at.desc())
    if kind:
        query = query.where(Project.kind == kind)
    return list(db.scalars(query))


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    body: ProjectCreateRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> Project:
    if body.kind not in ("project", "template"):
        raise HTTPException(status_code=422, detail="kind must be 'project' or 'template'")
    if body.kind == "template" and actor.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot create templates")
    if body.class_id and actor.role != "admin" and body.class_id not in class_ids(db, actor):
        raise HTTPException(status_code=403, detail="You are not in that class")

    template = None
    if body.template_id:
        template = _load(db, actor, body.template_id)
        if template.kind != "template":
            raise HTTPException(status_code=422, detail="template_id does not point at a template")

    project = Project(
        organisation_id=actor.organisation_id,
        created_by_id=actor.id,
        class_id=body.class_id,
        kind=body.kind,
        name=body.name,
        slug=_slug(body.name),
    )
    db.add(project)
    db.flush()

    if template:
        source = db.get(ProjectVersion, template.current_version_id) if template.current_version_id else None
        project.template_id = template.id
        project.template_revision = source.revision if source else None
        if source and source.content_snapshot:
            snapshot = ContentSnapshot(
                project_id=project.id, data=source.content_snapshot.data, checksum=source.content_snapshot.checksum
            )
            db.add(snapshot)
            db.flush()
            version = ProjectVersion(
                project_id=project.id, revision=1, created_by_id=actor.id, content_snapshot_id=snapshot.id
            )
            db.add(version)
            db.flush()
            project.current_version_id = version.id
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> Project:
    return _load(db, actor, project_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdateRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> Project:
    project = _load(db, actor, project_id)
    if not can_write(actor, project):
        raise HTTPException(status_code=403, detail="You cannot change this project")
    if body.status is not None and body.status not in ("draft", "published", "archived"):
        raise HTTPException(status_code=422, detail="Invalid status")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204, response_model=None)
def delete_project(project_id: uuid.UUID) -> None:
    raise not_implemented("delete_project is not implemented")
