"""The public sign-in carousel: only published museums a class teacher switched on, and only
what a card shows."""


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


SCENE = {
    "schemaVersion": 1,
    "scenes": [
        {"id": "a", "objects": [{"id": "o1"}, {"id": "o2"}, {"id": "o3", "parentId": "o1"}]},
        {"id": "b", "objects": [{"id": "o4"}]},
    ],
}


def published_museum(client, school, key="s1", name="Pyramids"):
    """A student's museum in class 1A (t1's class), saved once and published."""
    project = client.post("/projects", json={"name": name, "class_id": str(school["class1"].id)}, headers=as_user(key)).json()
    client.post(f"/projects/{project['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user(key))
    client.patch(f"/projects/{project['id']}", json={"status": "published"}, headers=as_user(key))
    return project


def show(client, key, project, on=True):
    return client.patch(f"/projects/{project['id']}", json={"showcase": on}, headers=as_user(key))


def test_nothing_is_shown_until_a_teacher_switches_it_on(client, school) -> None:
    published_museum(client, school)
    assert client.get("/showcase").json() == []


def test_the_class_teacher_puts_a_published_museum_on_the_page_without_signing_anyone_in(client, school) -> None:
    project = published_museum(client, school)
    assert show(client, "t1", project).json()["showcase"] is True
    shown = client.get("/showcase")  # no Authorization header: the sign-in page is public
    assert shown.status_code == 200
    (card,) = shown.json()
    assert card["title"] == "Pyramids" and card["student_name"] == "s1" and card["class_name"] == "1A"
    assert card["school_name"] == "A"
    assert (card["exhibit_count"], card["room_count"]) == (3, 2)  # o3 sits on o1, so it is not its own exhibit
    assert set(card) == {"title", "student_name", "class_name", "school_name", "exhibit_count", "room_count", "updated_at"}


def test_only_teachers_of_its_class_or_admins_may_switch_it(client, school) -> None:
    project = published_museum(client, school)
    assert show(client, "s1", project).status_code == 403  # not the student, even the owner
    assert show(client, "t2", project).status_code == 404  # t2 teaches 2B and cannot see it
    assert show(client, "admin", project).status_code == 200


def test_a_draft_cannot_be_shown_and_unpublishing_takes_it_off(client, school) -> None:
    draft = client.post("/projects", json={"name": "Draft", "class_id": str(school["class1"].id)}, headers=as_user("s1")).json()
    assert show(client, "t1", draft).status_code == 409
    project = published_museum(client, school)
    show(client, "t1", project)
    client.patch(f"/projects/{project['id']}", json={"status": "draft"}, headers=as_user("s1"))
    assert client.get("/showcase").json() == []
