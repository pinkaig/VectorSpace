"""Organising classes: create, add, remove, move. Admin on any class; a teacher only on classes they teach."""

from apps.api.app.models import ClassMember, Project


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def members(client, class_id, who="admin") -> list[str]:
    return [m["display_name"] for m in client.get(f"/classes/{class_id}/members", headers=as_user(who)).json()]


def test_an_admin_lists_classes_per_school(client, school) -> None:
    own, other = school["admin"].organisation_id, school["other"].organisation_id
    assert {c["name"] for c in client.get("/classes", params={"school": str(own)}, headers=as_user("admin")).json()} == {"1A", "2B"}
    assert client.get("/classes", params={"school": str(other)}, headers=as_user("admin")).json() == []
    # a teacher's list is still their own classes; the school filter does not widen it
    assert [c["name"] for c in client.get("/classes", params={"school": str(other)}, headers=as_user("t1")).json()] == ["1A"]


def test_an_admin_creates_a_class_in_the_school_they_name(client, school) -> None:
    other = school["other"].organisation_id
    reply = client.post("/classes", json={"name": "B1", "school_id": str(other)}, headers=as_user("admin"))
    assert reply.status_code == 201
    assert reply.json()["school_id"] == str(other) and reply.json()["member_count"] == 0
    assert client.post("/classes", json={"name": "B2"}, headers=as_user("admin")).status_code == 422  # no school picked


def test_a_teacher_creates_a_class_in_their_own_school_and_teaches_it(client, school) -> None:
    reply = client.post("/classes", json={"name": "3C", "school_id": str(school["other"].organisation_id)}, headers=as_user("t1"))
    assert reply.status_code == 201
    assert reply.json()["school_id"] == str(school["t1"].organisation_id)  # the school_id sent is ignored
    assert members(client, reply.json()["id"], "t1") == ["t1"]


def test_a_class_name_is_unique_in_its_school(client, school) -> None:
    assert client.post("/classes", json={"name": "1A"}, headers=as_user("t1")).status_code == 409


def test_a_student_cannot_change_classes(client, school) -> None:
    class1 = school["class1"].id
    assert client.post("/classes", json={"name": "Mine"}, headers=as_user("s1")).status_code == 403
    assert client.post(f"/classes/{class1}/members", json={"actor_id": str(school["s3"].id)}, headers=as_user("s1")).status_code == 403
    assert client.delete(f"/classes/{class1}/members/{school['s2'].id}", headers=as_user("s1")).status_code == 403


def test_adding_and_removing_a_student(client, school) -> None:
    class1, s3 = school["class1"].id, school["s3"].id
    assert client.post(f"/classes/{class1}/members", json={"actor_id": str(s3)}, headers=as_user("t1")).status_code == 200
    # adding twice is harmless
    assert client.post(f"/classes/{class1}/members", json={"actor_id": str(s3)}, headers=as_user("t1")).status_code == 200
    assert "s3" in members(client, class1)
    assert client.delete(f"/classes/{class1}/members/{s3}", headers=as_user("t1")).status_code == 204
    assert "s3" not in members(client, class1)
    assert client.delete(f"/classes/{class1}/members/{s3}", headers=as_user("t1")).status_code == 404


def test_a_teacher_only_changes_classes_they_teach_and_only_students(client, school) -> None:
    class1, class2 = school["class1"].id, school["class2"].id
    # t1 does not teach 2B
    assert client.post(f"/classes/{class2}/members", json={"actor_id": str(school["s1"].id)}, headers=as_user("t1")).status_code == 404
    # a teacher cannot move another teacher, or an admin
    assert client.post(f"/classes/{class1}/members", json={"actor_id": str(school["t2"].id)}, headers=as_user("t1")).status_code == 403
    # nobody from another school can be put in
    assert client.post(f"/classes/{class1}/members", json={"actor_id": str(school["other"].id)}, headers=as_user("admin")).status_code == 404


def test_a_move_is_one_call_and_the_students_work_stays_theirs(client, db, school) -> None:
    class1, class2, s1 = school["class1"].id, school["class2"].id, school["s1"]
    copy = Project(organisation_id=s1.organisation_id, created_by_id=s1.id, name="My museum", slug="my-museum", class_id=class1)
    db.add(copy)
    db.commit()

    reply = client.post(f"/classes/{class1}/members/{s1.id}/move", json={"to_class_id": str(class2)}, headers=as_user("admin"))
    assert reply.status_code == 200
    body = reply.json()
    assert (body["from_class"]["name"], body["to_class"]["name"]) == ("1A", "2B")
    assert "s1" not in members(client, class1) and "s1" in members(client, class2)

    # the student still opens their own museum: copies are theirs by who made them, not by class
    assert client.get(f"/projects/{copy.id}", headers=as_user("s1")).status_code == 200


def test_a_teacher_moves_only_between_two_classes_they_teach(client, db, school) -> None:
    class1, class2, s1 = school["class1"].id, school["class2"].id, school["s1"].id
    assert client.post(f"/classes/{class1}/members/{s1}/move", json={"to_class_id": str(class2)}, headers=as_user("t1")).status_code == 404
    db.add(ClassMember(class_id=class2, actor_id=school["t1"].id))  # now t1 teaches both
    db.commit()
    assert client.post(f"/classes/{class1}/members/{s1}/move", json={"to_class_id": str(class2)}, headers=as_user("t1")).status_code == 200


def test_a_move_needs_two_different_classes_and_the_student_in_the_first(client, school) -> None:
    class1, class2 = school["class1"].id, school["class2"].id
    same = client.post(f"/classes/{class1}/members/{school['s1'].id}/move", json={"to_class_id": str(class1)}, headers=as_user("admin"))
    assert same.status_code == 422
    not_there = client.post(f"/classes/{class1}/members/{school['s3'].id}/move", json={"to_class_id": str(class2)}, headers=as_user("admin"))
    assert not_there.status_code == 404


def test_a_move_cannot_cross_schools(client, school) -> None:
    other_class = client.post(
        "/classes", json={"name": "B1", "school_id": str(school["other"].organisation_id)}, headers=as_user("admin")
    ).json()["id"]
    reply = client.post(
        f"/classes/{school['class1'].id}/members/{school['s1'].id}/move", json={"to_class_id": other_class}, headers=as_user("admin")
    )
    assert reply.status_code == 422
