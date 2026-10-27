"""Project CRUD routes. Every handler is scoped to the caller's school by app.access."""

from __future__ import annotations

import json
import re
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import can_read, can_write, class_ids, visible_projects
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, Assignment, ClassMember, Classroom, ContentSnapshot, Project, ProjectVersion
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
    # the latest save: when, and by whom (a teacher's "send" counts as the first save)
    saved_at: datetime | None = None
    saved_by_name: str = ""
    template_name: str | None = None
    # the assignment this copy belongs to (None for a teacher's own projects): filled in by _describe
    assignment_id: uuid.UUID | None = None
    task: str | None = None
    due_at: date | None = None
    assigned_by_name: str | None = None
    # the teacher's mission brief for that assignment; the editor shows it to the student
    mission_brief: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


def _describe(db: Session, projects: list[Project]) -> list[ProjectResponse]:
    """The rows plus who made them, their class, their template, their assignment and the latest save: five lookups for the lot."""
    versions = {
        v.id: v
        for v in db.scalars(select(ProjectVersion).where(ProjectVersion.id.in_({p.current_version_id for p in projects if p.current_version_id})))
    }
    assignments = {
        a.id: a
        for a in db.scalars(select(Assignment).where(Assignment.id.in_({p.assignment_id for p in projects if p.assignment_id})))
    }
    people_ids = (
        {p.created_by_id for p in projects}
        | {v.created_by_id for v in versions.values()}
        | {a.created_by_id for a in assignments.values()}
    )
    people = {a.id: a.display_name for a in db.scalars(select(Actor).where(Actor.id.in_(people_ids)))}
    classes = {c.id: c.name for c in db.scalars(select(Classroom).where(Classroom.id.in_({p.class_id for p in projects if p.class_id})))}
    templates = {t.id: t.name for t in db.scalars(select(Project).where(Project.id.in_({p.template_id for p in projects if p.template_id})))}
    rows = []
    for p in projects:
        saved = versions.get(p.current_version_id)
        assignment = assignments.get(p.assignment_id) if p.assignment_id else None
        rows.append(
            ProjectResponse.model_validate(p).model_copy(
                update={
                    "created_by_name": people.get(p.created_by_id, ""),
                    "class_name": classes.get(p.class_id) if p.class_id else None,
                    "current_revision": saved.revision if saved else 0,
                    "saved_at": saved.created_at if saved else None,
                    "saved_by_name": people.get(saved.created_by_id, "") if saved else "",
                    "template_name": templates.get(p.template_id) if p.template_id else None,
                    "task": assignment.task if assignment else None,
                    "due_at": assignment.due_at if assignment else None,
                    "assigned_by_name": people.get(assignment.created_by_id) if assignment else None,
                    "mission_brief": assignment.mission_brief if assignment else None,
                }
            )
        )
    return rows

def distinct_name(db: Session, owner_id: uuid.UUID, kind: str, name: str) -> str:
    """name, or "name (2)", "name (3)"... so one person's copies of the same thing can be told apart."""
    taken = set(db.scalars(select(Project.name).where(Project.created_by_id == owner_id, Project.kind == kind)))
    if name not in taken:
        return name
    number = 2
    while f"{name} ({number})" in taken:
        number += 1
    return f"{name} ({number})"


def _copy_current(db: Session, source: Project, target: Project, author: Actor, label: str | None = None) -> None:
    """Gives target a first revision holding source's current content (nothing if source was never saved)."""
    latest = db.get(ProjectVersion, source.current_version_id) if source.current_version_id else None
    if latest is None or latest.content_snapshot is None:
        return
    snapshot = ContentSnapshot(project_id=target.id, data=latest.content_snapshot.data, checksum=latest.content_snapshot.checksum)
    db.add(snapshot)
    db.flush()
    version = ProjectVersion(project_id=target.id, revision=1, created_by_id=author.id, content_snapshot_id=snapshot.id, label=label)
    db.add(version)
    db.flush()
    target.current_version_id = version.id


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
        name=distinct_name(db, actor.id, body.kind, body.name),
        slug=_slug(body.name),
    )
    db.add(project)
    db.flush()

    if template:
        latest = db.get(ProjectVersion, template.current_version_id) if template.current_version_id else None
        project.template_id = template.id
        project.template_revision = latest.revision if latest else None
        _copy_current(db, template, project, actor)
    db.commit()
    db.refresh(project)
    return _describe(db, [project])[0]


class AssignRequest(BaseModel):
    student_id: uuid.UUID


@router.post("/{project_id}/assign", response_model=ProjectResponse, status_code=201)
def assign_project(
    project_id: uuid.UUID, body: AssignRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> ProjectResponse:
    """Send a student their own copy of a project or template: the teacher's "send to student".

    The copy belongs to the student (they can open and save it; the teacher can read it through the
    class). Its first revision is labelled with who sent it, so the history shows where it came from.
    """
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Only teachers can send work to a student")
    source = _load(db, actor, project_id)
    student = db.get(Actor, body.student_id)
    if student is None or student.organisation_id != actor.organisation_id or student.role != "student":
        raise HTTPException(status_code=404, detail="Student not found")
    mine = class_ids(db, actor)
    shared = [c for c in class_ids(db, student) if actor.role == "admin" or c in mine]
    if not shared:
        raise HTTPException(status_code=403, detail="That student is not in one of your classes")

    copy = _send_copy(db, source, student, shared[0], actor)
    db.commit()
    db.refresh(copy)
    return _describe(db, [copy])[0]


def _send_copy(db: Session, source: Project, student: Actor, class_id: uuid.UUID, sender: Actor) -> Project:
    """A new project owned by student holding source's current content, its first revision
    labelled "Sent by <sender>". Flushed, not committed."""
    copy = Project(
        organisation_id=sender.organisation_id,
        created_by_id=student.id,
        class_id=class_id,
        name=distinct_name(db, student.id, "project", source.name),
        slug=_slug(source.name),
        template_id=source.id if source.kind == "template" else source.template_id,
        template_revision=None,
    )
    db.add(copy)
    db.flush()
    if copy.template_id:
        origin = source if source.kind == "template" else db.get(Project, source.template_id)
        latest = db.get(ProjectVersion, origin.current_version_id) if origin and origin.current_version_id else None
        copy.template_revision = latest.revision if latest else None
    _copy_current(db, source, copy, sender, label=f"Sent by {sender.display_name}")
    return copy


# a brief is a due date and a few dozen short lines; anything near this is not a brief
MAX_MISSION_BRIEF_BYTES = 64 * 1024


class AssignClassRequest(BaseModel):
    class_id: uuid.UUID
    # the editor's MissionBrief: {due, todos: [{id, text}], rules: [{id, text}]}
    mission_brief: dict[str, Any] | None = None
    task: str = Field("", max_length=2000)
    due_at: date | None = None


class AssignClassResponse(BaseModel):
    assignment_id: uuid.UUID
    # students in the class
    students: int
    # copies made by this call (students who already had one keep theirs)
    sent: int


@router.post("/{project_id}/assign-class", response_model=AssignClassResponse)
def assign_class(
    project_id: uuid.UUID, body: AssignClassRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> AssignClassResponse:
    """Template setup's "Assign to <class>": the class's assignment of this project, with its
    mission brief, and a copy for every student in the class who has none yet.

    One assignment per (class, project): assigning again updates its brief, task and due date,
    and because the brief is read from the assignment (not from each copy), students who
    already have a copy see the new brief the next time they open it.
    """
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Only teachers can assign work to a class")
    source = _load(db, actor, project_id)
    classroom = db.get(Classroom, body.class_id)
    if classroom is None or classroom.organisation_id != actor.organisation_id:
        raise HTTPException(status_code=404, detail="Class not found")
    if actor.role != "admin" and body.class_id not in class_ids(db, actor):
        raise HTTPException(status_code=403, detail="You are not in that class")
    if body.mission_brief is not None and len(json.dumps(body.mission_brief)) > MAX_MISSION_BRIEF_BYTES:
        raise HTTPException(status_code=422, detail="Mission brief is too large")

    assignment = db.scalar(
        select(Assignment).where(Assignment.class_id == body.class_id, Assignment.project_id == source.id)
    )
    if assignment is None:
        assignment = Assignment(class_id=body.class_id, project_id=source.id, task=body.task, created_by_id=actor.id)
        db.add(assignment)
    assignment.task = body.task
    assignment.due_at = body.due_at
    assignment.mission_brief = body.mission_brief
    db.flush()

    students = list(
        db.scalars(
            select(Actor)
            .join(ClassMember, ClassMember.actor_id == Actor.id)
            .where(ClassMember.class_id == body.class_id, Actor.role == "student")
        )
    )
    have_copy = set(db.scalars(select(Project.created_by_id).where(Project.assignment_id == assignment.id)))
    sent = 0
    for student in students:
        if student.id in have_copy:
            continue
        copy = _send_copy(db, source, student, body.class_id, actor)
        copy.assignment_id = assignment.id
        sent += 1
    db.commit()
    return AssignClassResponse(assignment_id=assignment.id, students=len(students), sent=sent)


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
