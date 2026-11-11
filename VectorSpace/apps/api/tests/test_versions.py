"""Saving and loading a project's scene: numbered revisions, with a refusal when two people collide.

Merging quick saves is off here, so every changed save is its own revision; test_save_history.py
covers merging and trimming."""

from datetime import timedelta

import pytest
from apps.api.app.routers import publish


@pytest.fixture(autouse=True)
def every_save_is_a_revision(monkeypatch) -> None:
    monkeypatch.setattr(publish, "MERGE_WINDOW", timedelta(0))


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def make(client, key, name="p", **extra):
    response = client.post("/projects", json={"name": name, **extra}, headers=as_user(key))
    assert response.status_code == 201, response.text
    return response.json()


SCENE = {"schemaVersion": 1, "id": "p", "name": "Scene", "scenes": []}


def save(client, key, project, data=SCENE, base=0):
    return client.post(
        f"/projects/{project['id']}/versions", json={"base_revision": base, "data": data}, headers=as_user(key)
    )


def test_first_save_is_revision_one_and_loads_back(client, school) -> None:
    project = make(client, "s1")
    saved = save(client, "s1", project)
    assert saved.status_code == 201 and saved.json()["revision"] == 1
    assert client.get(f"/projects/{project['id']}", headers=as_user("s1")).json()["current_version_id"] == saved.json()["id"]
    loaded = client.get(f"/projects/{project['id']}/versions/{saved.json()['id']}", headers=as_user("s1")).json()
    assert loaded["data"] == SCENE


def test_each_change_is_a_new_revision_and_newest_is_listed_first(client, school) -> None:
    project = make(client, "s1")
    save(client, "s1", project)
    second = save(client, "s1", project, data={**SCENE, "name": "Renamed"}, base=1)
    assert second.json()["revision"] == 2
    listed = client.get(f"/projects/{project['id']}/versions", headers=as_user("s1")).json()
    assert [v["revision"] for v in listed] == [2, 1]


def test_saving_unchanged_content_adds_no_revision(client, school) -> None:
    project = make(client, "s1")
    first = save(client, "s1", project).json()
    again = save(client, "s1", project, base=1)
    assert again.status_code == 201 and again.json()["id"] == first["id"]
    assert len(client.get(f"/projects/{project['id']}/versions", headers=as_user("s1")).json()) == 1


def test_stale_save_is_refused_with_the_current_revision(client, school) -> None:
    project = make(client, "s1")
    save(client, "s1", project)
    save(client, "s1", project, data={**SCENE, "name": "B"}, base=1)
    stale = save(client, "s1", project, data={**SCENE, "name": "C"}, base=1)
    assert stale.status_code == 409 and stale.json()["detail"]["current_revision"] == 2


def test_teacher_cannot_save_into_a_students_project_but_can_read_it(client, school) -> None:
    project = make(client, "s1", class_id=str(school["class1"].id))
    saved = save(client, "s1", project).json()
    assert save(client, "t1", project, base=1).status_code == 403
    assert client.get(f"/projects/{project['id']}/versions/{saved['id']}", headers=as_user("t1")).status_code == 200


def test_other_school_cannot_see_versions(client, school) -> None:
    project = make(client, "s1")
    saved = save(client, "s1", project).json()
    assert client.get(f"/projects/{project['id']}/versions", headers=as_user("other")).status_code == 404
    assert client.get(f"/projects/{project['id']}/versions/{saved['id']}", headers=as_user("other")).status_code == 404


def test_content_without_a_schema_version_is_rejected(client, school) -> None:
    project = make(client, "s1")
    assert save(client, "s1", project, data={"name": "no version"}).status_code == 422


def test_a_student_copy_of_a_template_starts_at_the_templates_content(client, school) -> None:
    template = make(client, "t1", "tpl", kind="template")
    save(client, "t1", template)
    client.patch(f"/projects/{template['id']}", json={"status": "published"}, headers=as_user("t1"))
    # students copy templates only where the school allows it (test_permissions.py)
    allow = [{"key": "from-templates", "students": True, "educators": True}]
    client.put(f"/admin/schools/{school['admin'].organisation_id}/permissions", json=allow, headers=as_user("admin"))
    copy = make(client, "s1", template_id=template["id"], class_id=str(school["class1"].id))
    assert copy["template_revision"] == 1
    listed = client.get(f"/projects/{copy['id']}/versions", headers=as_user("s1")).json()
    assert [v["revision"] for v in listed] == [1]
