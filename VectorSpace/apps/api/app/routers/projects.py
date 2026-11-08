"""Project CRUD routes. Every handler is scoped to the caller's school by app.access."""

from __future__ import annotations

import json
import re
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import permissions
from ..access import can_read, can_write, class_ids, visible_projects
from ..auth import get_current_actor
from ..db import get_db
from ..models import (
    Actor,
    AnalyticsEvent,
    Assignment,
    ClassMember,
    Classroom,
    ContentSnapshot,
    InteractionRule,
    MediaAsset,
    MediaLink,
    Project,
    ProjectVersion,
    Submission,
)
from ..teacher_setup import push_setup

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    name: str = Field(max_length=200)
    kind: str = Field("project", max_length=30)
    class_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=200)
    status: str | None = Field(None, max_length=30)
    # the class the project is for (a teacher's Assign picks it); only a class the caller is in
    class_id: uuid.UUID | None = None
    # shown on the public sign-in page: teachers and admins only, published museums only
    showcase: bool | None = None


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
    # the teacher's current mission brief, read from the assignment (student copies only), so a
    # brief edited after sending reaches copies already sent: the editor puts it over the copy's own
    mission_brief: dict[str, Any] | None = None
    # a copy of this project has been sent to at least one student (it has an assignment)
    sent: bool = False
    # how many students' copies of this project are published (0 for a student's own copy)
    published_copies: int = 0
    # the assignments made from this project (one per class or student it was sent to)
    assignment_ids: list[uuid.UUID] = []
    # a teacher chose it for the public sign-in page
    showcase: bool = False
    # the newest hand-in for review, None if never handed in: filled in by _describe
    review_status: str | None = None
    review_grade: str | None = None
    review_comment: str | None = None
    share_with: str | None = None
    submitted_at: datetime | None = None
    model_config = {"from_attributes": True}


def _describe(db: Session, projects: list[Project]) -> list[ProjectResponse]:
    """The rows plus who made them, their class, their template, their assignment, the latest save and
    whether they were sent to students: six lookups for the lot."""
    # the teacher's own projects: the assignment made from each (one per class it was sent to)
    given_out: dict[uuid.UUID, Assignment] = {}
    # every assignment made from one of these projects -> that project
    assignment_source: dict[uuid.UUID, uuid.UUID] = {}
    for a in db.scalars(select(Assignment).where(Assignment.project_id.in_({p.id for p in projects}))):
        assignment_source[a.id] = a.project_id
        kept = given_out.get(a.project_id)
        # sent to more than one class: the latest due date counts
        if kept is None or (a.due_at or date.min) > (kept.due_at or date.min):
            given_out[a.project_id] = a
    sent = set(given_out)
    # how many students' copies of each project are published
    published_copies: dict[uuid.UUID, int] = {}
    if assignment_source:
        for assignment_id in db.scalars(
            select(Project.assignment_id).where(
                Project.assignment_id.in_(set(assignment_source)), Project.status == "published"
            )
        ):
            source_id = assignment_source[assignment_id]
            published_copies[source_id] = published_copies.get(source_id, 0) + 1
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
        | {a.created_by_id for a in given_out.values()}
    )
    people = {a.id: a.display_name for a in db.scalars(select(Actor).where(Actor.id.in_(people_ids)))}
    classes = {c.id: c.name for c in db.scalars(select(Classroom).where(Classroom.id.in_({p.class_id for p in projects if p.class_id})))}
    templates = {t.id: t.name for t in db.scalars(select(Project).where(Project.id.in_({p.template_id for p in projects if p.template_id})))}
    # each project's newest hand-in: read oldest first, so the newest one ends up kept
    reviews: dict[uuid.UUID, Submission] = {}
    for s in db.scalars(
        select(Submission).where(Submission.project_id.in_({p.id for p in projects})).order_by(Submission.submitted_at)
    ):
        reviews[s.project_id] = s
    rows = []
    for p in projects:
        saved = versions.get(p.current_version_id)
        # a student's copy points at its assignment; the teacher's own project is pointed at by one
        assignment = assignments.get(p.assignment_id) if p.assignment_id else given_out.get(p.id)
        review = reviews.get(p.id)
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
                    # only a student's copy: the teacher's own project keeps the brief in its content
                    "mission_brief": assignment.mission_brief if p.assignment_id and assignment else None,
                    "sent": p.id in sent,
                    "published_copies": published_copies.get(p.id, 0),
                    "assignment_ids": [a for a, source in assignment_source.items() if source == p.id],
                    "review_status": review.status if review else None,
                    "review_grade": review.grade if review else None,
                    "review_comment": review.comment if review else None,
                    "share_with": review.share_with if review else None,
                    "submitted_at": review.submitted_at if review else None,
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
        # the admin Permissions page's "Set up projects from templates" (app/permissions.py)
        if not permissions.allowed(db, actor, "from-templates"):
            raise HTTPException(
                status_code=403,
                detail="Your school does not let you set up projects from templates. Ask your teacher or admin.",
            )
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
    task: str | None = Field(None, max_length=2000)  # the teacher's one-line task; left out = keep what's saved
    due_at: date | None = None  # "YYYY-MM-DD"; left out = keep what's saved


@router.post("/{project_id}/assign", response_model=ProjectResponse, status_code=201)
def assign_project(
    project_id: uuid.UUID, body: AssignRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> ProjectResponse:
    """Send a student their own copy of a project or template: the teacher's "send to student".

    The copy belongs to the student (they can open and save it; the teacher can read it through the
    class). Its first revision is labelled with who sent it, so the history shows where it came from.
    The copy joins the source's assignment for that class (made on the first send), which is what
    marks the source as sent: it can no longer be deleted, only archived.
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

    assignment = db.scalar(select(Assignment).where(Assignment.class_id == shared[0], Assignment.project_id == source.id))
    if assignment is None:
        assignment = Assignment(class_id=shared[0], project_id=source.id, task="", created_by_id=actor.id)
        db.add(assignment)
    # the latest assign wins, so editing the brief and assigning again updates every student's card
    if body.task is not None:
        assignment.task = body.task
    if body.due_at is not None:
        assignment.due_at = body.due_at
    # the brief the teacher just saved in the source is the one every copy in this assignment shows
    brief = _saved_brief(db, source)
    if brief is not None:
        assignment.mission_brief = brief
    db.flush()
    copy = _send_copy(db, source, student, shared[0], actor)
    copy.assignment_id = assignment.id
    db.commit()
    db.refresh(copy)
    return _describe(db, [copy])[0]


class PushSetupResponse(BaseModel):
    # copies that got the teacher's latest setup, and copies left alone because they are under review
    updated: int
    skipped: int


@router.post("/{project_id}/push-setup", response_model=PushSetupResponse)
def push_project_setup(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> PushSetupResponse:
    """Carries the teacher's spots, locks and starter objects into copies students already have
    (see teacher_setup.py). The template's saved content is what is carried, so save first."""
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Only teachers can update students' copies")
    source = _load(db, actor, project_id)
    if not can_write(actor, source):
        raise HTTPException(status_code=403, detail="You cannot change this project")
    updated, skipped = push_setup(db, source, actor)
    return PushSetupResponse(updated=updated, skipped=skipped)


def _saved_brief(db: Session, source: Project) -> dict[str, Any] | None:
    """The mission brief in source's latest save, or None if it has none."""
    latest = db.get(ProjectVersion, source.current_version_id) if source.current_version_id else None
    data = latest.content_snapshot.data if latest and latest.content_snapshot else None
    brief = data.get("missionBrief") if isinstance(data, dict) else None
    return brief if isinstance(brief, dict) else None


def _send_copy(db: Session, source: Project, student: Actor, class_id: uuid.UUID, sender: Actor) -> Project:
    """Make one student's own copy of `source` in `class_id`, labelled as sent by `sender`.

    Shared by "send to student" (assign_project) and "assign to class" (assign_class); the caller
    links the copy to its assignment and commits.
    """
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
    changes = body.model_dump(exclude_none=True)
    # everything but showcase is the owner's to change; showcase is the class teacher's
    if set(changes) - {"showcase"} and not can_write(actor, project):
        raise HTTPException(status_code=403, detail="You cannot change this project")
    if body.status is not None and body.status not in ("draft", "published", "archived"):
        raise HTTPException(status_code=422, detail="Invalid status")
    # assigned work goes live through the teacher (submit, then approve), never straight from the student
    if body.status == "published" and project.assignment_id and actor.role == "student":
        raise HTTPException(status_code=403, detail="Send it to your teacher: it goes live once they approve it")
    if body.class_id and actor.role != "admin" and body.class_id not in class_ids(db, actor):
        raise HTTPException(status_code=403, detail="You are not in that class")
    if body.showcase is not None:
        teaches_it = actor.role == "admin" or (
            actor.role == "teacher" and (project.created_by_id == actor.id or project.class_id in class_ids(db, actor))
        )
        if not teaches_it:
            raise HTTPException(status_code=403, detail="Only a teacher of its class can put a project on the sign-in page")
        if body.showcase and changes.get("status", project.status) != "published":
            raise HTTPException(status_code=409, detail="Only a published project can be shown on the sign-in page")
    for field, value in changes.items():
        setattr(project, field, value)
    # a museum that is no longer published comes off the sign-in page
    if project.status != "published":
        project.showcase = False
    db.commit()
    db.refresh(project)
    return _describe(db, [project])[0]


@router.delete("/{project_id}", status_code=204, response_model=None)
def delete_project(project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> None:
    """Deletes a draft nobody was sent: the project and everything saved on it.

    Refused (409) for anything published or archived, for a project already sent to students (it
    has an assignment), and for a student's copy of assigned work; those can only be archived.
    Copies sent earlier are never touched: they belong to the students.
    """
    project = _load(db, actor, project_id)
    if not can_write(actor, project):
        raise HTTPException(status_code=403, detail="You cannot delete this project")
    if project.status != "draft":
        raise HTTPException(status_code=409, detail="Only a draft can be deleted: archive it instead")
    if project.assignment_id or db.scalar(select(Assignment.id).where(Assignment.project_id == project.id).limit(1)):
        raise HTTPException(status_code=409, detail="It was sent to students, so it can only be archived")

    # let go of the current save first (the project and its saves point at each other), then the
    # rows that hang off the project, then the project; copies made from it keep their content
    project.current_version_id = None
    db.flush()
    for model in (InteractionRule, AnalyticsEvent, MediaLink, MediaAsset, ProjectVersion, ContentSnapshot):
        db.execute(delete(model).where(model.project_id == project.id))
    db.execute(delete(Project).where(Project.id == project.id))
    db.commit()
