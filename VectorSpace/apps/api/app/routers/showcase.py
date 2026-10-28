"""The sign-in page's carousel: published museums a teacher chose to show (projects.showcase).

Public: no sign-in, so it answers with only what a card shows, from every school. The student
is named by first name only; no ids, emails or other people's names leave here.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Actor, Classroom, Organisation, Project, ProjectVersion

router = APIRouter(prefix="/showcase", tags=["showcase"])

# the carousel shows a handful, newest first
SHOWCASE_SIZE = 6


class ShowcaseMuseum(BaseModel):
    title: str
    student_name: str  # first name only
    class_name: str | None
    school_name: str
    exhibit_count: int
    room_count: int
    updated_at: datetime


def _counts(data: dict | None) -> tuple[int, int]:
    """(exhibits, rooms) from a saved scene: top-level objects in every room, and the rooms."""
    scenes = (data or {}).get("scenes") or []
    exhibits = sum(1 for scene in scenes for item in scene.get("objects") or [] if not item.get("parentId"))
    return exhibits, len(scenes)


@router.get("", response_model=list[ShowcaseMuseum])
def list_showcase(db: Session = Depends(get_db)) -> list[ShowcaseMuseum]:
    rows = db.execute(
        select(Project, Actor.display_name, Classroom.name, Organisation.name)
        .join(Actor, Actor.id == Project.created_by_id)
        .join(Organisation, Organisation.id == Project.organisation_id)
        .outerjoin(Classroom, Classroom.id == Project.class_id)
        .where(Project.showcase.is_(True), Project.status == "published", Project.kind == "project", Actor.active.is_(True))
        .order_by(Project.updated_at.desc())
        .limit(SHOWCASE_SIZE)
    ).all()
    museums = []
    for project, student, class_name, school in rows:
        version = db.get(ProjectVersion, project.current_version_id) if project.current_version_id else None
        exhibits, rooms = _counts(version.content_snapshot.data if version and version.content_snapshot else None)
        museums.append(
            ShowcaseMuseum(
                title=project.name,
                student_name=student.split(" ")[0],
                class_name=class_name,
                school_name=school,
                exhibit_count=exhibits,
                room_count=rooms,
                updated_at=project.updated_at,
            )
        )
    return museums
