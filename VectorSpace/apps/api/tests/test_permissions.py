"""Per-school permission settings: the admin saves them, the API enforces them, the browser reads its own."""


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def url(school) -> str:
    return f"/admin/schools/{school['admin'].organisation_id}/permissions"


def published_template(client) -> dict:
    template = client.post("/projects", json={"name": "Lesson", "kind": "template"}, headers=as_user("t1")).json()
    client.patch(f"/projects/{template['id']}", json={"status": "published"}, headers=as_user("t1"))
    return template


def copy_of(client, key: str, template: dict):
    return client.post("/projects", json={"name": "Mine", "template_id": template["id"]}, headers=as_user(key))


def test_a_new_school_gets_the_defaults(client, school) -> None:
    rows = client.get(url(school), headers=as_user("admin")).json()
    assert len(rows) == 9
    templates = next(r for r in rows if r["key"] == "from-templates")
    assert (templates["students"], templates["educators"], templates["enforced"]) == (False, True, True)
    assert next(r for r in rows if r["key"] == "public-links")["enforced"] is False


def test_only_an_admin_of_that_school_reads_or_saves_them(client, school) -> None:
    assert client.get(url(school), headers=as_user("t1")).status_code == 403
    assert client.get(url(school), headers=as_user("other")).status_code == 403  # a teacher elsewhere
    assert client.get("/admin/schools/all/permissions", headers=as_user("admin")).status_code == 404
    body = [{"key": "from-templates", "students": True, "educators": True}]
    assert client.put(url(school), json=body, headers=as_user("t1")).status_code == 403


def test_saving_keeps_what_was_left_out_and_survives_a_reload(client, school) -> None:
    body = [{"key": "public-links", "students": True, "educators": False, "can_adjust": False}]
    saved = client.put(url(school), json=body, headers=as_user("admin"))
    assert saved.status_code == 200, saved.text
    rows = {r["key"]: r for r in client.get(url(school), headers=as_user("admin")).json()}
    assert (rows["public-links"]["students"], rows["public-links"]["educators"], rows["public-links"]["can_adjust"]) == (True, False, False)
    assert rows["unlisted-links"]["students"] is True  # untouched default


def test_an_unknown_key_saves_nothing(client, school) -> None:
    body = [
        {"key": "public-links", "students": True, "educators": True},
        {"key": "fly-to-the-moon", "students": True, "educators": True},
    ]
    response = client.put(url(school), json=body, headers=as_user("admin"))
    assert response.status_code == 422
    assert "fly-to-the-moon" in response.json()["detail"]
    rows = {r["key"]: r for r in client.get(url(school), headers=as_user("admin")).json()}
    assert rows["public-links"]["students"] is False


def test_students_cannot_copy_a_template_by_default(client, school) -> None:
    template = published_template(client)
    refused = copy_of(client, "s1", template)
    assert refused.status_code == 403
    assert "templates" in refused.json()["detail"]
    assert copy_of(client, "t1", template).status_code == 201
    assert copy_of(client, "admin", template).status_code == 201
    # a blank project is not a copy of a template, so the setting does not touch it
    assert client.post("/projects", json={"name": "blank"}, headers=as_user("s1")).status_code == 201


def test_turning_it_on_lets_students_copy_and_off_stops_teachers(client, school) -> None:
    template = published_template(client)
    body = [{"key": "from-templates", "students": True, "educators": False}]
    assert client.put(url(school), json=body, headers=as_user("admin")).status_code == 200
    assert copy_of(client, "s1", template).status_code == 201
    assert copy_of(client, "t1", template).status_code == 403
    assert copy_of(client, "admin", template).status_code == 201  # admins are never locked out


def test_one_schools_settings_do_not_reach_another(client, school) -> None:
    body = [{"key": "from-templates", "students": True, "educators": False}]
    client.put(url(school), json=body, headers=as_user("admin"))
    assert client.get("/permissions/mine", headers=as_user("other")).json()["from-templates"] is True


def test_mine_answers_for_the_callers_role(client, school) -> None:
    student = client.get("/permissions/mine", headers=as_user("s1"))
    assert student.status_code == 200
    assert student.json()["from-templates"] is False
    assert client.get("/permissions/mine", headers=as_user("t1")).json()["from-templates"] is True
    admin = client.get("/permissions/mine", headers=as_user("admin")).json()
    assert len(admin) == 9 and all(admin.values())
