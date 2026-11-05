#The teacher's setup (spots, locks, starter objects)
from apps.api.app.teacher_setup import merge_setup


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def thing(id: str, x: float = 0, **extra) -> dict:
    return {"id": id, "name": id, "assetId": "primitive-cube", "assetKind": "cube", "visible": True, "enabled": True,
            "transform": {"position": [x, 0.5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, **extra}


def project(objects: list[dict], spots: list[dict] | None = None, rules: list[dict] | None = None) -> dict:
    room = {"id": "room-1", "name": "Hall", "objects": objects}
    if spots is not None:
        room["spots"] = spots
    return {"schemaVersion": 1, "id": "p", "name": "P", "activeSceneId": "room-1", "scenes": [room], "rules": rules or []}


SPOT = {"id": "spot-1", "position": [1, 0, 1], "text": "Put an exhibit here"}


def test_merge_carries_only_the_teachers_parts() -> None:
    template = project([thing("bench", x=3, locked=True), thing("door", locked=True), thing("loose")], spots=[SPOT])
    student = project(
        [
            thing("bench", x=0, locked=True, attachments=[{"id": "card"}]),  # moved before it was locked
            thing("old-board", locked=True),  # the teacher removed it since
            thing("loose", x=9),  # never locked: the student's to move
            thing("mine"),  # the student's own
            thing("vase", parentId="old-board"),
        ],
        rules=[{"id": "r1", "objectId": "old-board", "triggers": [], "actions": []}, {"id": "r2", "objectId": "mine", "triggers": [], "actions": []}],
    )
    merged = merge_setup(template, student)
    things = {item["id"]: item for item in merged["scenes"][0]["objects"]}

    assert merged["scenes"][0]["spots"] == [SPOT]
    assert things["bench"]["transform"]["position"][0] == 3  # the teacher's place
    assert things["bench"]["attachments"] == [{"id": "card"}]  # the student's fact card stays
    assert "door" in things  # new from the teacher
    assert "old-board" not in things and "parentId" not in things["vase"]
    assert things["loose"]["transform"]["position"][0] == 9 and "mine" in things
    assert [rule["id"] for rule in merged["rules"]] == ["r2"]


def test_merge_unlocks_and_clears_spots() -> None:
    merged = merge_setup(project([thing("bench")]), project([thing("bench", locked=True)], spots=[SPOT]))
    assert "locked" not in merged["scenes"][0]["objects"][0]
    assert "spots" not in merged["scenes"][0]


def test_merge_carries_the_mission_brief() -> None:
    brief = {"due": "", "todos": [], "rules": [], "cardTasks": [{"id": "task-1", "objectId": "bench"}]}
    merged = merge_setup({**project([thing("bench")]), "missionBrief": brief}, {**project([thing("bench")]), "missionBrief": {"due": "", "todos": [], "rules": []}})
    assert merged["missionBrief"] == brief
    # a template with no brief leaves the copy's as it is
    kept = merge_setup(project([]), {**project([]), "missionBrief": brief})
    assert kept["missionBrief"] == brief


def save(client, project_id: str, data: dict, key: str = "t1") -> None:
    current = client.get(f"/projects/{project_id}/versions", headers=as_user(key)).json()
    base = current[0]["revision"] if current else 0
    saved = client.post(f"/projects/{project_id}/versions", json={"base_revision": base, "data": data}, headers=as_user(key))
    assert saved.status_code == 201, saved.text


def latest(client, project_id: str, key: str = "s1") -> dict:
    version_id = client.get(f"/projects/{project_id}", headers=as_user(key)).json()["current_version_id"]
    return client.get(f"/projects/{project_id}/versions/{version_id}", headers=as_user(key)).json()["data"]


def test_push_setup_updates_copies_students_already_have(client, school) -> None:
    template = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    save(client, template["id"], project([thing("wall", locked=True)]))
    copy = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    save(client, copy["id"], project([thing("wall", locked=True), thing("mine")]), key="s1")

    # the teacher adds a spot and a starter bench after the copy was sent
    save(client, template["id"], project([thing("wall", locked=True), thing("bench", locked=True)], spots=[SPOT]))
    assert client.post(f"/projects/{template['id']}/push-setup", headers=as_user("s1")).status_code == 403
    pushed = client.post(f"/projects/{template['id']}/push-setup", headers=as_user("t1"))
    assert pushed.json() == {"updated": 1, "skipped": 0}

    data = latest(client, copy["id"])
    assert {item["id"] for item in data["scenes"][0]["objects"]} == {"wall", "mine", "bench"}
    assert data["scenes"][0]["spots"] == [SPOT]
    # nothing new: nothing to do
    assert client.post(f"/projects/{template['id']}/push-setup", headers=as_user("t1")).json() == {"updated": 0, "skipped": 0}


def test_push_setup_leaves_work_under_review_alone(client, school) -> None:
    template = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    save(client, template["id"], project([]))
    copy = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    client.post(f"/projects/{copy['id']}/submit", json={}, headers=as_user("s1"))

    save(client, template["id"], project([], spots=[SPOT]))
    assert client.post(f"/projects/{template['id']}/push-setup", headers=as_user("t1")).json() == {"updated": 0, "skipped": 1}
    assert "spots" not in latest(client, copy["id"])["scenes"][0]


def test_edited_brief_reaches_copies_already_sent(client, school) -> None:
    template = client.post("/projects", json={"name": "Lesson"}, headers=as_user("t1")).json()
    first = {"due": "Friday", "todos": [{"id": "t1", "text": "Add 3 exhibits"}], "rules": []}
    save(client, template["id"], {**project([]), "missionBrief": first})
    copy = client.post(f"/projects/{template['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1")).json()
    assert client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()["mission_brief"] == first

    # the teacher edits the brief after sending, saves, and Assign pushes the setup
    edited = {"due": "Monday", "todos": [{"id": "t1", "text": "Add 5 exhibits"}], "rules": []}
    save(client, template["id"], {**project([]), "missionBrief": edited})
    client.post(f"/projects/{template['id']}/push-setup", headers=as_user("t1"))
    assert client.get(f"/projects/{copy['id']}", headers=as_user("s1")).json()["mission_brief"] == edited
    # the teacher's own project carries its brief in its content, not on the row
    assert client.get(f"/projects/{template['id']}", headers=as_user("t1")).json()["mission_brief"] is None
