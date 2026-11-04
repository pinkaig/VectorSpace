"""Explain a 403 from /me: walk the roster the way the API does, one layer at a time.

check_auth0.py stops at "the token is valid but no roster row matches this login". This picks
the story up there, on our side of the line, and says which of the four things is actually
wrong: no school, no row for that person, a row whose auth0_subject belongs to a different
login (the usual one, left behind by the seeded dev| subjects), or a row that is switched off.

Run from apps/api (the .venv must be active, or call .venv\\Scripts\\python.exe):

    python scripts/check_roster.py                          # what the database holds
    python scripts/check_roster.py --csv roster.csv          # also: who in the CSV is missing
    python scripts/check_roster.py --token <access_token>    # also: why this login fails
    python scripts/check_roster.py --subject auth0|abc --email ada@school.edu
    python scripts/check_roster.py --token <t> --relink      # repair that row's subject

Layers: 1 database, 2 schools, 3 the CSV against the database, 4 the login's own row,
5 what that row may see, 6 the repair.

Nothing is written unless --relink --apply is passed, and --relink only ever moves one subject
onto one existing row: it never creates a person. Creating people is app.provision's job.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# make `app` importable no matter where the script is launched from
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.access import class_ids, visible_projects  # noqa: E402
from app.auth import decode_token, reset_jwks_cache  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.models import Actor, Classroom, Organisation, Project  # noqa: E402
from app.provision import read_rows  # noqa: E402

failures = 0


def report(ok: bool | None, label: str, detail: str = "") -> None:
    """ok=None prints a note that is neither a pass nor a failure."""
    global failures
    if ok is False:
        failures += 1
    tag = {True: "ok  ", False: "FAIL", None: "note"}[ok]
    print(f"[{tag}] {label}" + (f" -- {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n== {title}")


def safe_url(url: str) -> str:
    """The database URL without its password, so this output can be pasted into a chat."""
    if "://" not in url or "@" not in url:
        return url
    scheme, rest = url.split("://", 1)
    credentials, host = rest.split("@", 1)
    user = credentials.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}" if ":" in credentials else url


def check_database(settings) -> Session | None:
    section("1. Database")
    report(None, "URL", safe_url(settings.sqlalchemy_database_url))
    try:
        from app.db import SessionLocal

        db = SessionLocal()
        db.execute(select(func.now()))
    except SQLAlchemyError as exc:
        report(False, "connects", f"{str(exc).splitlines()[0]} (is the dev stack up? see README)")
        return None
    except Exception as exc:  # a bad URL fails while the engine is built, before any query
        report(False, "engine built", str(exc).splitlines()[0])
        return None
    report(True, "connects")
    try:
        db.scalar(select(func.count()).select_from(Organisation.__table__))
    except SQLAlchemyError as exc:
        report(False, "migrations have run", f"{str(exc).splitlines()[0]} -- run `alembic upgrade head`")
        return None
    report(True, "migrations have run")
    return db


def check_schools(db: Session) -> None:
    section("2. Schools")
    orgs = list(db.scalars(select(Organisation).order_by(Organisation.slug)))
    if not orgs:
        report(False, "at least one school exists", "run app.provision with --school-name to create one")
        return
    for org in orgs:
        counts = dict(
            db.execute(
                select(Actor.role, func.count())
                .where(Actor.organisation_id == org.id)
                .group_by(Actor.role)
            ).all()
        )
        classes = db.scalar(
            select(func.count()).select_from(Classroom.__table__).where(Classroom.organisation_id == org.id)
        )
        off = db.scalar(
            select(func.count())
            .select_from(Actor.__table__)
            .where(Actor.organisation_id == org.id, Actor.active.is_(False))
        )
        people = ", ".join(f"{n} {role}" for role, n in sorted(counts.items())) or "no people"
        report(True, f"{org.slug} ({org.name})", f"{people}; {classes} class(es)" + (f"; {off} switched off" if off else ""))


def check_csv(db: Session, path: str, slug: str | None) -> None:
    section(f"3. {path} against the database")
    try:
        rows = read_rows(path)
    except (OSError, ValueError, KeyError) as exc:
        report(False, "CSV reads", f"{exc} (columns: email, display_name, role, classes)")
        return
    report(True, "CSV reads", f"{len(rows)} row(s)")

    org = db.scalar(select(Organisation).where(Organisation.slug == slug)) if slug else None
    if slug and org is None:
        report(False, f"school '{slug}' exists", "pass the slug you provisioned, or create it with app.provision")
        return

    missing, present = [], []
    for row in rows:
        query = select(Actor).where(Actor.email == row.email)
        if org is not None:
            query = query.where(Actor.organisation_id == org.id)
        actor = db.scalar(query)
        (present if actor else missing).append(row.email)
        if actor and actor.role != row.role:
            report(False, f"{row.email} role matches the CSV",
                   f"database says {actor.role}, CSV says {row.role}: re-run provision --apply")
    report(
        not missing,
        f"every row has an account{f' in {slug}' if slug else ''}",
        f"{len(present)} present, missing: {', '.join(missing)}" if missing else f"all {len(present)}",
    )
    if missing:
        print("       create them with: python -m app.provision --school-slug <slug> --csv "
              f"{path} --apply --out invites.csv")


def identify(args) -> tuple[str | None, str | None]:
    """The (subject, email) this run is asking about, from a token or from the flags."""
    flag_email = (args.email or "").strip().lower() or None
    if not args.token:
        return args.subject, flag_email

    section("4a. The token")
    reset_jwks_cache()
    try:
        claims = decode_token(args.token)
    except Exception as exc:  # HTTPException carries the reason in .detail
        report(False, "token accepted by the API's own validator",
               f"{getattr(exc, 'detail', exc)} -- an Auth0 problem, not a roster one: run check_auth0.py")
        return None, flag_email
    subject = claims.get("sub")
    token_email = (claims.get("email") or "").strip().lower() or None
    report(True, "token accepted", f"sub={subject}")
    report(token_email is not None, "token carries an email claim",
           token_email or "none: pass --email so a row can still be matched by address")
    return subject, token_email or flag_email


def check_login(db: Session, subject: str | None, email: str | None) -> Actor | None:
    """The same lookup get_current_actor makes, with the near misses spelled out."""
    section("4. The login's own row (what get_current_actor does)")
    if not subject:
        report(None, "skipped", "pass --token, or --subject auth0|...")
        return None

    actor = db.scalar(select(Actor).where(Actor.auth0_subject == subject))
    if actor is not None:
        report(True, "a row matches this subject", f"{actor.email} ({actor.role}) in {actor.organisation.slug}")
        report(actor.active, "the row is switched on",
               "" if actor.active else "active=false: /me returns 403 until an admin re-enables it")
        return actor if actor.active else None

    report(False, "a row matches this subject", f"no actor has auth0_subject = {subject}")
    others = list(db.scalars(select(Actor).where(Actor.email == email))) if email else []
    if others:
        for other in others:
            kind = ("a seeded dev| subject, which a real tenant never issues"
                    if other.auth0_subject.startswith("dev|") else "a different Auth0 login")
            report(False, f"{other.email} in {other.organisation.slug} carries another subject",
                   f"{other.auth0_subject} -- {kind}")
        print("       the row exists, only its subject is stale: add --relink to move this subject onto it")
    elif email:
        report(False, f"any row for {email}", "this person was never provisioned: app.provision creates them")
    else:
        report(None, "cannot look the row up by address",
               "pass --email to tell a stale subject from a missing person")
    return None


def check_visibility(db: Session, actor: Actor) -> None:
    section("5. What that row may see")
    ids = class_ids(db, actor)
    names = list(db.scalars(select(Classroom.name).where(Classroom.id.in_(ids)))) if ids else []
    report(True, "classes", ", ".join(names) if names else "none (a teacher with no class sees only their own work)")
    visible = db.scalar(select(func.count()).select_from(visible_projects(db, actor).subquery()))
    own = db.scalar(select(func.count()).select_from(Project.__table__).where(Project.created_by_id == actor.id))
    report(True, "projects visible to this login", f"{visible} ({own} of them their own)")
    if not visible:
        report(None, "the roster is fine but the school is empty",
               "demo content comes from app.seed_content, not from provision")


def relink(db: Session, subject: str, email: str | None, apply: bool) -> None:
    section("6. Repair")
    if not email:
        report(False, "--relink needs an address", "pass --email, or use a token that carries an email claim")
        return
    rows = list(db.scalars(select(Actor).where(Actor.email == email)))
    if len(rows) != 1:
        report(False, "exactly one row to move the subject onto",
               f"{len(rows)} row(s) for {email}: fix this by hand, a guess here would hand someone "
               "the wrong account")
        return
    actor = rows[0]
    if actor.auth0_subject == subject:
        report(True, "already linked", "nothing to do")
        return
    if not apply:
        report(None, f"would set {email} -> {subject}",
               f"currently {actor.auth0_subject}; add --apply to write it")
        return
    before = actor.auth0_subject
    actor.auth0_subject = subject
    db.commit()
    report(True, f"{email} now answers to {subject}", f"was {before}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", help="a roster CSV to compare against the database")
    parser.add_argument("--school-slug", help="restrict the CSV comparison to one school")
    parser.add_argument("--token", help="an access token for the API (APIs > your API > Test tab)")
    parser.add_argument("--subject", help="an Auth0 subject, if you have no token")
    parser.add_argument("--email", help="the address to match a row by, when the token has no email claim")
    parser.add_argument("--relink", action="store_true", help="move the subject onto that address's row")
    parser.add_argument("--apply", action="store_true", help="with --relink, actually write it")
    args = parser.parse_args()

    db = check_database(get_settings())
    if db is None:
        print("\nStopped at the database: nothing after layer 1 can be checked without it.")
        return 1
    with db:
        check_schools(db)
        if args.csv:
            check_csv(db, args.csv, args.school_slug)
        subject, email = identify(args)
        actor = check_login(db, subject, email)
        if actor is not None:
            check_visibility(db, actor)
        if args.relink and subject:
            relink(db, subject, email, args.apply)

    print(f"\n{'All checks passed.' if not failures else f'{failures} check(s) failed.'}")
    return 1 if failures else 0


sys.exit(main())
