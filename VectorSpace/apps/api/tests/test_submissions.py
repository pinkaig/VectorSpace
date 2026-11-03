"""Hand-in and review: a student sends their assigned museum, the teacher approves or sends it back."""

SCENE = {"schemaVersion": 1, "scenes": []}


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def assigned_copy(client, school) -> dict:
    """t1 makes and saves a project and sends s1 their own copy of it."""
    project = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    client.post(f"/projects/{project['id']}/versions", json={"base_revision": 0, "data": SCENE}, headers=as_user("t1"))
    copy = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1"))
    assert copy.status_code == 201, copy.text
    return copy.json()


def submit(client, copy, key="s1", **body):
    return client.post(f"/projects/{copy['id']}/submit", json=body, headers=as_user(key))


def save(client, copy, data: dict, key="s1") -> dict:
    """Saves data as the next revision of the copy; returns the saved version."""
    detail = client.get(f"/projects/{copy['id']}", headers=as_user(key)).json()
    versions = client.get(f"/projects/{copy['id']}/versions", headers=as_user(key)).json()
    current = next((v["revision"] for v in versions if v["id"] == detail["current_version_id"]), 0)
    saved = client.post(f"/projects/{copy['id']}/versions", json={"base_revision": current, "data": data}, headers=as_user(key))
    assert saved.status_code == 201, saved.text
    return saved.json()


def test_submit_then_approve_publishes_it(client, school) -> None:
    copy = assigned_copy(client, school)
    sent = submit(client, copy, share_with="public")
    assert sent.status_code == 201, sent.text
    assert (sent.json()["status"], sent.json()["share_with"]) == ("waiting", "public")

    approved = client.post(f"/projects/{copy['id']}/approve", json={"grade": "A", "comment": "Lovely"}, headers=as_user("t1"))
    assert approved.status_code == 200, approved.text
    assert (approved.json()["status"], approved.json()["grade"]) == ("approved", "A")
    assert client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()["status"] == "published"


def test_send_back_needs_a_comment_and_the_student_can_send_again(client, school) -> None:
    copy = assigned_copy(client, school)
    submit(client, copy)
    no_comment = client.post(f"/projects/{copy['id']}/send-back", json={}, headers=as_user("t1"))
    assert no_comment.status_code == 422

    back = client.post(f"/projects/{copy['id']}/send-back", json={"comment": "Add a second room"}, headers=as_user("t1"))
    assert back.json()["status"] == "sent_back"
    assert client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()["status"] == "draft"

    assert submit(client, copy).status_code == 201
    history = client.get(f"/projects/{copy['id']}/submissions", headers=as_user("s1")).json()
    assert [h["status"] for h in history] == ["waiting", "sent_back"]
    assert history[1]["comment"] == "Add a second room"


def test_only_the_owner_submits_and_only_a_teacher_reviews(client, school) -> None:
    copy = assigned_copy(client, school)
    assert submit(client, copy, key="s2").status_code == 404  # a classmate cannot even see it
    assert submit(client, copy, key="t1").status_code == 403
    submit(client, copy)
    assert client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("s1")).status_code == 403
    assert client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("other")).status_code == 404


def test_review_only_happens_while_waiting(client, school) -> None:
    copy = assigned_copy(client, school)
    assert client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1")).status_code == 409
    submit(client, copy)
    assert submit(client, copy).status_code == 409  # already waiting
    client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1"))
    assert submit(client, copy).status_code == 409  # already approved


def test_the_student_can_take_back_a_waiting_hand_in(client, school) -> None:
    copy = assigned_copy(client, school)
    withdraw = lambda key="s1": client.delete(f"/projects/{copy['id']}/submit", headers=as_user(key))
    assert withdraw().status_code == 409  # nothing sent yet

    submit(client, copy)
    client.post(f"/projects/{copy['id']}/send-back", json={"comment": "Add a second room"}, headers=as_user("t1"))
    submit(client, copy)
    assert withdraw("t1").status_code == 403
    assert withdraw().status_code == 204
    # back to how it was: the sent-back hand-in is the newest again
    history = client.get(f"/projects/{copy['id']}/submissions", headers=as_user("s1")).json()
    assert [h["status"] for h in history] == ["sent_back"]
    assert client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()["review_status"] == "sent_back"
    assert client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1")).status_code == 409

    # it can be sent again, and once approved it can't be taken back
    submit(client, copy)
    client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1"))
    assert withdraw().status_code == 409


def test_only_assigned_work_can_be_submitted(client, school) -> None:
    own = client.post("/projects", json={"name": "Mine", "class_id": str(school["class1"].id)}, headers=as_user("s1")).json()
    assert submit(client, own).status_code == 409


def test_share_with_must_be_a_known_option(client, school) -> None:
    copy = assigned_copy(client, school)
    assert submit(client, copy, share_with="everyone").status_code == 422

def test_a_student_cannot_publish_assigned_work_directly(client, school) -> None:
    copy = assigned_copy(client, school)
    shortcut = client.patch(f"/projects/{copy['id']}", json={"status": "published"}, headers=as_user("s1"))
    assert shortcut.status_code == 403
    # their own project that nobody assigned still publishes as before
    own = client.post("/projects", json={"name": "Mine", "class_id": str(school["class1"].id)}, headers=as_user("s1")).json()
    assert client.patch(f"/projects/{own['id']}", json={"status": "published"}, headers=as_user("s1")).status_code == 200

def test_teacher_list_counts_published_copies(client, school) -> None:
    copy = assigned_copy(client, school)
    mine = lambda: {p["id"]: p for p in client.get("/projects?kind=project&mine=true", headers=as_user("t1")).json()}
    source_id = next(pid for pid, p in mine().items() if p["sent"])
    assert mine()[source_id]["published_copies"] == 0

    submit(client, copy)
    client.post(f"/projects/{copy['id']}/approve", json={}, headers=as_user("t1"))
    assert mine()[source_id]["published_copies"] == 1


def test_a_hand_in_pins_the_save_it_was_sent_with(client, school) -> None:
    copy = assigned_copy(client, school)
    sent_with = save(client, copy, {"schemaVersion": 1, "scenes": [], "note": "sent"})
    sent = submit(client, copy).json()
    assert sent["version_id"] == sent_with["id"]

    # editing on straight after, inside the merge window, makes a new save instead of
    # rewriting the one the teacher is about to review
    later = save(client, copy, {"schemaVersion": 1, "scenes": [], "note": "later"})
    assert later["id"] != sent_with["id"] and later["revision"] == sent_with["revision"] + 1
    versions = {v["id"]: v for v in client.get(f"/projects/{copy['id']}/versions", headers=as_user("s1")).json()}
    assert versions[sent_with["id"]]["label"] == "Sent to teacher"
    pinned = client.get(f"/projects/{copy['id']}/versions/{sent_with['id']}", headers=as_user("t1")).json()
    assert pinned["data"]["note"] == "sent"


def test_a_project_with_no_save_cannot_be_sent(client, school) -> None:
    project = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    copy = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    assert copy["current_version_id"] is None  # the lesson was never saved, so neither is the copy
    assert submit(client, copy).status_code == 409
