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
        assert set(body) == {"title", "student_name", "class_name", "school_name", "share_with", "data", "own_project_id"}
        assert body["own_project_id"] is None  # signed out: not the owner


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


def test_visitors_see_the_approved_save_not_later_edits(client, school) -> None:
    project = approved_project(client, school, "public")
    versions = client.get(f"/projects/{project['id']}/versions", headers=as_user("s1")).json()
    current = next(v["revision"] for v in versions if v["id"] == project["current_version_id"])
    edited = {"schemaVersion": 1, "scenes": [], "note": "not reviewed"}
    saved = client.post(f"/projects/{project['id']}/versions", json={"base_revision": current, "data": edited}, headers=as_user("s1"))
    assert saved.status_code == 201, saved.text
    assert client.get(f"/visit/{project['slug']}").json()["data"] == SCENE


def _save(client, project_id: str, data: dict, key: str = "s1") -> None:
    row = client.get(f"/projects/{project_id}", headers=as_user(key)).json()
    saved = client.post(
        f"/projects/{project_id}/versions", json={"base_revision": row["current_revision"], "data": data}, headers=as_user(key)
    )
    assert saved.status_code == 201, saved.text


def test_edits_after_approval_stay_a_draft_until_the_teacher_approves_the_update(client, school) -> None:
    project = approved_project(client, school, "public")
    path, pid = f"/visit/{project['slug']}", project["id"]
    edited = {**SCENE, "scenes": [{"id": "a", "objects": [{"id": "o1"}, {"id": "o2"}]}]}

    # the student keeps editing: visitors still see the approved save
    _save(client, pid, edited)
    assert client.get(path).json()["data"] == SCENE

    # the update waits for the teacher: still the approved save, and it can be cancelled
    sent = client.post(f"/projects/{pid}/submit", json={}, headers=as_user("s1"))
    assert sent.status_code == 201, sent.text
    assert sent.json()["share_with"] == "public"  # kept from the approved hand-in
    assert client.get(path).json()["data"] == SCENE
    assert client.delete(f"/projects/{pid}/submit", headers=as_user("s1")).status_code == 204
    assert client.get(path).json()["data"] == SCENE

    # sent back: the approved save stays live
    client.post(f"/projects/{pid}/submit", json={}, headers=as_user("s1"))
    client.post(f"/projects/{pid}/send-back", json={"comment": "Add a caption"}, headers=as_user("t1"))
    assert client.get(path).json()["data"] == SCENE

    # approved: the update goes live
    client.post(f"/projects/{pid}/submit", json={}, headers=as_user("s1"))
    assert client.post(f"/projects/{pid}/approve", json={}, headers=as_user("t1")).status_code == 200
    assert client.get(path).json()["data"] == edited


def test_an_update_needs_a_change_since_approval(client, school) -> None:
    project = approved_project(client, school, "public")
    again = client.post(f"/projects/{project['id']}/submit", json={}, headers=as_user("s1"))
    assert again.status_code == 409


def test_saving_soon_after_a_hand_in_never_changes_the_handed_in_save(client, school) -> None:
    project = approved_project(client, school, "public")
    pid = project["id"]
    first = {**SCENE, "scenes": [{"id": "a", "objects": [{"id": "o2"}]}]}
    _save(client, pid, first)
    client.post(f"/projects/{pid}/submit", json={}, headers=as_user("s1"))
    client.post(f"/projects/{pid}/approve", json={}, headers=as_user("t1"))
    # within the merge window, by the same student: must be a new revision, not a rewrite
    _save(client, pid, {**SCENE, "scenes": [{"id": "a", "objects": [{"id": "o3"}]}]})
    assert client.get(f"/visit/{project['slug']}").json()["data"] == first


def test_only_the_owner_is_told_which_project_it_is(client, school) -> None:
    project = approved_project(client, school, "public")
    path = f"/visit/{project['slug']}"
    assert client.get(path, headers=as_user("s1")).json()["own_project_id"] == project["id"]
    assert client.get(path, headers=as_user("s2")).json()["own_project_id"] is None  # a classmate
    assert client.get(path, headers=as_user("t1")).json()["own_project_id"] is None  # the teacher
