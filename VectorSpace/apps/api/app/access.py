"""Who may see or change what. Every project route goes through here, never the UI.

Rules: admins see their whole school; teachers see their own projects and those in
their classes; students see only their own; anyone in the school can read templates.
Nothing is ever visible across schools.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from .models import Actor, ClassMember, Project


def class_ids(db: Session, actor: Actor) -> list[uuid.UUID]:
    return list(db.scalars(select(ClassMember.class_id).where(ClassMember.actor_id == actor.id)))


def visible_projects(db: Session, actor: Actor) -> Select[tuple[Project]]:
    query = select(Project).where(Project.organisation_id == actor.organisation_id)
    if actor.role == "admin":
        return query
    conditions = [Project.kind == "template", Project.created_by_id == actor.id]
    if actor.role == "teacher":
        conditions.append(Project.class_id.in_(class_ids(db, actor)))
    return query.where(or_(*conditions))


def can_read(db: Session, actor: Actor, project: Project) -> bool:
    return db.scalar(visible_projects(db, actor).where(Project.id == project.id)) is not None


def can_write(actor: Actor, project: Project) -> bool:
    if project.organisation_id != actor.organisation_id:
        return False
    if actor.role == "admin":
        return True
    if project.kind == "template":
        return actor.role == "teacher"
    return project.created_by_id == actor.id
