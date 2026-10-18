"""Project CRUD routes. Every handler is scoped to the caller's school by app.access."""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import can_read, can_write, class_ids, visible_projects
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, Classroom, ContentSnapshot, Project, ProjectVersion
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
    # filled in by _describe so a list page needs no second request per row
    created_by_name: str = ""
    class_name: str | None = None
    current_revision: int = 0

    model_config = {"from_attributes": True}


def _describe(db: Session, projects: list[Project]) -> list[ProjectResponse]:
    """The rows plus who made them, which class they are in and how many saves they have: three lookups for the lot."""
    owners = {a.id: a.display_name for a in db.scalars(select(Actor).where(Actor.id.in_({p.created_by_id for p in projects})))}
    classes = {c.id: c.name for c in db.scalars(select(Classroom).where(Classroom.id.in_({p.class_id for p in projects if p.class_id})))}
    revisions = {
        v.id: v.revision
        for v in db.scalars(select(ProjectVersion).where(ProjectVersion.id.in_({p.current_version_id for p in projects if p.current_version_id})))
    }
    return [
        ProjectResponse.model_validate(p).model_copy(
            update={
                "created_by_name": owners.get(p.created_by_id, ""),
                "class_name": classes.get(p.class_id) if p.class_id else None,
                "current_revision": revisions.get(p.current_version_id, 0) if p.current_version_id else 0,
            }
        )
        for p in projects
    ]


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
    response: Response,
    kind: str | None = Query(None, pattern="^(project|template)$"),
    status: str | None = Query(None, pattern="^(draft|published|archived)$"),
    class_id: uuid.UUID | None = None,
    created_by: uuid.UUID | None = None,
    mine: bool = False,
    q: str | None = Query(None, max_length=100, description="part of the project name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    """What the caller may see, newest edit first. Filters combine; X-Total-Count is the size before limit/offset."""
    query = visible_projects(db, actor)
    for column, wanted in ((Project.kind, kind), (Project.status, status), (Project.class_id, class_id), (Project.created_by_id, created_by)):
        if wanted is not None:
            query = query.where(column == wanted)
    if mine:
        query = query.where(Project.created_by_id == actor.id)
    if q:
        query = query.where(Project.name.ilike(f"%{q}%"))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(query.subquery())))
    page = db.scalars(query.order_by(Project.updated_at.desc(), Project.id).limit(limit).offset(offset))
    return _describe(db, list(page))


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    body: ProjectCreateRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> ProjectResponse:
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
    return _describe(db, [project])[0]


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> ProjectResponse:
    return _describe(db, [_load(db, actor, project_id)])[0]


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdateRequest,
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = _load(db, actor, project_id)
    if not can_write(actor, project):
        raise HTTPException(status_code=403, detail="You cannot change this project")
    if body.status is not None and body.status not in ("draft", "published", "archived"):
        raise HTTPException(status_code=422, detail="Invalid status")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _describe(db, [project])[0]


@router.delete("/{project_id}", status_code=204, response_model=None)
def delete_project(project_id: uuid.UUID) -> None:
    raise not_implemented("delete_project is not implemented")
