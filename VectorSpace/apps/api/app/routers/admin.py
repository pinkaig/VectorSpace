"""What the VThere Admin pages ask for: schools, the people in them, and the overview numbers.

Admin only, and scoped the same way as everything else: an Actor belongs to exactly one
organisation, so an admin administers exactly one school.

That is worth saying plainly, because the admin screens were drawn for a VThere operator sitting
*above* the schools — a School picker with "All schools", and "+ Add a school". The schema has no
such person: roles are admin, teacher and student, all inside one organisation. So here "All
schools" means the one school the caller administers, and POST /admin/schools answers 501 instead
of inventing a cross-school operator. Giving VThere staff a real seat above the schools is a
schema decision (an operator role or an organisation group), not something a route can paper over.

Every number on these pages is a query against the tables we already have. Which asset packs a
school may use is pack_grants (GET and PATCH /admin/schools/{school}/packs); its permission
settings are school_permissions (GET and PUT /admin/schools/{school}/permissions, with the list and
defaults in app/permissions.py). The one thing no table answers yet -- which room shells a school
may use -- is not here; it stays in the browser's adminFake.ts and the page marks it as not saved.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import permissions
from ..auth import get_current_actor
from ..db import get_db
from ..models import (
    Actor,
    AssetPack,
    ClassMember,
    Classroom,
    Organisation,
    PackGrant,
    Project,
    SchoolPermission,
)
from ..provision import Row, logins, provision
from ._skeleton import not_implemented

router = APIRouter(prefix="/admin", tags=["admin"])

ALL_SCHOOLS = "all"


def require_admin(actor: Actor = Depends(get_current_actor)) -> Actor:
    if actor.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return actor


def _school_scope(actor: Actor, school: str) -> None:
    """The picker may send "all" or this admin's own school id; anything else is not theirs."""
    if school != ALL_SCHOOLS and school != str(actor.organisation_id):
        raise HTTPException(status_code=404, detail="School not found")


class SchoolResponse(BaseModel):
    id: uuid.UUID
    name: str
    students: int
    educators: int
    # derived, not stored: a school with at least one teacher and one student is up and running
    status: str


class AccountResponse(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    email: str
    role: str
    # a person can be in more than one class, so this is a list and not a single name
    class_names: list[str]
    last_active: datetime | None
    # turned_off when the account is switched off, invited until the first sign-in, then active
    status: str


class CreatedAccountResponse(AccountResponse):
    """The create reply only. Auth0 mints a single-use password-set link and nothing emails it,
    so the one request that mints it is the only place it can be handed over. A ticket cannot be
    re-minted on demand, so GET /accounts keeps AccountResponse and has no such field: a column
    that is always null on a list and sometimes set on a create is the wrong shape."""

    # null, not "", when there is no link: DevLogins has no tenant to mint one
    invite_link: str | None = None


class NewAccountRequest(BaseModel):
    school_id: uuid.UUID
    name: str
    email: str
    role: str
    class_names: list[str] = []


class AccountPatchRequest(BaseModel):
    active: bool


class Tile(BaseModel):
    value: int
    sub: str


class AttentionItem(BaseModel):
    id: str
    text: str
    action_label: str
    # which admin page fixes it, or null when no page does
    go_to: str | None


class PublishedItem(BaseModel):
    id: uuid.UUID
    title: str
    where: str
    published_at: datetime | None


class OverviewResponse(BaseModel):
    tiles: dict[str, Tile]
    schools: list[SchoolResponse]
    attention: list[AttentionItem]
    recent: list[PublishedItem]


def _describe_schools(db: Session, orgs: list[Organisation]) -> list[SchoolResponse]:
    counts = {
        (org_id, role): total
        for org_id, role, total in db.execute(
            select(Actor.organisation_id, Actor.role, func.count())
            .where(Actor.organisation_id.in_([o.id for o in orgs]))
            .group_by(Actor.organisation_id, Actor.role)
        ).all()
    }
    rows = []
    for org in orgs:
        students = counts.get((org.id, "student"), 0)
        teachers = counts.get((org.id, "teacher"), 0)
        rows.append(
            SchoolResponse(
                id=org.id, name=org.name, students=students, educators=teachers,
                status="active" if students and teachers else "setting_up",
            )
        )
    return rows


def _account_status(actor: Actor) -> str:
    if not actor.active:
        return "turned_off"
    return "active" if actor.last_seen_at else "invited"


def _describe_accounts(db: Session, people: list[Actor]) -> list[AccountResponse]:
    """The people plus the classes they are in: one extra query for the lot."""
    classes: dict[uuid.UUID, list[str]] = {}
    for actor_id, name in db.execute(
        select(ClassMember.actor_id, Classroom.name)
        .join(Classroom, Classroom.id == ClassMember.class_id)
        .where(ClassMember.actor_id.in_([p.id for p in people]))
        .order_by(Classroom.name)
    ).all():
        classes.setdefault(actor_id, []).append(name)
    return [
        AccountResponse(
            id=p.id, school_id=p.organisation_id, name=p.display_name, email=p.email, role=p.role,
            class_names=classes.get(p.id, []), last_active=p.last_seen_at, status=_account_status(p),
        )
        for p in people
    ]


@router.get("/schools", response_model=list[SchoolResponse])
def list_schools(actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> list[SchoolResponse]:
    """One school: the caller's own. See this module's note on why there is no list above it."""
    org = db.get(Organisation, actor.organisation_id)
    return _describe_schools(db, [org] if org else [])


@router.post("/schools", status_code=501)
def add_school(actor: Actor = Depends(require_admin)) -> None:
    raise not_implemented(
        "Adding a school needs a VThere operator role above the schools, which the data model does "
        "not have yet: an admin belongs to one school. Create schools with "
        "python -m app.provision --school-slug <slug> --school-name <name> for now."
    )


@router.get("/accounts", response_model=list[AccountResponse])
def list_accounts(
    school: str = Query(ALL_SCHOOLS),
    actor: Actor = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AccountResponse]:
    _school_scope(actor, school)
    people = db.scalars(
        select(Actor).where(Actor.organisation_id == actor.organisation_id).order_by(Actor.display_name)
    )
    return _describe_accounts(db, list(people))


@router.post("/accounts", response_model=CreatedAccountResponse, status_code=201)
def add_account(
    body: NewAccountRequest, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> CreatedAccountResponse:
    """The same provisioning path as the CSV tool and the seed: a login, an actor row, its classes.

    Nobody signs themselves up, so creating an account means creating a login first. With
    AUTH_DEV_BYPASS the login is a local "dev|..." stand-in; otherwise it is a real Auth0 user.

    The reply carries that login's one-time password-set link, which is the only way in: nothing
    emails it, because create_user marks the address verified on purpose so that roster addresses
    need not be real ones. Hand it over and do not keep it -- it is a credential, so it is never
    logged, never stored and never put in a URL.
    """
    if body.school_id != actor.organisation_id:
        raise HTTPException(status_code=404, detail="School not found")
    if body.role not in ("admin", "teacher", "student"):
        raise HTTPException(status_code=422, detail="role must be admin, teacher or student")
    email = body.email.strip().lower()
    org = db.get(Organisation, actor.organisation_id)
    # provision() updates somebody it already knows rather than failing, which is what a re-run of
    # a corrected roster needs and the wrong thing for a form: it would quietly rewrite the
    # person's role and display name, turn a deliberately disabled account back on, and answer 201
    # with no link. This route serves one person at a time, so here a known address is a mistake
    # worth naming. The fix belongs here and not in provision(), whose idempotence the CSV tool is
    # promised in its docstring.
    taken = db.scalar(select(Actor).where(Actor.organisation_id == org.id, Actor.email == email))
    if taken is not None:
        raise HTTPException(
            status_code=409, detail=f"{email} already belongs to {taken.display_name} ({taken.role})"
        )
    row = Row(email=email, display_name=body.name.strip(), role=body.role, classes=body.class_names)
    report = provision(db, logins(), org.slug, org.name, [row])
    person = db.scalar(select(Actor).where(Actor.organisation_id == org.id, Actor.email == email))
    # report is (email, outcome, link) per row; an empty link means there was no tenant to mint one
    invite_link = next((link for _, _, link in report if link), None)
    return CreatedAccountResponse(
        **_describe_accounts(db, [person])[0].model_dump(), invite_link=invite_link
    )


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
def set_account_active(
    account_id: uuid.UUID,
    body: AccountPatchRequest,
    actor: Actor = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AccountResponse:
    """Turn an account off or back on. Accounts are never deleted; their work would go with them."""
    person = db.get(Actor, account_id)
    if person is None or person.organisation_id != actor.organisation_id:
        raise HTTPException(status_code=404, detail="Account not found")
    if person.id == actor.id and not body.active:
        raise HTTPException(status_code=400, detail="You cannot turn off your own account")
    person.active = body.active
    db.commit()
    db.refresh(person)
    return _describe_accounts(db, [person])[0]


def _attention(db: Session, schools: list[SchoolResponse], never_signed_in: int) -> list[AttentionItem]:
    """Only things a query can actually show. No invented reports or asset-pack announcements."""
    items: list[AttentionItem] = []
    for school in schools:
        if school.status == "setting_up":
            missing = "teachers" if not school.educators else "students"
            items.append(
                AttentionItem(
                    id=f"setting-up-{school.id}", text=f"{school.name} has no {missing} yet",
                    action_label="Add accounts", go_to="accounts",
                )
            )
        if not db.scalar(
            select(func.count()).select_from(Classroom).where(Classroom.organisation_id == school.id)
        ):
            items.append(
                AttentionItem(
                    id=f"no-classes-{school.id}", text=f"{school.name} has no classes yet",
                    action_label="Add accounts", go_to="accounts",
                )
            )
    if never_signed_in:
        items.append(
            AttentionItem(
                id="never-signed-in",
                text=f"{never_signed_in} {'person has' if never_signed_in == 1 else 'people have'} never signed in",
                action_label="See who", go_to="accounts",
            )
        )
    return items


@router.get("/overview", response_model=OverviewResponse)
def get_overview(
    school: str = Query(ALL_SCHOOLS),
    actor: Actor = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OverviewResponse:
    """The four numbers, the schools table, what needs an admin, and what was published recently."""
    _school_scope(actor, school)
    org_id = actor.organisation_id
    schools = _describe_schools(db, [db.get(Organisation, org_id)])
    people = list(db.scalars(select(Actor).where(Actor.organisation_id == org_id)))

    week_ago = datetime.now(UTC) - timedelta(days=7)
    teachers = [p for p in people if p.role == "teacher"]
    students = [p for p in people if p.role == "student"]
    # last_seen_at is stored with a timezone, but SQLite hands it back naive; compare in UTC either way
    seen = lambda p: p.last_seen_at and (p.last_seen_at if p.last_seen_at.tzinfo else p.last_seen_at.replace(tzinfo=UTC))
    active_this_week = sum(1 for p in students if (when := seen(p)) and when >= week_ago)
    never = sum(1 for p in people if p.active and p.last_seen_at is None)

    published = list(
        db.scalars(
            select(Project)
            .where(Project.organisation_id == org_id, Project.kind == "project", Project.status == "published")
            .order_by(Project.updated_at.desc())
        )
    )
    drafts = db.scalar(
        select(func.count()).select_from(Project).where(
            Project.organisation_id == org_id, Project.kind == "project", Project.status == "draft"
        )
    )
    class_names = {c.id: c.name for c in db.scalars(select(Classroom).where(Classroom.organisation_id == org_id))}
    school_name = schools[0].name if schools else ""
    recent = [
        PublishedItem(
            id=p.id, title=p.name,
            where=f"{school_name} · {class_names[p.class_id]}" if p.class_id in class_names else school_name,
            published_at=p.updated_at,
        )
        for p in published[:5]
    ]

    return OverviewResponse(
        tiles={
            "schools": Tile(value=len(schools), sub=f"{sum(1 for s in schools if s.status == 'active')} active"),
            "educators": Tile(value=len(teachers), sub=f"{sum(1 for p in teachers if p.last_seen_at is None)} not signed in yet"),
            "students": Tile(value=len(students), sub=f"{active_this_week} active this week"),
            "published": Tile(value=len(published), sub=f"{drafts} still drafts"),
        },
        schools=schools,
        attention=_attention(db, schools, never),
        recent=recent,
    )


class SchoolPackResponse(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    kind: str
    item_count: int
    revision: int
    enabled: bool


class SchoolPackPatch(BaseModel):
    enabled: bool


def _own_school(actor: Actor, school: str) -> uuid.UUID:
    """A pack switch belongs to one school, so "all" is not accepted here, only this admin's own."""
    if school != str(actor.organisation_id):
        raise HTTPException(status_code=404, detail="School not found")
    return actor.organisation_id


def _school_pack(pack: AssetPack, grant: PackGrant | None) -> SchoolPackResponse:
    return SchoolPackResponse(
        id=pack.id, slug=pack.slug, title=pack.title, description=pack.description, kind=pack.kind,
        item_count=len(pack.items), revision=pack.published_revision or 0,
        enabled=grant is not None and grant.enabled,
    )


@router.get("/schools/{school}/packs", response_model=list[SchoolPackResponse])
def list_school_packs(
    school: str, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> list[SchoolPackResponse]:
    """Every published pack, and whether this school has it switched on. A draft is not listed:
    a school must never be offered a pack whose manifest is not in the bucket yet."""
    org_id = _own_school(actor, school)
    grants = {g.pack_id: g for g in db.scalars(select(PackGrant).where(PackGrant.organisation_id == org_id))}
    packs = db.scalars(select(AssetPack).where(AssetPack.published_revision.is_not(None)).order_by(AssetPack.title))
    return [_school_pack(pack, grants.get(pack.id)) for pack in packs]


@router.patch("/schools/{school}/packs/{pack_id}", response_model=SchoolPackResponse)
def set_school_pack(
    school: str, pack_id: uuid.UUID, body: SchoolPackPatch,
    actor: Actor = Depends(require_admin), db: Session = Depends(get_db),
) -> SchoolPackResponse:
    org_id = _own_school(actor, school)
    pack = db.get(AssetPack, pack_id)
    if pack is None or pack.published_revision is None:
        raise HTTPException(status_code=404, detail="Pack not found")
    grant = db.get(PackGrant, (org_id, pack_id))
    if grant is None:
        grant = PackGrant(organisation_id=org_id, pack_id=pack_id, enabled=body.enabled, granted_by_id=actor.id)
        db.add(grant)
    else:
        grant.enabled = body.enabled
        grant.granted_by_id = actor.id
    db.commit()
    db.refresh(grant)
    return _school_pack(pack, grant)


class PermissionResponse(BaseModel):
    key: str
    group: str
    label: str
    students: bool
    educators: bool
    can_adjust: bool
    # false = saved and shown, but no route checks it yet (app/permissions.py ENFORCED)
    enforced: bool


class PermissionSetting(BaseModel):
    key: str = Field(min_length=1, max_length=50)
    students: bool
    educators: bool
    can_adjust: bool = False


def _describe_permissions(db: Session, org_id: uuid.UUID) -> list[PermissionResponse]:
    return [
        PermissionResponse(
            key=e.setting.key, group=e.setting.group, label=e.setting.label, students=e.students,
            educators=e.educators, can_adjust=e.can_adjust, enforced=e.setting.key in permissions.ENFORCED,
        )
        for e in permissions.for_school(db, org_id)
    ]


@router.get("/schools/{school}/permissions", response_model=list[PermissionResponse])
def list_school_permissions(
    school: str, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> list[PermissionResponse]:
    """Every setting for one school, saved or default, in the order the page shows them."""
    return _describe_permissions(db, _own_school(actor, school))


@router.put("/schools/{school}/permissions", response_model=list[PermissionResponse])
def save_school_permissions(
    school: str, body: list[PermissionSetting],
    actor: Actor = Depends(require_admin), db: Session = Depends(get_db),
) -> list[PermissionResponse]:
    """Save the settings sent; a key left out keeps what it had. All or nothing: one unknown key
    and nothing is saved, so a page built against an older list cannot half-save."""
    org_id = _own_school(actor, school)
    unknown = sorted({row.key for row in body} - permissions.BY_KEY.keys())
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown permission setting: {', '.join(unknown)}")
    for row in body:
        saved = db.get(SchoolPermission, (org_id, row.key))
        if saved is None:
            saved = SchoolPermission(organisation_id=org_id, key=row.key)
            db.add(saved)
        saved.students, saved.educators, saved.can_adjust = row.students, row.educators, row.can_adjust
        saved.updated_by_id = actor.id
    db.commit()
    return _describe_permissions(db, org_id)
