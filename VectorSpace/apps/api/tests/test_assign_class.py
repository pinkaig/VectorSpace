# Template setup's "Assign to <class>" over HTTP: one copy per student, once, and only by a teacher of that class


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


BRIEF = {"due": "2026-11-20", "todos": [{"id": "t1", "text": "Place three exhibits"}], "rules": [{"id": "r1", "text": "Label every exhibit"}]}


def template(client) -> str:
    reply = client.post("/projects", json={"name": "Museum hall", "kind": "template"}, headers=as_user("t1"))
    assert reply.status_code == 201
    return reply.json()["id"]


def test_assigning_sends_each_student_one_copy(client, school) -> None:
    project_id = template(client)
    body = {"class_id": str(school["class1"].id), "mission_brief": BRIEF, "task": "Build a museum of your hobby", "due_at": "2026-11-20"}

    first = client.post(f"/projects/{project_id}/assign-class", json=body, headers=as_user("t1"))
    assert first.status_code == 200
    assert first.json()["students"] == 2 and first.json()["sent"] == 2  # s1 and s2 are in 1A

    # assigning again updates the brief on the same assignment and sends nobody a second copy
    again = client.post(f"/projects/{project_id}/assign-class", json={**body, "task": "Changed"}, headers=as_user("t1"))
    assert again.json() == {**first.json(), "sent": 0}

    copies = client.get("/projects", params={"mine": "true"}, headers=as_user("s1")).json()
    assert len(copies) == 1


def test_only_a_teacher_of_that_class_may_assign(client, school) -> None:
    project_id = template(client)
    to_1a = {"class_id": str(school["class1"].id)}
    assert client.post(f"/projects/{project_id}/assign-class", json=to_1a, headers=as_user("s1")).status_code == 403
    assert client.post(f"/projects/{project_id}/assign-class", json={"class_id": str(school["class2"].id)}, headers=as_user("t1")).status_code == 403
