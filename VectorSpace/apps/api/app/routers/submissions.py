"""Hand-ins and teacher review: a student sends their assigned museum to the teacher, who
approves it (it goes live) or sends it back with a comment (the student keeps building).

Each hand-in is a row in submissions, so a museum sent back and sent again keeps the history.
The project's review state is its newest submission: waiting, approved or sent_back.

Once approved, the museum stays published at the approved save (the hand-in's version_id):
visitors keep seeing that one while the student keeps editing. The student sends an update
the same way (a new hand-in); it goes live only when the teacher approves it, and sending it
back or the student cancelling it leaves the approved save live.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import class_ids
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, Project, ProjectVersion, Submission
from .projects import _load

router = APIRouter(prefix="/projects", tags=["submissions"])

# the same limit as a media link's review comment
MAX_COMMENT_LENGTH = 500
# the save a hand-in points at gets this label: publish.py never merges into or prunes a
# labelled save, so the teacher reviews (and visitors later see) exactly what was sent
SENT_LABEL = "Sent to teacher"


class SubmitRequest(BaseModel):
    # who the student wants to share it with once it is approved; left out = decide later
    share_with: str | None = Field(None, pattern="^(public|unlisted|sign_in_only)$")


class ReviewRequest(BaseModel):
    grade: str | None = Field(None, max_length=20)
    comment: str | None = Field(None, max_length=MAX_COMMENT_LENGTH)


class SendBackRequest(BaseModel):
    grade: str | None = Field(None, max_length=20)
    # sending back always says why, so the student knows what to change
    comment: str = Field(..., min_length=1, max_length=MAX_COMMENT_LENGTH)


class SubmissionResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    version_id: uuid.UUID | None
    status: str
    share_with: str | None
    grade: str | None
    comment: str | None
    submitted_by_id: uuid.UUID
    submitted_at: datetime
    reviewed_by_id: uuid.UUID | None
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


def latest_submission(db: Session, project_id: uuid.UUID) -> Submission | None:
    """The newest hand-in of a project, which is its review state; None if never handed in."""
    return db.scalar(
        select(Submission).where(Submission.project_id == project_id).order_by(Submission.submitted_at.desc()).limit(1)
    )


def approved_submission(db: Session, project_id: uuid.UUID) -> Submission | None:
    """The newest approved hand-in: the save visitors see. None if never approved."""
    return db.scalar(
        select(Submission)
        .where(Submission.project_id == project_id, Submission.status == "approved")
        .order_by(Submission.submitted_at.desc())
        .limit(1)
    )


def _teaches(db: Session, actor: Actor, project: Project) -> bool:
    """A teacher of the project's class, or an admin."""
    return actor.role == "admin" or (actor.role == "teacher" and project.class_id in class_ids(db, actor))


def _waiting(db: Session, actor: Actor, project_id: uuid.UUID) -> tuple[Project, Submission]:
    """The project and its hand-in for a teacher's decision: refused unless it is waiting."""
    project = _load(db, actor, project_id)
    if not _teaches(db, actor, project):
        raise HTTPException(status_code=403, detail="Only a teacher of its class can review this project")
    latest = latest_submission(db, project.id)
    if latest is None or latest.status != "waiting":
        raise HTTPException(status_code=409, detail="This project is not waiting for review")
    return project, latest


@router.post("/{project_id}/submit", response_model=SubmissionResponse, status_code=201)
def submit_project(
    project_id: uuid.UUID, body: SubmitRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> SubmissionResponse:
    """The student sends their assigned museum to the teacher: it waits for approval."""
    project = _load(db, actor, project_id)
    if project.created_by_id != actor.id or actor.role != "student":
        raise HTTPException(status_code=403, detail="Only the student whose project it is can send it")
    if project.assignment_id is None:
        raise HTTPException(status_code=409, detail="Only assigned work is sent to a teacher")
    latest = latest_submission(db, project.id)
    if latest is not None and latest.status == "waiting":
        raise HTTPException(status_code=409, detail="It is already waiting for your teacher")
    live = approved_submission(db, project.id)
    if live is not None and live.version_id == project.current_version_id:
        raise HTTPException(status_code=409, detail="Nothing has changed since your teacher approved it")
    sent = db.get(ProjectVersion, project.current_version_id) if project.current_version_id else None
    if sent is None:
        raise HTTPException(status_code=409, detail="Nothing is saved yet")
    # labelled in place, not copied, so the revision stays the same and the editor's next save
    # still lines up; a save that already has a label (such as "Sent by Ms Tan") keeps it
    if sent.label is None:
        sent.label = SENT_LABEL

    submission = Submission(
        project_id=project.id,
        version_id=sent.id,
        status="waiting",
        # an update keeps who-can-visit from the approved hand-in unless the student picks again
        share_with=body.share_with or (live.share_with if live else None),
        submitted_by_id=actor.id,
        # set here, not by the database, so two hand-ins in the same second still sort right
        submitted_at=datetime.now(UTC),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return SubmissionResponse.model_validate(submission)


@router.delete("/{project_id}/submit", status_code=204, response_model=None)
def withdraw_submission(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> None:
    """The student takes back a hand-in the teacher hasn't looked at yet. The waiting row is
    removed, so the project's review state goes back to what it was before (none, or sent_back)."""
    project = _load(db, actor, project_id)
    if project.created_by_id != actor.id or actor.role != "student":
        raise HTTPException(status_code=403, detail="Only the student whose project it is can take it back")
    latest = latest_submission(db, project.id)
    if latest is None or latest.status != "waiting":
        raise HTTPException(status_code=409, detail="This project is not waiting for review")
    db.delete(latest)
    db.commit()


@router.post("/{project_id}/approve", response_model=SubmissionResponse)
def approve_project(
    project_id: uuid.UUID, body: ReviewRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> SubmissionResponse:
    """The teacher approves a waiting museum (a first hand-in or an update): it is published,
    and visitors see the save that was handed in."""
    project, latest = _waiting(db, actor, project_id)
    latest.status = "approved"
    latest.grade = body.grade
    latest.comment = body.comment
    latest.reviewed_by_id = actor.id
    latest.reviewed_at = datetime.now(UTC)
    project.status = "published"
    db.commit()
    db.refresh(latest)
    return SubmissionResponse.model_validate(latest)


@router.post("/{project_id}/send-back", response_model=SubmissionResponse)
def send_back_project(
    project_id: uuid.UUID, body: SendBackRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> SubmissionResponse:
    """The teacher returns a waiting museum with a comment: the student keeps building and sends it
    again. For an update to a published museum, the approved save stays live."""
    _, latest = _waiting(db, actor, project_id)
    latest.status = "sent_back"
    latest.grade = body.grade
    latest.comment = body.comment
    latest.reviewed_by_id = actor.id
    latest.reviewed_at = datetime.now(UTC)
    db.commit()
    db.refresh(latest)
    return SubmissionResponse.model_validate(latest)


@router.get("/{project_id}/submissions", response_model=list[SubmissionResponse])
def list_submissions(
    project_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> list[SubmissionResponse]:
    """Every hand-in of a museum, newest first: for the student and anyone who can see it."""
    project = _load(db, actor, project_id)
    rows = db.scalars(
        select(Submission).where(Submission.project_id == project.id).order_by(Submission.submitted_at.desc())
    )
    return [SubmissionResponse.model_validate(row) for row in rows]