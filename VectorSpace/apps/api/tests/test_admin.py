"""The admin routes: admins only, across every school (D-A), and every number comes from the tables."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
from apps.api.app.models import Actor, Project
from sqlalchemy import select


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def test_only_an_admin_may_ask(client, school) -> None:
    for path in ("/admin/schools", "/admin/accounts", "/admin/overview"):
        assert client.get(path, headers=as_user("t1")).status_code == 403
        assert client.get(path, headers=as_user("s1")).status_code == 403
        assert client.get(path, headers=as_user("admin")).status_code == 200


def test_every_school_is_listed_with_its_people_and_whether_it_is_running(client, school) -> None:
    """Admins are VThere staff and see every school (D-A, 6 Nov)."""
    rows = {r["name"]: r for r in client.get("/admin/schools", headers=as_user("admin")).json()}
    assert set(rows) == {"A", "B"}
    assert (rows["A"]["educators"], rows["A"]["students"], rows["A"]["status"]) == (2, 3, "active")
    assert (rows["B"]["educators"], rows["B"]["students"], rows["B"]["status"]) == (1, 0, "setting_up")


def test_a_school_with_no_students_is_still_setting_up(client, db, school) -> None:
    for student in ("s1", "s2", "s3"):
        db.delete(school[student])
    db.commit()
    rows = {r["name"]: r for r in client.get("/admin/schools", headers=as_user("admin")).json()}
    assert rows["A"]["status"] == "setting_up"


def test_picking_a_school_lists_only_its_people(client, school) -> None:
    """School B has one teacher, "other". All schools lists everyone; a picked school only its own."""
    every = client.get("/admin/accounts", headers=as_user("admin")).json()
    assert len(every) == 7
    own = client.get("/admin/accounts", params={"school": str(school["admin"].organisation_id)}, headers=as_user("admin")).json()
    assert "other@x.test" not in {a["email"] for a in own} and len(own) == 6
    other = client.get("/admin/accounts", params={"school": str(school["other"].organisation_id)}, headers=as_user("admin")).json()
    assert [a["email"] for a in other] == ["other@x.test"]


def test_a_school_that_does_not_exist_is_a_404(client, school) -> None:
    for bad in (str(uuid.uuid4()), "not-an-id"):
        assert client.get("/admin/accounts", params={"school": bad}, headers=as_user("admin")).status_code == 404
        assert client.get("/admin/overview", params={"school": bad}, headers=as_user("admin")).status_code == 404


def test_an_account_is_invited_until_its_first_me_call(client, school) -> None:
    by_email = {a["email"]: a for a in client.get("/admin/accounts", headers=as_user("admin")).json()}
    assert by_email["s1@x.test"]["status"] == "invited"
    assert by_email["s1@x.test"]["last_active"] is None

    client.get("/me", headers=as_user("s1"))

    after = {a["email"]: a for a in client.get("/admin/accounts", headers=as_user("admin")).json()}
    assert after["s1@x.test"]["status"] == "active"
    assert after["s1@x.test"]["last_active"] is not None


def test_classes_are_a_list_because_a_person_can_be_in_two(client, db, school) -> None:
    from apps.api.app.models import ClassMember

    db.add(ClassMember(class_id=school["class2"].id, actor_id=school["s1"].id))
    db.commit()
    rows = {a["email"]: a for a in client.get("/admin/accounts", headers=as_user("admin")).json()}
    assert rows["s1@x.test"]["class_names"] == ["1A", "2B"]
    assert rows["admin@x.test"]["class_names"] == []


def test_turning_an_account_off_and_on_again(client, db, school) -> None:
    target = str(school["s1"].id)
    off = client.patch(f"/admin/accounts/{target}", json={"active": False}, headers=as_user("admin"))
    assert off.status_code == 200 and off.json()["status"] == "turned_off"
    # a turned-off account cannot use the API at all
    assert client.get("/projects", headers=as_user("s1")).status_code == 403
    on = client.patch(f"/admin/accounts/{target}", json={"active": True}, headers=as_user("admin"))
    assert on.json()["status"] == "invited"  # back on, but still never signed in


def test_an_admin_cannot_lock_themselves_out(client, school) -> None:
    reply = client.patch(f"/admin/accounts/{school['admin'].id}", json={"active": False}, headers=as_user("admin"))
    assert reply.status_code == 400


def test_an_admin_can_turn_off_an_account_in_another_school(client, db, school) -> None:
    reply = client.patch(f"/admin/accounts/{school['other'].id}", json={"active": False}, headers=as_user("admin"))
    assert reply.status_code == 200 and reply.json()["status"] == "turned_off"
    assert client.patch(f"/admin/accounts/{uuid.uuid4()}", json={"active": True}, headers=as_user("admin")).status_code == 404


def test_adding_an_account_goes_through_the_normal_provisioning_path(client, db, school, monkeypatch) -> None:
    """Same code as the CSV tool and the seed: a login, an actor row, and its classes."""
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post(
        "/admin/accounts",
        json={
            "school_id": str(school["admin"].organisation_id),
            "name": "New Person", "email": "New.Person@x.test", "role": "student",
            "class_names": ["1A", "3C"],
        },
        headers=as_user("admin"),
    )
    assert reply.status_code == 201
    body = reply.json()
    assert body["email"] == "new.person@x.test"  # lower-cased on the way in
    assert body["status"] == "invited" and body["class_names"] == ["1A", "3C"]  # 3C was created
    assert db.scalar(select(Actor).where(Actor.email == "new.person@x.test")) is not None


def test_an_account_goes_into_the_school_it_names_and_not_the_admins_own(client, db, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    other_org = school["other"].organisation_id
    reply = client.post(
        "/admin/accounts",
        json={"school_id": str(other_org), "name": "B Kid", "email": "bkid@x.test", "role": "student", "class_names": ["B1"]},
        headers=as_user("admin"),
    )
    assert reply.status_code == 201 and reply.json()["school_id"] == str(other_org)
    from apps.api.app.models import Classroom

    made = db.scalar(select(Classroom).where(Classroom.name == "B1"))
    assert made.organisation_id == other_org  # its class was made in school B too


def test_adding_an_account_to_a_school_that_does_not_exist_is_a_404(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post("/admin/accounts", json=_new_account(school, school_id=str(uuid.uuid4())), headers=as_user("admin"))
    assert reply.status_code == 404


def _new_account(school, **changes) -> dict:
    body = {
        "school_id": str(school["admin"].organisation_id),
        "name": "New Person", "email": "new.person@x.test", "role": "student", "class_names": [],
    }
    return {**body, **changes}


def test_a_created_account_comes_back_with_its_one_time_password_link(client, school, monkeypatch) -> None:
    """Nothing emails the link, so the create reply is the only chance to hand it over."""
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post("/admin/accounts", json=_new_account(school), headers=as_user("admin"))
    assert reply.status_code == 201
    assert reply.json()["invite_link"] == "https://tenant.test/invite/new.person@x.test"

    # and nowhere else: the ticket is single-use and is never stored, so a listing cannot re-mint it
    listed = {a["email"]: a for a in client.get("/admin/accounts", headers=as_user("admin")).json()}
    assert "invite_link" not in listed["new.person@x.test"]


def test_no_tenant_means_a_null_link_and_not_an_empty_string(client, school, monkeypatch) -> None:
    """The local path has no link; the browser has to tell "none" from "blank"."""
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _LoginsWithoutATenant())
    reply = client.post("/admin/accounts", json=_new_account(school), headers=as_user("admin"))
    assert reply.status_code == 201 and reply.json()["invite_link"] is None


def test_an_address_the_school_already_has_is_refused_and_nobody_is_edited(client, db, school, monkeypatch) -> None:
    """provision() would update them -- right for a re-run of a roster, wrong for a form."""
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post(
        "/admin/accounts",
        json=_new_account(school, email="S1@x.test", name="Someone Else", role="teacher"),
        headers=as_user("admin"),
    )
    assert reply.status_code == 409
    assert "s1@x.test" in reply.json()["detail"] and "s1" in reply.json()["detail"]

    db.refresh(school["s1"])
    assert (school["s1"].role, school["s1"].display_name) == ("student", "s1")


def test_a_turned_off_address_is_refused_rather_than_quietly_turned_back_on(client, db, school, monkeypatch) -> None:
    client.patch(f"/admin/accounts/{school['s1'].id}", json={"active": False}, headers=as_user("admin"))
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post(
        "/admin/accounts", json=_new_account(school, email="s1@x.test"), headers=as_user("admin")
    )
    assert reply.status_code == 409
    db.refresh(school["s1"])
    assert school["s1"].active is False  # still off: reactivating is a deliberate act, not a side effect


def test_adding_a_school_makes_an_empty_one_the_picker_can_use(client, db, school) -> None:
    reply = client.post("/admin/schools", json={"name": "  Riverside Primary "}, headers=as_user("admin"))
    assert reply.status_code == 201
    body = reply.json()
    assert (body["name"], body["students"], body["educators"], body["status"]) == ("Riverside Primary", 0, 0, "setting_up")
    from apps.api.app.models import Organisation

    # the slug is what `python -m app.provision --school-slug` takes, so a roster CSV can follow
    assert db.get(Organisation, uuid.UUID(body["id"])).slug == "riverside-primary"
    assert client.get("/admin/accounts", params={"school": body["id"]}, headers=as_user("admin")).json() == []


def test_two_schools_cannot_share_a_name(client, school) -> None:
    client.post("/admin/schools", json={"name": "Riverside"}, headers=as_user("admin"))
    again = client.post("/admin/schools", json={"name": "RIVERSIDE"}, headers=as_user("admin"))
    assert again.status_code == 409


def test_a_school_name_needs_a_letter_or_digit(client, school) -> None:
    assert client.post("/admin/schools", json={"name": "!!!"}, headers=as_user("admin")).status_code == 422
    assert client.post("/admin/schools", json={"name": ""}, headers=as_user("admin")).status_code == 422


def test_only_an_admin_may_add_a_school(client, school) -> None:
    for who in ("t1", "s1"):
        assert client.post("/admin/schools", json={"name": "X"}, headers=as_user(who)).status_code == 403


def test_the_overview_counts_what_is_really_there(client, db, school) -> None:
    project = Project(
        organisation_id=school["admin"].organisation_id, created_by_id=school["s1"].id,
        name="Published one", slug="published-one", status="published", class_id=school["class1"].id,
    )
    draft = Project(
        organisation_id=school["admin"].organisation_id, created_by_id=school["s2"].id,
        name="A draft", slug="a-draft", status="draft",
    )
    db.add_all([project, draft])
    db.commit()

    body = client.get("/admin/overview", params=_school_a(school), headers=as_user("admin")).json()
    assert body["tiles"]["students"]["value"] == 3
    assert body["tiles"]["educators"]["value"] == 2
    assert body["tiles"]["published"] == {"value": 1, "sub": "1 still drafts"}
    assert [r["title"] for r in body["recent"]] == ["Published one"]
    assert body["recent"][0]["where"] == "A · 1A"


def test_the_overview_only_flags_things_it_can_prove(client, db, school) -> None:
    texts = [item["text"] for item in client.get("/admin/overview", params=_school_a(school), headers=as_user("admin")).json()["attention"]]
    assert "6 people have never signed in" in texts
    client.get("/me", headers=as_user("s1"))
    client.get("/me", headers=as_user("admin"))
    texts = [item["text"] for item in client.get("/admin/overview", params=_school_a(school), headers=as_user("admin")).json()["attention"]]
    assert "4 people have never signed in" in texts


def test_students_active_this_week_uses_the_real_timestamp(client, db, school) -> None:
    school["s1"].last_seen_at = datetime.now(UTC) - timedelta(days=1)
    school["s2"].last_seen_at = datetime.now(UTC) - timedelta(days=40)
    db.commit()
    tiles = client.get("/admin/overview", params=_school_a(school), headers=as_user("admin")).json()["tiles"]
    assert tiles["students"]["sub"] == "1 active this week"


class _FakeLogins:
    """Stands in for Auth0Admin in the tests, so nothing reads the settings or the network.

    The second element is Auth0's one-time password-set link. It is a recognisable fake rather
    than "" so that a test can watch it travel from provision() to the create reply.
    """

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"test|{email}", f"https://tenant.test/invite/{email}"

    def sign_in_link(self, subject: str) -> str:
        return f"https://tenant.test/again/{subject}"


class _LoginsWithoutATenant:
    """What DevLogins does: a local subject and no link at all, which is every local run."""

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"dev|{email.split('@')[0]}", ""

    def sign_in_link(self, subject: str) -> str:
        return ""


class _TenantDown:
    """Auth0 refusing the ticket call."""

    def sign_in_link(self, subject: str) -> str:
        raise httpx.HTTPStatusError("503", request=httpx.Request("POST", "https://t"), response=httpx.Response(503))


def _school_a(school) -> dict[str, str]:
    """The overview for school A alone; "all" also counts school B (see the D-A tests above)."""
    return {"school": str(school["admin"].organisation_id)}


def test_all_schools_overview_counts_every_school(client, school) -> None:
    body = client.get("/admin/overview", headers=as_user("admin")).json()
    assert body["tiles"]["schools"]["value"] == 2
    assert body["tiles"]["educators"]["value"] == 3  # t1, t2 in A and "other" in B
    assert "B has no students yet" in [item["text"] for item in body["attention"]]


# --- a new sign-in link (POST /admin/accounts/{id}/invite) ---------------------------------------


def test_an_admin_gets_a_fresh_sign_in_link_for_anyone(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    for key in ("s1", "other"):  # any school, as D-A says
        person = school[key]
        reply = client.post(f"/admin/accounts/{person.id}/invite", headers=as_user("admin"))
        assert reply.status_code == 200
        assert reply.json() == {
            "account_id": str(person.id),
            "invite_link": f"https://tenant.test/again/{person.auth0_subject}",
        }


def test_without_a_tenant_the_link_is_null(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _LoginsWithoutATenant())
    reply = client.post(f"/admin/accounts/{school['s1'].id}/invite", headers=as_user("admin"))
    assert reply.status_code == 200 and reply.json()["invite_link"] is None


def test_a_turned_off_account_gets_no_link(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    target = school["s2"].id
    client.patch(f"/admin/accounts/{target}", json={"active": False}, headers=as_user("admin"))
    reply = client.post(f"/admin/accounts/{target}/invite", headers=as_user("admin"))
    assert reply.status_code == 409 and "turned off" in reply.json()["detail"]


def test_a_sign_in_link_for_nobody_is_404(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    assert client.post(f"/admin/accounts/{uuid.uuid4()}/invite", headers=as_user("admin")).status_code == 404


def test_only_an_admin_hands_out_sign_in_links(client, school, monkeypatch) -> None:
    """Sherman, 7 Nov: teachers do not, until what they may do for students is decided."""
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    for key in ("t1", "s1"):
        assert client.post(f"/admin/accounts/{school['s1'].id}/invite", headers=as_user(key)).status_code == 403


def test_auth0_refusing_is_a_502_with_a_reason(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _TenantDown())
    reply = client.post(f"/admin/accounts/{school['s1'].id}/invite", headers=as_user("admin"))
    assert reply.status_code == 502 and "Auth0" in reply.json()["detail"]


# --- create accounts from a CSV (POST /admin/accounts/import) ------------------------------------

CLASS_LIST = (
    "Email,Display_Name,Role,Classes\n"
    "new1@x.test,New One,student,3C\n"
    "S1@x.test,Already Here,teacher,\n"  # s1 is in school A: skipped, and not turned into a teacher
    "new2@x.test,New Two,principal,\n"
    "new1@x.test,New One Again,student,\n"
    "new3@x.test,New Three,teacher,3C;3D\n"
)


def _import(client, school, csv_text: str = CLASS_LIST, dry_run: bool = False, who: str = "admin"):
    body = {"school_id": str(school["admin"].organisation_id), "csv": csv_text, "dry_run": dry_run}
    return client.post("/admin/accounts/import", json=body, headers=as_user(who))


class _FailsOn(_FakeLogins):
    """Auth0 refusing one address, part-way through a file."""

    def __init__(self, email: str) -> None:
        self.email = email

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        if email == self.email:
            raise httpx.HTTPStatusError("503", request=httpx.Request("POST", "https://t"), response=httpx.Response(503))
        return super().create_user(email, display_name)


def test_a_dry_run_reports_every_line_and_writes_nothing(client, db, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = _import(client, school, dry_run=True)
    assert reply.status_code == 200
    rows = reply.json()["rows"]
    assert [(r["line"], r["outcome"]) for r in rows] == [
        (2, "would_create"), (3, "skipped_exists"), (4, "error"), (5, "error"), (6, "would_create")
    ]
    assert "principal" in rows[2]["error"] and "line 2" in rows[3]["error"]
    assert rows[4]["class_names"] == ["3C", "3D"]
    assert all(r["invite_link"] is None for r in rows)
    assert db.scalar(select(Actor).where(Actor.email == "new1@x.test")) is None


def test_applying_creates_the_good_rows_skips_the_known_and_hands_out_links(client, db, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    rows = _import(client, school).json()["rows"]
    assert [r["outcome"] for r in rows] == ["created", "skipped_exists", "error", "error", "created"]
    assert rows[0]["invite_link"] == "https://tenant.test/invite/new1@x.test"
    assert rows[1]["account_id"] == str(school["s1"].id) and rows[1]["invite_link"] is None
    db.expire_all()
    assert db.get(Actor, school["s1"].id).role == "student"  # skipped, not rewritten
    made = db.scalar(select(Actor).where(Actor.email == "new3@x.test"))
    assert made.role == "teacher" and made.organisation_id == school["admin"].organisation_id
    listed = client.get("/admin/accounts", params=_school_a(school), headers=as_user("admin")).json()
    assert sorted(next(a for a in listed if a["email"] == "new3@x.test")["class_names"]) == ["3C", "3D"]


def test_running_the_same_file_again_creates_nobody_twice(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    _import(client, school)
    again = [r["outcome"] for r in _import(client, school).json()["rows"]]
    assert again == ["skipped_exists", "skipped_exists", "error", "error", "skipped_exists"]


def test_auth0_failing_mid_file_keeps_the_rows_before_and_after(client, db, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FailsOn("new1@x.test"))
    rows = _import(client, school).json()["rows"]
    assert rows[0]["outcome"] == "error" and "again" in rows[0]["error"]
    assert rows[4]["outcome"] == "created"
    db.expire_all()
    assert db.scalar(select(Actor).where(Actor.email == "new1@x.test")) is None
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    assert _import(client, school).json()["rows"][0]["outcome"] == "created"


def test_without_a_tenant_created_rows_have_a_null_link(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _LoginsWithoutATenant())
    rows = _import(client, school, "email,display_name,role\nsolo@x.test,Solo,student\n").json()["rows"]
    assert rows[0]["outcome"] == "created" and rows[0]["invite_link"] is None


def test_a_file_without_the_columns_is_refused_whole(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = _import(client, school, "name,email\nA,a@x.test\n")
    assert reply.status_code == 422 and "display_name, role" in reply.json()["detail"]
    assert _import(client, school, "email,display_name,role\n").status_code == 422


def test_more_than_200_people_is_refused(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    lines = "".join(f"p{i}@x.test,P {i},student\n" for i in range(201))
    reply = _import(client, school, "email,display_name,role\n" + lines, dry_run=True)
    assert reply.status_code == 422 and "200" in reply.json()["detail"]


def test_only_an_admin_imports_and_only_into_a_real_school(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    assert _import(client, school, who="t1").status_code == 403
    body = {"school_id": str(uuid.uuid4()), "csv": CLASS_LIST, "dry_run": True}
    assert client.post("/admin/accounts/import", json=body, headers=as_user("admin")).status_code == 404
