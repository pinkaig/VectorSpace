"""Save history is checkpoints, not every autosave: quick saves by one person merge into one
revision, and only the newest revisions (plus labelled ones) are kept."""

import uuid
from datetime import timedelta

from sqlalchemy import select

from apps.api.app.models import ContentSnapshot, ProjectVersion
from apps.api.app.routers import publish

SCENE = {"schemaVersion": 1, "id": "p", "name": "Scene", "scenes": []}


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def make(client, key, name="p", **extra):
    response = client.post("/projects", json={"name": name, **extra}, headers=as_user(key))
    assert response.status_code == 201, response.text
    return response.json()


def save(client, key, project, n, base):
    return client.post(
        f"/projects/{project['id']}/versions",
        json={"base_revision": base, "data": {**SCENE, "name": f"Scene {n}"}},
        headers=as_user(key),
    )


def revisions(client, key, project) -> list[int]:
    return [v["revision"] for v in client.get(f"/projects/{project['id']}/versions", headers=as_user(key)).json()]


def test_quick_saves_by_the_same_person_are_one_revision_holding_the_latest(client, school, db) -> None:
    project = make(client, "s1")
    for n in range(5):
        reply = save(client, "s1", project, n, base=0 if n == 0 else 1)
        assert reply.status_code == 201 and reply.json()["revision"] == 1
    assert revisions(client, "s1", project) == [1]
    latest = client.get(f"/projects/{project['id']}", headers=as_user("s1")).json()["current_version_id"]
    data = client.get(f"/projects/{project['id']}/versions/{latest}", headers=as_user("s1")).json()["data"]
    assert data["name"] == "Scene 4"
    # the replaced content is gone, not left behind
    assert len(db.scalars(select(ContentSnapshot)).all()) == 1


def test_a_save_after_the_window_starts_a_new_revision(client, school, db) -> None:
    project = make(client, "s1")
    save(client, "s1", project, 0, base=0)
    first = db.scalar(select(ProjectVersion))
    first.created_at = first.created_at - publish.MERGE_WINDOW - timedelta(seconds=1)
    db.commit()
    assert save(client, "s1", project, 1, base=1).json()["revision"] == 2
    assert revisions(client, "s1", project) == [2, 1]


def test_a_labelled_or_someone_elses_revision_is_never_merged_into(client, school) -> None:
    template = make(client, "t1", "Lesson", kind="template")
    client.post(f"/projects/{template['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("t1"))
    copy = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    # revision 1 is "Sent by t1": the student's first save is a new revision, and later quick ones merge into that
    assert save(client, "s1", copy, 0, base=1).json()["revision"] == 2
    assert save(client, "s1", copy, 1, base=2).json()["revision"] == 2
    assert revisions(client, "s1", copy) == [2, 1]


def test_only_the_newest_revisions_and_labelled_ones_are_kept(client, school, db, monkeypatch) -> None:
    monkeypatch.setattr(publish, "MERGE_WINDOW", timedelta(0))
    monkeypatch.setattr(publish, "KEEP_REVISIONS", 3)
    template = make(client, "t1", "Lesson", kind="template")
    client.post(f"/projects/{template['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("t1"))
    copy = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    for n in range(6):
        save(client, "s1", copy, n, base=n + 1)
    # revisions 2-7 were the student's; the newest 3 stay, and "Sent by" (revision 1) is kept
    assert revisions(client, "s1", copy) == [7, 6, 5, 1]
    kept = {v.content_snapshot_id for v in db.scalars(select(ProjectVersion).where(ProjectVersion.project_id == uuid.UUID(copy["id"])))}
    stored = {s.id for s in db.scalars(select(ContentSnapshot).where(ContentSnapshot.project_id == uuid.UUID(copy["id"])))}
    assert stored == kept
