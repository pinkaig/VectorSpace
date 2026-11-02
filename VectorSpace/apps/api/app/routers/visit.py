"""The visitor's page: a published project opened from its share link (#/visit/<slug>).

Who may open it is what the student chose in "Who can visit?" on the hand-in the teacher
approved (submissions.share_with):
  public, unlisted  anyone, signed in or not
  sign_in_only      signed in, in the same school, and in the project's class (or able to read
                    it anyway: its owner, the class teacher, an admin)
A project published without a hand-in (a teacher's own) has no choice on record, so it is
treated as sign_in_only. A project handed in and waiting for the teacher is a 409 ("waiting
for approval"), but only to a visitor its choice would let in. Anything else not published,
or not visible to this visitor, is a 404, so a link does not confirm that a draft exists.

The answer carries the scene and only what the page shows about who made it: the student's
first name, the class and the school. Uploaded media still needs a sign-in to load.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import can_read, class_ids
from ..auth import get_optional_actor
from ..db import get_db
from ..models import Actor, Classroom, Organisation, Project, ProjectVersion, Submission

router = APIRouter(prefix="/visit", tags=["visit"])

OPEN_TO_ANYONE = {"public", "unlisted"}


class VisitResponse(BaseModel):
    title: str
    student_name: str  # first name only
    class_name: str | None
    school_name: str
    share_with: str
    data: dict[str, Any]


def _newest_hand_in(db: Session, project: Project, status: str | None = None) -> Submission | None:
    query = select(Submission).where(Submission.project_id == project.id)
    if status is not None:
        query = query.where(Submission.status == status)
    return db.scalar(query.order_by(Submission.submitted_at.desc()).limit(1))


def _may_visit(db: Session, visitor: Actor, project: Project) -> bool:
    if visitor.organisation_id != project.organisation_id:
        return False
    return (project.class_id is not None and project.class_id in class_ids(db, visitor)) or can_read(db, visitor, project)


def _let_in(db: Session, visitor: Actor | None, project: Project, share_with: str, missing: HTTPException) -> None:
    """Raises unless share_with lets this visitor in: 401 to sign in first, else the 404."""
    if share_with in OPEN_TO_ANYONE:
        return
    if visitor is None:
        raise HTTPException(status_code=401, detail="Sign in to visit this project")
    if not _may_visit(db, visitor, project):
        raise missing


@router.get("/{slug}", response_model=VisitResponse)
def visit(slug: str, visitor: Actor | None = Depends(get_optional_actor), db: Session = Depends(get_db)) -> VisitResponse:
    missing = HTTPException(status_code=404, detail="This project isn't open to visitors")
    project = db.scalar(select(Project).where(Project.slug == slug, Project.kind == "project").limit(1))
    if project is None or project.current_version_id is None:
        raise missing
    if project.status != "published":
        # handed in and not yet approved: say so, to whoever the student's choice lets in
        waiting = _newest_hand_in(db, project)
        if project.status != "draft" or waiting is None or waiting.status != "waiting":
            raise missing
        _let_in(db, visitor, project, waiting.share_with or "sign_in_only", missing)
        raise HTTPException(status_code=409, detail="Waiting for the teacher to approve this project")
    approved = _newest_hand_in(db, project, "approved")
    share_with = (approved.share_with if approved else None) or "sign_in_only"
    _let_in(db, visitor, project, share_with, missing)

    version = db.get(ProjectVersion, project.current_version_id)
    if version is None or version.content_snapshot is None:
        raise missing
    student = db.get(Actor, project.created_by_id)
    school = db.get(Organisation, project.organisation_id)
    classroom = db.get(Classroom, project.class_id) if project.class_id else None
    return VisitResponse(
        title=project.name,
        student_name=student.display_name.split(" ")[0] if student else "",
        class_name=classroom.name if classroom else None,
        school_name=school.name if school else "",
        share_with=share_with,
        data=version.content_snapshot.data,
    )
