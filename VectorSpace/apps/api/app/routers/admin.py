"""What the VThere Admin pages ask for: schools, the people in them, and the overview numbers.

Admin only. An admin is VThere staff and works on every school (decision D-A, 6 Nov 2026): the
School picker's "All schools" really is all of them, and "+ Add a school" creates one. There is no
school-level admin and no separate operator role. The admin's own actor row still sits in one
organisation, because every actor does, but these routes take the school from the picker or the
body, never from the admin.

Teachers and students are untouched by this: every other router still fences them to
actor.organisation_id, so nothing here widens what they can see.

Every number on these pages is a query against the tables we already have. Which asset packs a
school may use is pack_grants (GET and PATCH /admin/schools/{school}/packs); its permission
settings are school_permissions (GET and PUT /admin/schools/{school}/permissions, with the list and
defaults in app/permissions.py). The one thing no table answers yet -- which room shells a school
may use -- is not here; it stays in the browser's adminFake.ts and the page marks it as not saved.
"""

from __future__ import annotations

import csv
import re
import uuid
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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
from ..provision import ROLES, Row, logins, parse_rows, provision

router = APIRouter(prefix="/admin", tags=["admin"])

ALL_SCHOOLS = "all"


def require_admin(actor: Actor = Depends(get_current_actor)) -> Actor:
    if actor.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return actor


def _school_or_404(db: Session, school: str | uuid.UUID) -> Organisation:
    """One real school by id. A malformed id is a 404 like a missing one, not a 422."""
    try:
        org_id = school if isinstance(school, uuid.UUID) else uuid.UUID(school)
    except ValueError:
        raise HTTPException(status_code=404, detail="School not found") from None
    org = db.get(Organisation, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="School not found")
    return org


def _schools_in_scope(db: Session, school: str) -> list[Organisation]:
    """The picker's value: "all" is every school, an id is that one school."""
    if school == ALL_SCHOOLS:
        return list(db.scalars(select(Organisation).order_by(Organisation.name)))
    return [_school_or_404(db, school)]


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:200]


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
    so the reply that mints it is the only place it can be handed over. The link is never stored,
    so GET /accounts keeps AccountResponse and has no such field: a column that is always null on a
    list and sometimes set on a create is the wrong shape. A lost link is replaced, not looked up:
    POST /accounts/{id}/invite mints a fresh one."""

    # null, not "", when there is no link: DevLogins has no tenant to mint one
    invite_link: str | None = None


class SignInLinkResponse(BaseModel):
    account_id: uuid.UUID
    # null where there is no tenant to mint one (AUTH_DEV_BYPASS): a dev login needs no password
    invite_link: str | None = None


class NewAccountRequest(BaseModel):
    school_id: uuid.UUID
    name: str = Field(max_length=200)
    email: str = Field(max_length=254)
    role: str = Field(max_length=20)
    class_names: list[str] = Field(default=[], max_length=50)


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


class NewSchoolRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


@router.get("/schools", response_model=list[SchoolResponse])
def list_schools(actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> list[SchoolResponse]:
    """Every school, by name. An admin is VThere staff and sees them all (D-A)."""
    return _describe_schools(db, _schools_in_scope(db, ALL_SCHOOLS))


@router.post("/schools", response_model=SchoolResponse, status_code=201)
def add_school(
    body: NewSchoolRequest, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> SchoolResponse:
    """A new, empty school: no people and no classes, so it starts as setting_up. The slug is made
    from the name, the same identifier `python -m app.provision --school-slug` uses, so a roster
    CSV can be run against a school made here. Two schools may not share a slug."""
    name = body.name.strip()
    slug = _slug(name)
    if not slug:
        raise HTTPException(status_code=422, detail="A school name needs at least one letter or digit")
    taken = db.scalar(select(Organisation).where(Organisation.slug == slug))
    if taken is not None:
        raise HTTPException(status_code=409, detail=f"A school called {taken.name} already exists")
    org = Organisation(name=name, slug=slug)
    db.add(org)
    db.commit()
    db.refresh(org)
    return _describe_schools(db, [org])[0]


@router.get("/accounts", response_model=list[AccountResponse])
def list_accounts(
    school: str = Query(ALL_SCHOOLS),
    actor: Actor = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AccountResponse]:
    org_ids = [org.id for org in _schools_in_scope(db, school)]
    people = db.scalars(select(Actor).where(Actor.organisation_id.in_(org_ids)).order_by(Actor.display_name))
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
    org = _school_or_404(db, body.school_id)
    if body.role not in ("admin", "teacher", "student"):
        raise HTTPException(status_code=422, detail="role must be admin, teacher or student")
    email = body.email.strip().lower()
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
    if person is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if person.id == actor.id and not body.active:
        raise HTTPException(status_code=400, detail="You cannot turn off your own account")
    person.active = body.active
    db.commit()
    db.refresh(person)
    return _describe_accounts(db, [person])[0]


@router.post("/accounts/{account_id}/invite", response_model=SignInLinkResponse)
def new_sign_in_link(
    account_id: uuid.UUID, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> SignInLinkResponse:
    """A fresh one-time sign-in link for somebody who lost theirs, or forgot their password.

    Admin only (Sherman, 7 Nov): what a teacher may do for their students is not decided yet, so
    credentials come from one place. Same handling as the create reply: hand it over, never keep
    it. A turned-off account gets 409 rather than a link that would sign in to nothing.
    """
    person = db.get(Actor, account_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not person.active:
        raise HTTPException(
            status_code=409, detail=f"{person.display_name}'s account is turned off. Turn it on first."
        )
    try:
        link = logins().sign_in_link(person.auth0_subject)
    except httpx.HTTPError as error:
        # the tenant refused or was unreachable; say so rather than answer 500 with no reason
        raise HTTPException(status_code=502, detail="Auth0 did not give a sign-in link. Try again.") from error
    return SignInLinkResponse(account_id=person.id, invite_link=link or None)


# --- create accounts from a CSV (POST /admin/accounts/import) ------------------------------------

# rows per request: a class list fits easily, and each new row costs Auth0 two Management calls
IMPORT_LIMIT = 200


class ImportRequest(BaseModel):
    school_id: uuid.UUID
    # the file's text, as the CLI reads it: email,display_name,role,classes (classes split by ";")
    csv: str = Field(max_length=200_000)
    # true answers what would happen and writes nothing; the web page always asks this first
    dry_run: bool = True


class ImportRow(BaseModel):
    line: int
    email: str
    name: str
    role: str
    class_names: list[str]
    # would_create (dry run), created, skipped_exists, or error (see error)
    outcome: str
    account_id: uuid.UUID | None = None
    # created rows only, and only where there is a tenant to mint one: a credential, shown once
    invite_link: str | None = None
    error: str | None = None


class ImportResponse(BaseModel):
    school_id: uuid.UUID
    dry_run: bool
    rows: list[ImportRow]


def _row_problem(row: Row, earlier: dict[str, int]) -> str | None:
    """What is wrong with one row on its own, in a sentence; None when it can be created."""
    if not row.email:
        return "No email address"
    if "@" not in row.email or " " in row.email or len(row.email) > 320:
        return f"{row.email} is not an email address"
    if row.email in earlier:
        return f"{row.email} is already on line {earlier[row.email]} of this file"
    if not row.display_name:
        return "No display_name"
    if len(row.display_name) > 200:
        return "display_name is longer than 200 characters"
    if row.role not in ROLES:
        return f"Unknown role '{row.role}' (use {', '.join(ROLES)})"
    if any(len(name) > 200 for name in row.classes):
        return "A class name is longer than 200 characters"
    return None


@router.post("/accounts/import", response_model=ImportResponse)
def import_accounts(
    body: ImportRequest, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)
) -> ImportResponse:
    """Many accounts from one CSV, in the CLI's format (provision.parse_rows reads both).

    Differs from the CLI on purpose in two ways:
    - An address the school already has is skipped and reported, never updated. A web upload must
      not quietly change somebody's role or turn a turned-off account back on (the same reason
      POST /accounts answers 409).
    - Each row is committed on its own. If Auth0 fails on row 17, rows 1-16 are saved with their
      logins, row 17 says what went wrong, and running the same file again skips what was made.

    Classes named in the file are made in that school if they do not exist yet. The reply has one
    row per line; created rows carry their one-time link, which is shown here and nowhere else.
    """
    org = _school_or_404(db, body.school_id)
    try:
        rows = parse_rows(body.csv)
    except (ValueError, csv.Error) as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    if not rows:
        raise HTTPException(status_code=422, detail="The CSV names its columns but has nobody in it")
    if len(rows) > IMPORT_LIMIT:
        raise HTTPException(
            status_code=422, detail=f"The CSV has {len(rows)} people; split it into files of {IMPORT_LIMIT} or fewer"
        )

    known = {
        email: person_id
        for email, person_id in db.execute(select(Actor.email, Actor.id).where(Actor.organisation_id == org.id))
    }
    earlier: dict[str, int] = {}
    auth0 = None  # made on the first row to create: one Management token for the whole file
    report: list[ImportRow] = []
    for row in rows:
        result = ImportRow(
            line=row.line, email=row.email, name=row.display_name, role=row.role,
            class_names=row.classes, outcome="error",
        )
        result.error = _row_problem(row, earlier)
        earlier.setdefault(row.email, row.line)
        if result.error is not None:
            pass
        elif row.email in known:
            result.outcome, result.account_id = "skipped_exists", known[row.email]
        elif body.dry_run:
            result.outcome = "would_create"
        else:
            if auth0 is None:
                try:
                    auth0 = logins()
                except httpx.HTTPError as error:
                    # nothing is saved yet: the token is fetched before the first row is created
                    raise HTTPException(status_code=502, detail="Auth0 could not be reached. Try again.") from error
            try:
                made = provision(db, auth0, org.slug, org.name, [row])  # commits this row
            except (httpx.HTTPError, IntegrityError):
                db.rollback()
                result.error = "This login could not be made. Run the same file again: rows already made are skipped."
            else:
                person_id = db.scalar(select(Actor.id).where(Actor.organisation_id == org.id, Actor.email == row.email))
                known[row.email] = person_id
                result.outcome, result.account_id = "created", person_id
                result.invite_link = made[0][2] or None
        report.append(result)
    return ImportResponse(school_id=org.id, dry_run=body.dry_run, rows=report)


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
    orgs = _schools_in_scope(db, school)
    org_ids = [org.id for org in orgs]
    school_names = {org.id: org.name for org in orgs}
    schools = _describe_schools(db, orgs)
    people = list(db.scalars(select(Actor).where(Actor.organisation_id.in_(org_ids))))

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
            .where(Project.organisation_id.in_(org_ids), Project.kind == "project", Project.status == "published")
            .order_by(Project.updated_at.desc())
        )
    )
    drafts = db.scalar(
        select(func.count()).select_from(Project).where(
            Project.organisation_id.in_(org_ids), Project.kind == "project", Project.status == "draft"
        )
    )
    class_names = {
        c.id: c.name for c in db.scalars(select(Classroom).where(Classroom.organisation_id.in_(org_ids)))
    }

    def where(p: Project) -> str:
        school_name = school_names.get(p.organisation_id, "")
        return f"{school_name} · {class_names[p.class_id]}" if p.class_id in class_names else school_name

    recent = [PublishedItem(id=p.id, title=p.name, where=where(p), published_at=p.updated_at) for p in published[:5]]

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


def _one_school(db: Session, school: str) -> uuid.UUID:
    """A pack switch or a permission belongs to one school, so "all" is not accepted here."""
    return _school_or_404(db, school).id


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
    org_id = _one_school(db, school)
    grants = {g.pack_id: g for g in db.scalars(select(PackGrant).where(PackGrant.organisation_id == org_id))}
    packs = db.scalars(select(AssetPack).where(AssetPack.published_revision.is_not(None)).order_by(AssetPack.title))
    return [_school_pack(pack, grants.get(pack.id)) for pack in packs]


@router.patch("/schools/{school}/packs/{pack_id}", response_model=SchoolPackResponse)
def set_school_pack(
    school: str, pack_id: uuid.UUID, body: SchoolPackPatch,
    actor: Actor = Depends(require_admin), db: Session = Depends(get_db),
) -> SchoolPackResponse:
    org_id = _one_school(db, school)
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
    return _describe_permissions(db, _one_school(db, school))


@router.put("/schools/{school}/permissions", response_model=list[PermissionResponse])
def save_school_permissions(
    school: str, body: list[PermissionSetting],
    actor: Actor = Depends(require_admin), db: Session = Depends(get_db),
) -> list[PermissionResponse]:
    """Save the settings sent; a key left out keeps what it had. All or nothing: one unknown key
    and nothing is saved, so a page built against an older list cannot half-save."""
    org_id = _one_school(db, school)
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
