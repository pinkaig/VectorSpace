"""Classes the caller belongs to (an admin sees every class in the school) and who is in them."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..access import class_ids
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, ClassMember, Classroom

router = APIRouter(prefix="/classes", tags=["classes"])


class ClassResponse(BaseModel):
    id: uuid.UUID
    name: str
    member_count: int


class MemberResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    role: str


def _visible_class_ids(db: Session, actor: Actor) -> list[uuid.UUID]:
    if actor.role == "admin":
        return list(db.scalars(select(Classroom.id).where(Classroom.organisation_id == actor.organisation_id)))
    return class_ids(db, actor)


@router.get("", response_model=list[ClassResponse])
def list_classes(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> list[ClassResponse]:
    ids = _visible_class_ids(db, actor)
    counts = dict(db.execute(select(ClassMember.class_id, func.count()).where(ClassMember.class_id.in_(ids)).group_by(ClassMember.class_id)).all())
    rows = db.scalars(select(Classroom).where(Classroom.id.in_(ids)).order_by(Classroom.name))
    return [ClassResponse(id=c.id, name=c.name, member_count=counts.get(c.id, 0)) for c in rows]


@router.get("/{class_id}/members", response_model=list[MemberResponse])
def list_members(
    class_id: uuid.UUID, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> list[MemberResponse]:
    """The roster, for teachers and admins. 404 for a class the caller is not in; students may not list a roster."""
    if class_id not in _visible_class_ids(db, actor):
        raise HTTPException(status_code=404, detail="Class not found")
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot list a class roster")
    members = db.scalars(
        select(Actor).join(ClassMember, ClassMember.actor_id == Actor.id).where(ClassMember.class_id == class_id).order_by(Actor.display_name)
    )
    return [MemberResponse(id=m.id, display_name=m.display_name, role=m.role) for m in members]
