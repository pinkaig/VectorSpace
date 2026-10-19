"""The big demo seed: same every time, safe to repeat, and every project it makes can be opened."""

import pytest
from sqlalchemy import select

from apps.api.app import seed
from apps.api.app.models import Actor, Project
from apps.api.app.provision import provision
from apps.api.app.seed_content import seed_content


@pytest.fixture
def seeded(db):
    def run() -> tuple[int, int]:
        provision(db, seed.DevLogins(), seed.SLUG, seed.SCHOOL, seed.ROWS)
        people = {a.email: a for a in db.scalars(select(Actor))}
        return seed_content(
            db,
            [people[r.email] for r in seed.ROWS if r.role == "teacher"],
            [people[r.email] for r in seed.ROWS if r.role == "student"],
        )

    return run


def test_seed_is_large_and_repeating_it_adds_nothing(db, seeded) -> None:
    templates, created = seeded()
    total = len(db.scalars(select(Project)).all())
    assert templates == 6 and created > 50 and total == templates + created
    assert seeded() == (6, 0)
    assert len(db.scalars(select(Project)).all()) == total


def test_each_role_sees_what_the_landing_pages_need(db, seeded, client) -> None:
    seeded()
    as_user = lambda key: {"Authorization": f"Bearer {key}"}
    student = client.get("/projects", params={"limit": 200}, headers=as_user("dev|student1"))
    kinds = {p["kind"] for p in student.json()}
    assert kinds == {"project", "template"}
    assert all(p["created_by_name"] == "Aisyah Rahman" for p in student.json() if p["kind"] == "project")
    teacher = client.get("/projects", params={"kind": "project"}, headers=as_user("dev|teacher"))
    assert int(teacher.headers["X-Total-Count"]) > len(client.get("/projects", params={"mine": True, "kind": "project"}, headers=as_user("dev|teacher")).json())
    assert len(client.get("/classes", headers=as_user("dev|admin")).json()) == 5


def test_a_seeded_project_loads_with_a_scene(db, seeded, client) -> None:
    seeded()
    row = next(p for p in client.get("/projects", params={"kind": "project"}, headers={"Authorization": "Bearer dev|student1"}).json() if p["current_version_id"])
    version = client.get(f"/projects/{row['id']}/versions/{row['current_version_id']}", headers={"Authorization": "Bearer dev|student1"}).json()
    assert version["data"]["schemaVersion"] == 1 and len(version["data"]["scenes"]) == 1 and row["current_revision"] >= 1
