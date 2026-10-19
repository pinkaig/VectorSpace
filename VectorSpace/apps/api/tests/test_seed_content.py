"""The demo seed: same every time, safe to repeat, and it puts every state worth testing on the
two logins the sign-in picker can reach (dev|teacher and dev|student1)."""

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


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def test_repeating_the_seed_adds_nothing(db, seeded) -> None:
    templates, created = seeded()
    total = len(db.scalars(select(Project)).all())
    assert templates == 6 and total == templates + created
    assert seeded() == (6, 0)
    assert len(db.scalars(select(Project)).all()) == total


def test_everyone_has_one_project_and_the_two_dev_logins_have_more(db, seeded) -> None:
    """The point of the shape: nobody's list is empty, and the depth is where a tester can reach it."""
    seeded()
    owned: dict[str, int] = {}
    for project in db.scalars(select(Project).where(Project.kind == "project")):
        owner = db.get(Actor, project.created_by_id)
        owned[owner.email] = owned.get(owner.email, 0) + 1
    assert owned["teacher@demo.test"] == 3  # a long draft, a published one, an archived one
    assert owned["student1@demo.test"] == 4  # her own two, plus the two Ms Tan sent
    others = [count for email, count in owned.items() if email not in {"teacher@demo.test", "student1@demo.test"}]
    assert others and set(others) == {1}


def test_each_role_sees_what_the_landing_pages_need(db, seeded, client) -> None:
    seeded()
    student = client.get("/projects", params={"limit": 200}, headers=as_user("dev|student1"))
    kinds = {p["kind"] for p in student.json()}
    assert kinds == {"project", "template"}
    assert all(p["created_by_name"] == "Aisyah Rahman" for p in student.json() if p["kind"] == "project")
    teacher = client.get("/projects", params={"kind": "project"}, headers=as_user("dev|teacher"))
    assert int(teacher.headers["X-Total-Count"]) > len(
        client.get("/projects", params={"mine": True, "kind": "project"}, headers=as_user("dev|teacher")).json()
    )
    assert len(client.get("/classes", headers=as_user("dev|admin")).json()) == 5


def test_every_status_is_present_so_a_filter_has_something_to_find(db, seeded, client) -> None:
    seeded()
    for status in ("draft", "published", "archived"):
        reply = client.get("/projects", params={"kind": "project", "status": status, "limit": 200}, headers=as_user("dev|admin"))
        assert reply.json(), f"no seeded project is {status}"


def test_aisyah_has_a_sent_copy_she_has_not_touched(db, seeded, client) -> None:
    """The journey proof: the teacher sent it, the student has not saved it, and the history says so."""
    seeded()
    mine = client.get("/projects", params={"mine": True, "kind": "project"}, headers=as_user("dev|student1")).json()
    sent = [p for p in mine if p["current_revision"] == 1 and p["saved_by_name"] == "Ms Tan Hui Min"]
    assert len(sent) == 2, "expected two copies sent by the teacher"
    versions = client.get(f"/projects/{sent[0]['id']}/versions", headers=as_user("dev|student1")).json()
    assert [v["label"] for v in versions] == ["Sent by Ms Tan Hui Min"]
    assert {p["name"] for p in sent} == {"Gallery walk", "Gallery walk (2)"}


def test_a_seeded_project_loads_with_a_scene(db, seeded, client) -> None:
    seeded()
    row = next(
        p
        for p in client.get("/projects", params={"kind": "project"}, headers=as_user("dev|student1")).json()
        if p["current_version_id"]
    )
    version = client.get(f"/projects/{row['id']}/versions/{row['current_version_id']}", headers=as_user("dev|student1")).json()
    assert version["data"]["schemaVersion"] == 1 and len(version["data"]["scenes"]) == 1 and row["current_revision"] >= 1
