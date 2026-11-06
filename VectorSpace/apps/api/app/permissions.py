"""Per-school permission settings: the list of settings, their defaults, and the one check routes call.

What a setting is. One row on the admin Permissions page: a key, two switches (may students do
it, may educators do it) and can_adjust (educators may change it for their own classes later;
stored, but nothing per class reads it yet). A school with no saved row for a key gets the
default below, so a new school works before an admin has opened the page.

Where the rule is kept. In the API, never only in the browser: a route calls allowed() and answers
403, and the browser asks GET /permissions/mine only to hide the buttons that would be refused.
Hiding is a courtesy; the 403 is the rule.

Admins are always allowed. Admin is VThere staff (decision D-A), and a setting an admin could lock
themselves out of would need a second admin to undo it.

Enforced or not. Only keys in ENFORCED are checked by a route today. The rest are saved and shown,
and the page says they are not enforced yet, so nobody believes a switch does more than it does.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Actor, SchoolPermission


@dataclass(frozen=True)
class Setting:
    key: str
    group: str
    label: str
    students: bool
    educators: bool
    can_adjust: bool


# The defaults are the ones the admin page showed before there was a table (src/api/adminFake.ts).
SETTINGS: tuple[Setting, ...] = (
    Setting("more-rooms", "Building", "Add more rooms (up to 5 per project)", True, True, False),
    Setting("publish-no-approval", "Sharing", "Publish without approval", False, True, False),
    Setting("public-links", "Sharing", "Public links", False, True, True),
    Setting("unlisted-links", "Sharing", "Unlisted links", True, True, True),
    Setting("signin-links", "Sharing", "Sign-in only links", True, True, False),
    # starting a new project as a copy of a template: POST /projects with template_id. Students
    # default to no: they get their projects when a teacher assigns one, not by copying on their own
    Setting("from-templates", "Projects and data", "Set up projects from templates", False, True, False),
    Setting("edit-after-assign", "Projects and data", "Edit a project after assigning", False, True, True),
    Setting("see-results", "Projects and data", "See visitor results", False, False, False),
    Setting("delete-published", "Projects and data", "Delete published projects", False, False, False),
)
BY_KEY = {setting.key: setting for setting in SETTINGS}

# the keys some route checks; add a key here in the same change as the route that checks it
ENFORCED = frozenset({"from-templates"})


@dataclass(frozen=True)
class Effective:
    """One setting as it stands for one school: the saved row, or the default."""

    setting: Setting
    students: bool
    educators: bool
    can_adjust: bool


def _effective(setting: Setting, row: SchoolPermission | None) -> Effective:
    if row is None:
        return Effective(setting, setting.students, setting.educators, setting.can_adjust)
    return Effective(setting, row.students, row.educators, row.can_adjust)


def for_school(db: Session, organisation_id: uuid.UUID) -> list[Effective]:
    saved = {
        row.key: row
        for row in db.scalars(select(SchoolPermission).where(SchoolPermission.organisation_id == organisation_id))
    }
    return [_effective(setting, saved.get(setting.key)) for setting in SETTINGS]


def _allows(effective: Effective, role: str) -> bool:
    if role == "admin":
        return True
    return effective.educators if role == "teacher" else effective.students


def mine(db: Session, actor: Actor) -> dict[str, bool]:
    """Every key, and whether the caller's role may do it in the caller's school."""
    return {e.setting.key: _allows(e, actor.role) for e in for_school(db, actor.organisation_id)}


def allowed(db: Session, actor: Actor, key: str) -> bool:
    if actor.role == "admin":
        return True
    row = db.get(SchoolPermission, (actor.organisation_id, key))
    return _allows(_effective(BY_KEY[key], row), actor.role)
