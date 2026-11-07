"""Classes and who is in them: list, create, add, remove, and move a student between two classes.

Who may change a class:
- an admin, on any class in any school (VThere staff, decision D-A);
- a teacher, only on classes they teach, and only students: a move needs both classes to be theirs;
- a student, never.

A move takes the student out of one class and puts them in another in one call, so nobody is ever
left in both or neither. Their work is not touched: a student's copies are theirs by
created_by_id (see access.py), so they keep every museum they started. The old class's teacher
still sees those copies (Project.class_id); the new teacher assigns the class's projects again if
the student needs them. Assignments are not copied on a move, on purpose: a teacher may not want
last term's task handed to someone who joined late.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..access import class_ids
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, ClassMember, Classroom, Organisation

router = APIRouter(prefix="/classes", tags=["classes"])


class ClassResponse(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    member_count: int


class MemberResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    role: str


class NewClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    # an admin names the school; a teacher's class is always in their own school, so they leave it out
    school_id: uuid.UUID | None = None


class AddMemberRequest(BaseModel):
    actor_id: uuid.UUID


class MoveRequest(BaseModel):
    to_class_id: uuid.UUID


class MoveResponse(BaseModel):
    student: MemberResponse
    from_class: ClassResponse
    to_class: ClassResponse


def _visible_class_ids(db: Session, actor: Actor, school: uuid.UUID | None = None) -> list[uuid.UUID]:
    if actor.role == "admin":
        query = select(Classroom.id)
        if school is not None:
            query = query.where(Classroom.organisation_id == school)
        return list(db.scalars(query))
    return class_ids(db, actor)


def _describe(db: Session, classes: list[Classroom]) -> list[ClassResponse]:
    ids = [c.id for c in classes]
    counts = dict(
        db.execute(
            select(ClassMember.class_id, func.count()).where(ClassMember.class_id.in_(ids)).group_by(ClassMember.class_id)
        ).all()
    )
    return [ClassResponse(id=c.id, school_id=c.organisation_id, name=c.name, member_count=counts.get(c.id, 0)) for c in classes]


def _member(person: Actor) -> MemberResponse:
    return MemberResponse(id=person.id, display_name=person.display_name, role=person.role)


def _class_to_change(db: Session, actor: Actor, class_id: uuid.UUID) -> Classroom:
    """The class, if this person may change who is in it. 404 when they cannot even see it."""
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot change a class")
    classroom = db.get(Classroom, class_id)
    if classroom is None or class_id not in _visible_class_ids(db, actor):
        raise HTTPException(status_code=404, detail="Class not found")
    return classroom


def _person_for(db: Session, actor: Actor, classroom: Classroom, person_id: uuid.UUID) -> Actor:
    """Someone who can be put in this class: same school, and a student when a teacher asks."""
    person = db.get(Actor, person_id)
    if person is None or person.organisation_id != classroom.organisation_id:
        raise HTTPException(status_code=404, detail="Account not found in this school")
    if actor.role == "teacher" and person.role != "student":
        raise HTTPException(status_code=403, detail="Teachers can only move students; ask an admin")
    return person


@router.get("", response_model=list[ClassResponse])
def list_classes(
    school: uuid.UUID | None = Query(None, description="admins only: just this school's classes"),
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> list[ClassResponse]:
    ids = _visible_class_ids(db, actor, school if actor.role == "admin" else None)
    rows = list(db.scalars(select(Classroom).where(Classroom.id.in_(ids)).order_by(Classroom.name)))
    return _describe(db, rows)


@router.post("", response_model=ClassResponse, status_code=201)
def create_class(
    body: NewClassRequest, actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)
) -> ClassResponse:
    """An empty class. A teacher who makes one teaches it, so they are put in it straight away."""
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot create a class")
    if actor.role == "admin":
        if body.school_id is None:
            raise HTTPException(status_code=422, detail="Pick the school the class belongs to")
        if db.get(Organisation, body.school_id) is None:
            raise HTTPException(status_code=404, detail="School not found")
        org_id = body.school_id
    else:
        org_id = actor.organisation_id
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="A class needs a name")
    if db.scalar(select(Classroom).where(Classroom.organisation_id == org_id, Classroom.name == name)):
        raise HTTPException(status_code=409, detail=f"This school already has a class called {name}")
    classroom = Classroom(organisation_id=org_id, name=name)
    db.add(classroom)
    db.flush()
    if actor.role == "teacher":
        db.add(ClassMember(class_id=classroom.id, actor_id=actor.id))
    db.commit()
    db.refresh(classroom)
    return _describe(db, [classroom])[0]


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
    return [_member(m) for m in members]


@router.post("/{class_id}/members", response_model=MemberResponse)
def add_member(
    class_id: uuid.UUID, body: AddMemberRequest,
    actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db),
) -> MemberResponse:
    """Put someone in a class. Already in it is fine: the answer is the same, nothing changes."""
    classroom = _class_to_change(db, actor, class_id)
    person = _person_for(db, actor, classroom, body.actor_id)
    if db.get(ClassMember, (classroom.id, person.id)) is None:
        db.add(ClassMember(class_id=classroom.id, actor_id=person.id))
        db.commit()
    return _member(person)


@router.delete("/{class_id}/members/{actor_id}", status_code=204, response_model=None)
def remove_member(
    class_id: uuid.UUID, actor_id: uuid.UUID,
    actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db),
) -> Response:
    """Take someone out of a class. Their account and their work stay; only the membership goes."""
    classroom = _class_to_change(db, actor, class_id)
    person = _person_for(db, actor, classroom, actor_id)
    membership = db.get(ClassMember, (classroom.id, person.id))
    if membership is None:
        raise HTTPException(status_code=404, detail=f"{person.display_name} is not in {classroom.name}")
    db.delete(membership)
    db.commit()
    return Response(status_code=204)


@router.post("/{class_id}/members/{actor_id}/move", response_model=MoveResponse)
def move_member(
    class_id: uuid.UUID, actor_id: uuid.UUID, body: MoveRequest,
    actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db),
) -> MoveResponse:
    """Out of this class and into another, in one commit. Both classes must be the caller's to change
    and in the same school; the student keeps their work (see the module note)."""
    source = _class_to_change(db, actor, class_id)
    target = _class_to_change(db, actor, body.to_class_id)
    if source.id == target.id:
        raise HTTPException(status_code=422, detail="Pick a different class to move to")
    if source.organisation_id != target.organisation_id:
        raise HTTPException(status_code=422, detail="Both classes must be in the same school")
    person = _person_for(db, actor, source, actor_id)
    membership = db.get(ClassMember, (source.id, person.id))
    if membership is None:
        raise HTTPException(status_code=404, detail=f"{person.display_name} is not in {source.name}")
    db.delete(membership)
    if db.get(ClassMember, (target.id, person.id)) is None:
        db.add(ClassMember(class_id=target.id, actor_id=person.id))
    try:
        db.commit()
    except IntegrityError:  # someone else changed the same membership in between
        db.rollback()
        raise HTTPException(status_code=409, detail="The class changed while moving; try again") from None
    source_row, target_row = _describe(db, [source, target])
    return MoveResponse(student=_member(person), from_class=source_row, to_class=target_row)
