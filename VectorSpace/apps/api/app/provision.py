"""Roster provisioning: create school accounts from a CSV, since users never sign themselves up.

Run from apps/api (dry run by default, nothing is written until --apply):

    python -m app.provision --school-slug demo --school-name "Demo School" --csv roster.csv
    python -m app.provision --school-slug demo --csv roster.csv --apply --out invites.csv

CSV columns: email, display_name, role (admin|teacher|student), classes (semicolon-separated names).
Each new person gets an Auth0 login and a matching row in our actors table. --out receives a
one-time password-set link per new person to hand out. Re-running is safe: people already in the
school are updated, not duplicated.
"""

from __future__ import annotations

import argparse
import csv
import secrets
import sys
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Actor, ClassMember, Classroom, Organisation

ROLES = ("admin", "teacher", "student")


@dataclass
class Row:
    email: str
    display_name: str
    role: str
    classes: list[str]


class Auth0Admin:
    """The Management API calls we need. Replaced by a fake in tests.

    Scopes: create:users, create:user_tickets, and read:users for the already-exists
    fallback below. Missing read:users is invisible until a roster names somebody the
    tenant already has, and then shows up as 403 on /users-by-email.
    """

    def __init__(self) -> None:
        s = get_settings()
        self.base = f"https://{s.auth0_domain}"
        self.connection = s.auth0_connection
        token = httpx.post(
            f"{self.base}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": s.auth0_mgmt_client_id,
                "client_secret": s.auth0_mgmt_client_secret,
                "audience": f"{self.base}/api/v2/",
            },
            timeout=10.0,
        )
        token.raise_for_status()
        self.http = httpx.Client(
            base_url=f"{self.base}/api/v2",
            headers={"Authorization": f"Bearer {token.json()['access_token']}"},
            timeout=10.0,
        )

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        """Return (auth0 subject, one-time password-set link)."""
        response = self.http.post(
            "/users",
            json={
                "email": email,
                "name": display_name,
                "connection": self.connection,
                "password": secrets.token_urlsafe(24),
                "email_verified": True,
            },
        )
        if response.status_code == 409:
            response = self.http.get("/users-by-email", params={"email": email})
            response.raise_for_status()
            user = response.json()[0]
        else:
            response.raise_for_status()
            user = response.json()
        ticket = self.http.post("/tickets/password-change", json={"user_id": user["user_id"]})
        ticket.raise_for_status()
        return user["user_id"], ticket.json()["ticket"]


class DevLogins:
    """Stands in for Auth0Admin where there is no tenant: no network, no invite link.

    Hands out "dev|<local part of the email>" as the subject, which app.auth accepts as a bearer
    value while AUTH_DEV_BYPASS is on. Used by app.seed and by the admin Add an account route.
    """

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"dev|{email.split('@')[0]}", ""


def logins() -> Auth0Admin | DevLogins:
    """Whichever one this deployment can actually use."""
    return DevLogins() if get_settings().auth_dev_bypass else Auth0Admin()


def read_rows(path: str) -> list[Row]:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = [
            Row(
                email=r["email"].strip().lower(),
                display_name=r["display_name"].strip(),
                role=r["role"].strip().lower(),
                classes=[c.strip() for c in (r.get("classes") or "").split(";") if c.strip()],
            )
            for r in csv.DictReader(handle)
        ]
    bad = [r.email for r in rows if r.role not in ROLES]
    if bad:
        raise ValueError(f"Unknown role for: {', '.join(bad)} (use one of {', '.join(ROLES)})")
    return rows


def provision(
    db: Session, auth0: Auth0Admin | None, slug: str, school_name: str | None, rows: list[Row]
) -> list[tuple[str, str, str]]:
    """Return (email, outcome, invite link). With auth0=None nothing is written: a dry run."""
    org = db.scalar(select(Organisation).where(Organisation.slug == slug))
    if org is None and (school_name is None):
        raise ValueError(f"No school '{slug}' yet: pass --school-name to create it")
    if org is None and auth0 is not None:
        org = Organisation(name=school_name, slug=slug)
        db.add(org)
        db.flush()

    report = []
    for row in rows:
        existing = org and db.scalar(select(Actor).where(Actor.organisation_id == org.id, Actor.email == row.email))
        invite = ""
        if auth0 is None:
            report.append((row.email, "would update" if existing else "would create", ""))
            continue
        if existing:
            existing.role, existing.display_name, existing.active = row.role, row.display_name, True
            actor, outcome = existing, "updated"
        else:
            subject, invite = auth0.create_user(row.email, row.display_name)
            actor = Actor(
                organisation_id=org.id, auth0_subject=subject, email=row.email,
                display_name=row.display_name, role=row.role,
            )
            db.add(actor)
            db.flush()
            outcome = "created"
        for name in row.classes:
            classroom = db.scalar(select(Classroom).where(Classroom.organisation_id == org.id, Classroom.name == name))
            if classroom is None:
                classroom = Classroom(organisation_id=org.id, name=name)
                db.add(classroom)
                db.flush()
            if db.get(ClassMember, (classroom.id, actor.id)) is None:
                db.add(ClassMember(class_id=classroom.id, actor_id=actor.id))
        report.append((row.email, outcome, invite))
    if auth0 is not None:
        db.commit()
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--school-slug", required=True)
    parser.add_argument("--school-name")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--apply", action="store_true", help="actually create accounts (default: dry run)")
    parser.add_argument("--out", help="write one-time invite links here (CSV)")
    args = parser.parse_args()

    from .db import SessionLocal

    with SessionLocal() as db:
        report = provision(db, Auth0Admin() if args.apply else None, args.school_slug, args.school_name, read_rows(args.csv))
    for email, outcome, _ in report:
        print(f"{outcome:13} {email}")
    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["email", "invite_link"])
            writer.writerows((email, link) for email, _, link in report if link)
    if not args.apply:
        print("\nDry run only. Add --apply to create these accounts.", file=sys.stderr)


if __name__ == "__main__":
    main()
