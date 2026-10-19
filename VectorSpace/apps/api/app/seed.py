"""Local demo data: one school with an admin, three teachers, 24 students, five classes, six
templates, and one project each plus a handful of extra states on dev|teacher and dev|student1,
so a landing page has rows to list and a tester can reach every state worth seeing.

Sign in as dev|admin, dev|teacher (Ms Tan), dev|teacher2, dev|teacher3 or dev|student1 (Aisyah) ... dev|student24.

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

from sqlalchemy import select

from .config import get_settings
from .models import Actor
from .provision import DevLogins, Row, provision
from .seed_content import seed_content

SLUG, SCHOOL = "demo", "Demo School"

# student1 is Aisyah in Ms Tan's first class, so "teacher sends to Aisyah" works straight after seeding
CLASSES = ["1A Science", "1B Science", "2A Humanities", "2B Humanities", "Art Club"]
STUDENT_NAMES = [
    "Aisyah Rahman", "Ethan Lim", "Chloe Tan", "Ben Carter", "Dmitri Volkov", "Elena Rossi",
    "Farid Haddad", "Grace Okafor", "Hiro Tanaka", "Isla McBride", "Jamal Brooks", "Keiko Mori",
    "Liam O'Neill", "Mei Lin Chua", "Noah Schmidt", "Olivia Reyes", "Priya Nair", "Quentin Dubois",
    "Rosa Alvarez", "Sam Whitaker", "Tariq Aziz", "Uma Patel", "Victor Lindqvist", "Wei Jie Ong",
]

# the logins keep their old keys (dev|teacher, dev|student1 ...); only the people behind them have real names
ROWS = [
    Row("admin@demo.test", "Jasmine Ong (VThere)", "admin", []),
    Row("teacher@demo.test", "Ms Tan Hui Min", "teacher", ["1A Science", "2A Humanities", "Art Club"]),
    Row("teacher2@demo.test", "Mr Rahim Ismail", "teacher", ["1B Science", "2B Humanities"]),
    Row("teacher3@demo.test", "Ms Maria Santos", "teacher", ["1A Science", "2B Humanities", "Art Club"]),
] + [
    Row(
        f"student{n}@demo.test", name, "student",
        [CLASSES[(n - 1) % 5]] + ([CLASSES[(n + 1) % 5]] if n % 3 == 1 else []),
    )
    for n, name in enumerate(STUDENT_NAMES, start=1)
]


def main() -> None:
    apply = "--apply" in sys.argv[1:]
    if not get_settings().auth_dev_bypass:
        sys.exit("Refusing to seed: set AUTH_DEV_BYPASS=true (local only). These logins would not work otherwise.")

    from .db import SessionLocal

    with SessionLocal() as db:
        report = provision(db, DevLogins() if apply else None, SLUG, SCHOOL, ROWS)
        if apply:
            people = {a.email: a for a in db.scalars(select(Actor))}
            templates, projects = seed_content(
                db,
                [people[r.email] for r in ROWS if r.role == "teacher"],
                [people[r.email] for r in ROWS if r.role == "student"],
            )
            print(f"{templates} templates, {projects} new projects")
    for email, outcome, _ in report:
        print(f"{outcome:13} {email}  (bearer: dev|{email.split('@')[0]})")
    if not apply:
        print("\nDry run only. Add --apply to write these.", file=sys.stderr)


if __name__ == "__main__":
    main()
