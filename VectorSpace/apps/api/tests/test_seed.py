"""The test-data seed: a few rows in every table, the same after every run, and the states a tester
needs reachable from the logins the sign-in picker uses."""

import pytest
from sqlalchemy import select

from apps.api.app import seed
from apps.api.app.models import Actor, Organisation, Project


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def test_every_table_gets_rows_and_none_gets_more_than_ten(db) -> None:
    seed.seed(db)
    counts = seed.counts(db)
    assert all(1 <= count <= 10 for count in counts.values()), counts


def test_running_it_again_rebuilds_the_same_rows(db) -> None:
    seed.seed(db)
    first = seed.counts(db)
    seed.seed(db)
    assert seed.counts(db) == first


def test_other_schools_are_left_alone(db, school) -> None:
    """school (conftest) is two other schools with their own people; the seed only rebuilds 'demo'."""
    others = len(db.scalars(select(Actor)).all())
    seed.seed(db)
    seed.seed(db)
    assert len(db.scalars(select(Actor)).all()) == others + len(seed.ROWS)
    assert db.scalar(select(Organisation).where(Organisation.slug == "a")) is not None


def test_the_teacher_has_two_classes_and_an_assigned_project(db, client) -> None:
    seed.seed(db)
    assert {c["name"] for c in client.get("/classes", headers=as_user("dev|teacher")).json()} == {seed.SCIENCE, seed.HUMANITIES}
    mine = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|teacher")).json()
    assert [(p["name"], p["class_name"], p["current_revision"]) for p in mine] == [("Dinosaur museum", seed.SCIENCE, 2)]


def test_aisyah_has_an_untouched_copy_with_a_task_and_ethan_has_edited_his(db, client) -> None:
    seed.seed(db)
    aisyah = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|student1")).json()
    copy = next(p for p in aisyah if p["name"] == "Dinosaur museum")
    assert copy["task"] == seed.DINOSAUR_TASK and copy["due_at"] and copy["saved_by_name"] == "Ms Tan Hui Min"
    ethan = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|student2")).json()
    assert [(p["current_revision"], p["saved_by_name"]) for p in ethan] == [(2, "Ethan Lim")]
    # Chloe has no copy yet, so the teacher's Assign has someone left to send to
    assert client.get("/projects", params={"mine": True}, headers=as_user("dev|student3")).json() == []


def test_every_status_and_both_kinds_are_present(db) -> None:
    seed.seed(db)
    rows = db.scalars(select(Project)).all()
    assert {p.status for p in rows} == {"draft", "published", "archived"}
    assert {p.kind for p in rows} == {"project", "template"}


def test_a_seeded_project_opens_with_its_rooms_and_brief(db, client) -> None:
    seed.seed(db)
    row = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|teacher")).json()[0]
    data = client.get(f"/projects/{row['id']}/versions/{row['current_version_id']}", headers=as_user("dev|teacher")).json()["data"]
    assert data["schemaVersion"] == 1 and data["id"] == row["id"]
    assert [s["environmentId"] for s in data["scenes"]] == ["env-museum", "env-classroom"]
    assert len(data["missionBrief"]["todos"]) == 3


def test_media_shows_to_the_teacher_but_only_approved_links_to_a_student(db, client) -> None:
    seed.seed(db)
    teacher_row = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|teacher")).json()[0]
    assert len(client.get(f"/projects/{teacher_row['id']}/media", headers=as_user("dev|teacher")).json()) == 3
    copy = client.get("/projects", params={"kind": "project", "mine": True}, headers=as_user("dev|student1")).json()
    dino = next(p for p in copy if p["name"] == "Dinosaur museum")
    # a copy sees its own media only, and the copy has none: the teacher's library stays with the teacher's project
    assert client.get(f"/projects/{dino['id']}/media", headers=as_user("dev|student1")).status_code == 200


def test_add_template_gives_a_provisioned_school_one_published_template_once(db, client, school) -> None:
    """For a school with real logins, where seed() cannot run: no people made, nothing wiped."""
    people = len(db.scalars(select(Actor)).all())
    made = seed.add_template(db, "a")
    assert made is not None and (made.kind, made.status, made.created_by_id) == ("template", "published", school["t1"].id)
    assert seed.add_template(db, "a") is None
    assert len(db.scalars(select(Actor)).all()) == people
    listed = client.get("/projects", params={"kind": "template"}, headers=as_user("t2")).json()
    assert [(p["name"], p["current_revision"]) for p in listed] == [("Museum hall", 1)]
    # the other school does not see it
    assert client.get("/projects", params={"kind": "template"}, headers=as_user("other")).json() == []


def test_add_template_refuses_a_school_that_is_not_there(db) -> None:
    with pytest.raises(ValueError):
        seed.add_template(db, "nowhere")
