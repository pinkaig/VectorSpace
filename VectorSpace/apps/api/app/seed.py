"""Local demo data: one school, one admin, one teacher, two students and two classes.

Run from apps/api with AUTH_DEV_BYPASS=true (dry run by default, nothing is written until --apply):

    python -m app.seed
    python -m app.seed --apply

This is the same code path as app.provision; the only difference is who creates the login. Here a
local stand-in hands out "dev|<name>" subjects, which the API accepts as a bearer value while
AUTH_DEV_BYPASS is on. With a real Auth0 tenant, app.provision creates the logins instead and
nothing else changes. Re-running is safe.
"""

from __future__ import annotations

import sys

from .config import get_settings
from .provision import Row, provision

SLUG, SCHOOL = "demo", "Demo School"

ROWS = [
    Row("admin@demo.test", "Demo Admin", "admin", []),
    Row("teacher@demo.test", "Demo Teacher", "teacher", ["Demo Class"]),
    Row("student1@demo.test", "Demo Student One", "student", ["Demo Class"]),
    Row("student2@demo.test", "Demo Student Two", "student", ["Other Class"]),
]


class DevLogins:
    """Stands in for Auth0Admin: no network, no invite link."""

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"dev|{email.split('@')[0]}", ""


def main() -> None:
    apply = "--apply" in sys.argv[1:]
    if not get_settings().auth_dev_bypass:
        sys.exit("Refusing to seed: set AUTH_DEV_BYPASS=true (local only). These logins would not work otherwise.")

    from .db import SessionLocal

    with SessionLocal() as db:
        report = provision(db, DevLogins() if apply else None, SLUG, SCHOOL, ROWS)
    for email, outcome, _ in report:
        print(f"{outcome:13} {email}  (bearer: dev|{email.split('@')[0]})")
    if not apply:
        print("\nDry run only. Add --apply to write these.", file=sys.stderr)


if __name__ == "__main__":
    main()
