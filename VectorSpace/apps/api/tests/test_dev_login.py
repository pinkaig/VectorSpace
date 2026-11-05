"""The dev-only login (AUTH_DEV_BYPASS) and the demo seed that goes with it."""

import pytest
from apps.api.app import auth, seed
from apps.api.app.config import Settings
from apps.api.app.db import get_db
from apps.api.app.main import API_PREFIX, app
from apps.api.app.models import Actor
from apps.api.app.provision import provision
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select


@pytest.fixture
def real_login(db, monkeypatch):
    """A client that goes through the real get_current_token, with the bypass switched by the test."""
    app.dependency_overrides[get_db] = lambda: db

    def use(bypass: bool) -> TestClient:
        monkeypatch.setattr(auth, "get_settings", lambda: Settings(auth_dev_bypass=bypass, app_env="local"))
        return TestClient(app, base_url=f"http://testserver{API_PREFIX}/")

    yield use
    app.dependency_overrides.clear()


def seeded(db):
    provision(db, seed.DevLogins(), seed.SLUG, seed.SCHOOL, seed.ROWS)


def test_dev_token_signs_in_a_seeded_person(db, real_login):
    seeded(db)
    me = real_login(True).get("/me", headers={"Authorization": "Bearer dev|teacher"})
    assert me.status_code == 200 and me.json()["role"] == "teacher"


def test_dev_token_is_rejected_when_the_bypass_is_off(db, real_login):
    seeded(db)
    assert real_login(False).get("/me", headers={"Authorization": "Bearer dev|teacher"}).status_code == 401


def test_dev_token_for_nobody_is_403(db, real_login):
    seeded(db)
    assert real_login(True).get("/me", headers={"Authorization": "Bearer dev|nobody"}).status_code == 403


def test_bypass_cannot_be_on_outside_local(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    with pytest.raises(ValidationError):
        Settings(auth_dev_bypass=True, app_env="production")
    Settings(auth_dev_bypass=True, app_env="local")


def test_seed_twice_makes_no_duplicates(db):
    seeded(db)
    seeded(db)
    assert len(db.scalars(select(Actor)).all()) == len(seed.ROWS)


def test_seed_dry_run_writes_nothing(db):
    report = provision(db, None, seed.SLUG, seed.SCHOOL, seed.ROWS)
    assert {outcome for _, outcome, _ in report} == {"would create"}
    assert db.scalars(select(Actor)).all() == []


def test_a_protected_route_without_a_token_is_401(real_login) -> None:
    reply = real_login(False).get("/me")
    assert reply.status_code == 401
    assert reply.headers["www-authenticate"] == "Bearer"
