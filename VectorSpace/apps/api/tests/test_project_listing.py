"""What a landing page asks the project list: filters, paging, who made it, and the class roster."""


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def make(client, key, name="p", **extra):
    response = client.post("/projects", json={"name": name, **extra}, headers=as_user(key))
    assert response.status_code == 201, response.text
    return response.json()


def test_rows_say_who_made_them_which_class_and_how_many_saves(client, school) -> None:
    project = make(client, "s1", "Volcano", class_id=str(school["class1"].id))
    client.post(f"/projects/{project['id']}/versions", json={"base_revision": 0, "data": {"schemaVersion": 1}}, headers=as_user("s1"))
    row = client.get("/projects", headers=as_user("s1")).json()[0]
    assert (row["created_by_name"], row["class_name"], row["current_revision"]) == ("s1", "1A", 1)
    assert client.get(f"/projects/{project['id']}", headers=as_user("s1")).json()["class_name"] == "1A"


def test_filters_combine_and_the_total_ignores_paging(client, school) -> None:
    for name in ("Rome", "Romans", "Space"):
        make(client, "s1", name, class_id=str(school["class1"].id))
    client.patch(f"/projects/{make(client, 's1', 'Old')['id']}", json={"status": "archived"}, headers=as_user("s1"))
    found = client.get("/projects", params={"q": "rom", "mine": True, "limit": 1}, headers=as_user("s1"))
    assert [p["name"] for p in found.json()] and len(found.json()) == 1 and found.headers["X-Total-Count"] == "2"
    archived = client.get("/projects", params={"status": "archived"}, headers=as_user("s1")).json()
    assert [p["name"] for p in archived] == ["Old"]
    in_class = client.get("/projects", params={"class_id": str(school["class1"].id)}, headers=as_user("t1"))
    assert in_class.headers["X-Total-Count"] == "3"


def test_filters_never_widen_what_a_student_may_see(client, school) -> None:
    make(client, "s2", "theirs", class_id=str(school["class1"].id))
    listed = client.get("/projects", params={"class_id": str(school["class1"].id)}, headers=as_user("s1"))
    assert listed.json() == [] and listed.headers["X-Total-Count"] == "0"


def test_classes_list_and_roster(client, school) -> None:
    mine = client.get("/classes", headers=as_user("t1")).json()
    assert [(c["name"], c["member_count"]) for c in mine] == [("1A", 3)]
    roster = client.get(f"/classes/{mine[0]['id']}/members", headers=as_user("t1"))
    assert roster.status_code == 200 and {m["role"] for m in roster.json()} == {"teacher", "student"}
    assert len(client.get("/classes", headers=as_user("admin")).json()) == 2


def test_roster_is_for_teachers_of_that_class_only(client, school) -> None:
    class2 = str(school["class2"].id)
    assert client.get(f"/classes/{class2}/members", headers=as_user("t1")).status_code == 404
    own = str(school["class1"].id)
    assert client.get(f"/classes/{own}/members", headers=as_user("s1")).status_code == 403
