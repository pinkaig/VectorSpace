"""The visitor's page (#/visit/<slug>): only published projects, and only for who the student chose."""

SCENE = {"schemaVersion": 1, "scenes": [{"id": "a", "objects": [{"id": "o1"}]}]}


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def approved_project(client, school, share_with: str | None) -> dict:
    """t1 sends s1 a saved copy (class 1A); s1 hands it in choosing share_with; t1 approves it."""
    lesson = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    client.post(f"/projects/{lesson['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("t1"))
    copy = client.post(f"/projects/{lesson['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    body = {"share_with": share_with} if share_with else {}
    client.post(f"/projects/{copy['id']}/submit", json=body, headers=as_user("s1"))
    approved = client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1"))
    assert approved.status_code == 200, approved.text
    return client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()


def test_a_public_or_unlisted_project_opens_without_signing_in(client, school) -> None:
    for choice in ("public", "unlisted"):
        project = approved_project(client, school, choice)
        visit = client.get(f"/visit/{project['slug']}")
        assert visit.status_code == 200, visit.text
        body = visit.json()
        assert body["data"] == SCENE and body["share_with"] == choice
        assert (body["student_name"], body["class_name"], body["school_name"]) == ("s1", "1A", "A")
        assert set(body) == {"title", "student_name", "class_name", "school_name", "share_with", "data"}


def test_class_only_needs_a_sign_in_from_the_class(client, school) -> None:
    project = approved_project(client, school, "sign_in_only")
    path = f"/visit/{project['slug']}"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=as_user("s2")).status_code == 200  # a classmate
    assert client.get(path, headers=as_user("t1")).status_code == 200  # the class teacher
    assert client.get(path, headers=as_user("admin")).status_code == 200
    assert client.get(path, headers=as_user("s3")).status_code == 404  # another class
    assert client.get(path, headers=as_user("other")).status_code == 404  # another school


def test_no_choice_on_record_counts_as_class_only(client, school) -> None:
    project = approved_project(client, school, None)
    assert client.get(f"/visit/{project['slug']}").status_code == 401


def test_a_project_waiting_for_the_teacher_says_so_to_who_may_visit(client, school) -> None:
    lesson = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    client.post(f"/projects/{lesson['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("t1"))
    for choice, signed_out in (("public", 409), ("sign_in_only", 401)):
        copy = client.post(f"/projects/{lesson['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
        client.post(f"/projects/{copy['id']}/submit", json={"share_with": choice}, headers=as_user("s1"))
        path = f"/visit/{copy['slug']}"
        assert client.get(path).status_code == signed_out
        assert client.get(path, headers=as_user("s2")).status_code == 409  # a classmate
        if choice == "sign_in_only":
            assert client.get(path, headers=as_user("s3")).status_code == 404  # another class: not even "waiting"


def test_a_draft_or_unknown_link_is_not_found(client, school) -> None:
    draft = client.post("/projects", json={"name": "Draft"}, headers=as_user("s1")).json()
    client.post(f"/projects/{draft['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("s1"))
    assert client.get(f"/visit/{draft['slug']}", headers=as_user("s1")).status_code == 404
    assert client.get("/visit/nothing-here").status_code == 404


def test_visits_are_counted_for_the_teachers_results(client, school) -> None:
    project = approved_project(client, school, "public")
    path = f"/visit/{project['slug']}"
    client.get(path)  # signed out
    client.get(path)  # the page asking twice: one visit
    client.get(path, headers=as_user("s2"))  # a classmate
    client.get(path, headers=as_user("s2"))  # the same classmate again soon after: one visit
    client.get(path, headers=as_user("s1"))  # the owner: not counted

    assert client.get("/analytics/visits", headers=as_user("s1")).status_code == 403
    rows = client.get("/analytics/visits?days=7", headers=as_user("t1")).json()
    assert rows == [{"project_id": project["id"], "visits": 2, "last_7_days": [0, 0, 0, 0, 0, 0, 2]}]
    assert client.get("/analytics/visits", headers=as_user("other")).json() == []  # another school
