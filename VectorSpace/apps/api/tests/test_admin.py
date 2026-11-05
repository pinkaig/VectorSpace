"""The admin routes: admins only, one school each, and every number comes from the tables."""

from datetime import UTC, datetime, timedelta

from apps.api.app.models import Actor, Project
from sqlalchemy import select


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


def test_only_an_admin_may_ask(client, school) -> None:
    for path in ("/admin/schools", "/admin/accounts", "/admin/overview"):
        assert client.get(path, headers=as_user("t1")).status_code == 403
        assert client.get(path, headers=as_user("s1")).status_code == 403
        assert client.get(path, headers=as_user("admin")).status_code == 200


def test_a_school_lists_its_people_and_says_whether_it_is_running(client, school) -> None:
    rows = client.get("/admin/schools", headers=as_user("admin")).json()
    assert len(rows) == 1  # an admin administers one school; see the module note
    assert (rows[0]["name"], rows[0]["educators"], rows[0]["students"]) == ("A", 2, 3)
    assert rows[0]["status"] == "active"


def test_a_school_with_no_students_is_still_setting_up(client, db, school) -> None:
    for student in ("s1", "s2", "s3"):
        db.delete(school[student])
    db.commit()
    assert client.get("/admin/schools", headers=as_user("admin")).json()[0]["status"] == "setting_up"


def test_another_schools_people_are_never_listed(client, school) -> None:
    """School B has one teacher, "other". The scoping is the whole point of the page."""
    accounts = client.get("/admin/accounts", headers=as_user("admin")).json()
    assert "other@x.test" not in {a["email"] for a in accounts}
    assert len(accounts) == 6


def test_a_school_id_that_is_not_mine_is_not_confirmed_to_exist(client, school) -> None:
    other_org = school["other"].organisation_id
    assert client.get("/admin/accounts", params={"school": str(other_org)}, headers=as_user("admin")).status_code == 404
    assert client.get("/admin/accounts", params={"school": "all"}, headers=as_user("admin")).status_code == 200


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


def test_an_account_in_another_school_cannot_be_touched(client, school) -> None:
    reply = client.patch(f"/admin/accounts/{school['other'].id}", json={"active": True}, headers=as_user("admin"))
    assert reply.status_code == 404


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


def test_adding_an_account_to_another_school_is_refused(client, school, monkeypatch) -> None:
    monkeypatch.setattr("apps.api.app.routers.admin.logins", lambda: _FakeLogins())
    reply = client.post(
        "/admin/accounts",
        json={
            "school_id": str(school["other"].organisation_id),
            "name": "Nope", "email": "nope@x.test", "role": "student", "class_names": [],
        },
        headers=as_user("admin"),
    )
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


def test_adding_a_school_says_why_it_cannot(client, school) -> None:
    """Honest 501: there is no operator role above the schools yet."""
    reply = client.post("/admin/schools", json={"name": "C"}, headers=as_user("admin"))
    assert reply.status_code == 501
    assert "operator role" in reply.json()["detail"]


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

    body = client.get("/admin/overview", headers=as_user("admin")).json()
    assert body["tiles"]["students"]["value"] == 3
    assert body["tiles"]["educators"]["value"] == 2
    assert body["tiles"]["published"] == {"value": 1, "sub": "1 still drafts"}
    assert [r["title"] for r in body["recent"]] == ["Published one"]
    assert body["recent"][0]["where"] == "A · 1A"


def test_the_overview_only_flags_things_it_can_prove(client, db, school) -> None:
    texts = [item["text"] for item in client.get("/admin/overview", headers=as_user("admin")).json()["attention"]]
    assert "6 people have never signed in" in texts
    client.get("/me", headers=as_user("s1"))
    client.get("/me", headers=as_user("admin"))
    texts = [item["text"] for item in client.get("/admin/overview", headers=as_user("admin")).json()["attention"]]
    assert "4 people have never signed in" in texts


def test_students_active_this_week_uses_the_real_timestamp(client, db, school) -> None:
    school["s1"].last_seen_at = datetime.now(UTC) - timedelta(days=1)
    school["s2"].last_seen_at = datetime.now(UTC) - timedelta(days=40)
    db.commit()
    tiles = client.get("/admin/overview", headers=as_user("admin")).json()["tiles"]
    assert tiles["students"]["sub"] == "1 active this week"


class _FakeLogins:
    """Stands in for Auth0Admin in the tests, so nothing reads the settings or the network.

    The second element is Auth0's one-time password-set link. It is a recognisable fake rather
    than "" so that a test can watch it travel from provision() to the create reply.
    """

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"test|{email}", f"https://tenant.test/invite/{email}"


class _LoginsWithoutATenant:
    """What DevLogins does: a local subject and no link at all, which is every local run."""

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        return f"dev|{email.split('@')[0]}", ""
