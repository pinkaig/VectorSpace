"""Who can see what. These are the tests that keep one school, class or student out of another's work."""


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def make(client, key, name="p", **extra):
    response = client.post("/projects", json={"name": name, **extra}, headers=as_user(key))
    assert response.status_code == 201, response.text
    return response.json()


def test_me_returns_role_and_classes(client, school) -> None:
    body = client.get("/me", headers=as_user("t1")).json()
    assert body["role"] == "teacher"
    assert body["class_ids"] == [str(school["class1"].id)]


def test_unknown_login_is_rejected(client, school) -> None:
    assert client.get("/me", headers=as_user("nobody")).status_code == 403


def test_deactivated_user_is_rejected(client, school, db) -> None:
    school["s1"].active = False
    db.commit()
    assert client.get("/me", headers=as_user("s1")).status_code == 403


def test_student_sees_only_own_projects(client, school) -> None:
    mine = make(client, "s1", "mine", class_id=str(school["class1"].id))
    make(client, "s2", "theirs", class_id=str(school["class1"].id))
    listed = client.get("/projects", headers=as_user("s1")).json()
    assert [p["id"] for p in listed] == [mine["id"]]


def test_student_cannot_open_a_classmates_project(client, school) -> None:
    theirs = make(client, "s2", class_id=str(school["class1"].id))
    assert client.get(f"/projects/{theirs['id']}", headers=as_user("s1")).status_code == 404


def test_teacher_sees_own_classes_only(client, school) -> None:
    in_class = make(client, "s1", class_id=str(school["class1"].id))
    other_class = make(client, "s3", class_id=str(school["class2"].id))
    assert client.get(f"/projects/{in_class['id']}", headers=as_user("t1")).status_code == 200
    assert client.get(f"/projects/{other_class['id']}", headers=as_user("t1")).status_code == 404


def test_teacher_can_read_but_not_edit_a_students_project(client, school) -> None:
    project = make(client, "s1", class_id=str(school["class1"].id))
    response = client.patch(f"/projects/{project['id']}", json={"name": "x"}, headers=as_user("t1"))
    assert response.status_code == 403


def test_admin_sees_whole_school_but_not_another(client, school) -> None:
    project = make(client, "s3", class_id=str(school["class2"].id))
    assert client.get(f"/projects/{project['id']}", headers=as_user("admin")).status_code == 200
    assert client.get(f"/projects/{project['id']}", headers=as_user("other")).status_code == 404
    assert client.get("/projects", headers=as_user("other")).json() == []


def test_student_cannot_file_work_under_a_class_they_are_not_in(client, school) -> None:
    response = client.post(
        "/projects", json={"name": "p", "class_id": str(school["class2"].id)}, headers=as_user("s1")
    )
    assert response.status_code == 403


def test_teacher_moves_a_project_into_one_of_their_classes(client, school) -> None:
    project = make(client, "t1")
    response = client.patch(f"/projects/{project['id']}", json={"class_id": str(school["class1"].id)}, headers=as_user("t1"))
    assert response.status_code == 200, response.text
    assert response.json()["class_name"] == "1A"


def test_teacher_cannot_move_a_project_into_a_class_they_are_not_in(client, school) -> None:
    project = make(client, "t1")
    response = client.patch(f"/projects/{project['id']}", json={"class_id": str(school["class2"].id)}, headers=as_user("t1"))
    assert response.status_code == 403


def test_students_cannot_create_templates(client, school) -> None:
    response = client.post("/projects", json={"name": "t", "kind": "template"}, headers=as_user("s1"))
    assert response.status_code == 403


def test_template_is_visible_to_school_and_copied_with_provenance(client, school, db) -> None:
    from uuid import UUID

    from apps.api.app.models import ContentSnapshot, Project, ProjectVersion

    template = make(client, "t1", "Lesson", kind="template")
    snapshot = ContentSnapshot(project_id=UUID(template["id"]), data={"objects": [1, 2]}, checksum="c1")
    db.add(snapshot)
    db.flush()
    version = ProjectVersion(
        project_id=UUID(template["id"]), revision=3, created_by_id=school["t1"].id, content_snapshot_id=snapshot.id
    )
    db.add(version)
    db.flush()
    db.get(Project, UUID(template["id"])).current_version_id = version.id
    db.commit()

    assert client.get(f"/projects/{template['id']}", headers=as_user("s3")).status_code == 404  # still a draft
    client.patch(f"/projects/{template['id']}", json={"status": "published"}, headers=as_user("t1"))
    assert client.get(f"/projects/{template['id']}", headers=as_user("s3")).status_code == 200
    assert client.get(f"/projects/{template['id']}", headers=as_user("other")).status_code == 404

    # students copy templates only where the school allows it (test_permissions.py)
    allow = [{"key": "from-templates", "students": True, "educators": True}]
    client.put(f"/admin/schools/{school['admin'].organisation_id}/permissions", json=allow, headers=as_user("admin"))
    copy = make(client, "s1", "My lesson", template_id=template["id"])
    assert copy["kind"] == "project"
    assert copy["template_id"] == template["id"]
    assert copy["template_revision"] == 3
    assert copy["current_version_id"] is not None
    assert client.get("/projects?kind=template", headers=as_user("s1")).json()[0]["id"] == template["id"]


def test_students_cannot_edit_templates(client, school) -> None:
    template = make(client, "t1", kind="template")
    client.patch(f"/projects/{template['id']}", json={"status": "published"}, headers=as_user("t1"))
    response = client.patch(f"/projects/{template['id']}", json={"name": "x"}, headers=as_user("s1"))
    assert response.status_code == 403

def test_copies_of_the_same_name_are_numbered(client, school) -> None:
    names = [make(client, "s1", "Space station")["name"] for _ in range(3)]
    assert names == ["Space station", "Space station (2)", "Space station (3)"]
    assert make(client, "s2", "Space station")["name"] == "Space station"  # numbering is per person


def test_teacher_sends_a_template_to_a_student(client, school) -> None:
    template = make(client, "t1", "Gallery walk", kind="template")
    client.post(f"/projects/{template['id']}/versions", json={"base_revision": 0, "data": {"schemaVersion": 1}}, headers=as_user("t1"))
    client.patch(f"/projects/{template['id']}", json={"status": "published"}, headers=as_user("t1"))
    sent = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1"))
    assert sent.status_code == 201, sent.text
    body = sent.json()
    assert (body["created_by_name"], body["template_id"], body["class_name"]) == (school["s1"].display_name, template["id"], "1A")
    assert (body["saved_by_name"], body["template_name"]) == (school["t1"].display_name, "Gallery walk")
    # it is now the student's own project, in their list
    assert [p["id"] for p in client.get("/projects?mine=true", headers=as_user("s1")).json()] == [body["id"]]


def test_sending_marks_the_project_sent_and_files_the_copy_under_its_assignment(client, school) -> None:
    project = make(client, "t1", "Lesson")
    assert project["sent"] is False
    copy = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    again = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s2"].id)}, headers=as_user("t1")).json()
    assert copy["assignment_id"] and copy["assignment_id"] == again["assignment_id"]  # one assignment per class
    assert client.get(f"/projects/{project['id']}", headers=as_user("t1")).json()["sent"] is True

def test_assigning_saves_the_task_and_due_date_and_the_latest_assign_wins(client, school) -> None:
    project = make(client, "t1", "Lesson")
    first = client.post(
        f"/projects/{project['id']}/assign",
        json={"student_id": str(school["s1"].id), "task": "Place 3 exhibits", "due_at": "2026-11-06"},
        headers=as_user("t1"),
    ).json()
    assert (first["task"], first["due_at"]) == ("Place 3 exhibits", "2026-11-06")
    # assigning again with a new due date updates the copy already sent; the task left out stays as it was
    client.post(
        f"/projects/{project['id']}/assign",
        json={"student_id": str(school["s2"].id), "due_at": "2026-11-13"},
        headers=as_user("t1"),
    )
    again = client.get(f"/projects/{first['id']}", headers=as_user("s1")).json()
    assert (again["task"], again["due_at"]) == ("Place 3 exhibits", "2026-11-13")
    # the teacher's own project shows the same due date (the home uses it for the archive rule)
    assert client.get(f"/projects/{project['id']}", headers=as_user("t1")).json()["due_at"] == "2026-11-13"

def test_a_draft_nobody_was_sent_can_be_deleted_with_its_saves(client, school) -> None:
    project = make(client, "t1", "Scratch")
    client.post(f"/projects/{project['id']}/versions", json={"base_revision": 0, "data": {"schemaVersion": 1}}, headers=as_user("t1"))
    assert client.delete(f"/projects/{project['id']}", headers=as_user("t1")).status_code == 204
    assert client.get(f"/projects/{project['id']}", headers=as_user("t1")).status_code == 404


def test_only_unsent_drafts_can_be_deleted(client, school) -> None:
    published = make(client, "t1", "Shown")
    client.patch(f"/projects/{published['id']}", json={"status": "published"}, headers=as_user("t1"))
    assert client.delete(f"/projects/{published['id']}", headers=as_user("t1")).status_code == 409

    sent = make(client, "t1", "Given out")
    copy = client.post(f"/projects/{sent['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    assert client.delete(f"/projects/{sent['id']}", headers=as_user("t1")).status_code == 409
    # the student's copy of assigned work is not theirs to delete either
    assert client.delete(f"/projects/{copy['id']}", headers=as_user("s1")).status_code == 409


def test_nobody_deletes_someone_elses_project(client, school) -> None:
    project = make(client, "s1", "Mine", class_id=str(school["class1"].id))
    assert client.delete(f"/projects/{project['id']}", headers=as_user("t1")).status_code == 403  # sees it through the class
    assert client.delete(f"/projects/{project['id']}", headers=as_user("s2")).status_code == 404
    assert client.delete(f"/projects/{project['id']}", headers=as_user("s1")).status_code == 204


def test_send_is_refused_for_students_and_other_classes(client, school) -> None:
    project = make(client, "t1", "Lesson")
    assert client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s2"].id)}, headers=as_user("s1")).status_code == 403
    outsider = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s3"].id)}, headers=as_user("t1"))
    assert outsider.status_code == 403
