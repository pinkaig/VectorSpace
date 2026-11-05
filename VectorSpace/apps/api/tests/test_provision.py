"""Roster provisioning: dry run writes nothing, apply creates login + row + classes, re-run is safe."""

import pytest
from apps.api.app.models import Actor, ClassMember, Classroom
from apps.api.app.provision import Row, provision, read_rows
from sqlalchemy import func, select


class FakeAuth0:
    def __init__(self) -> None:
        self.created: list[str] = []

    def create_user(self, email: str, display_name: str) -> tuple[str, str]:
        self.created.append(email)
        return f"auth0|{email}", f"https://invite/{email}"


ROWS = [
    Row("t@x.test", "Teacher", "teacher", ["1A"]),
    Row("s@x.test", "Student", "student", ["1A", "Art"]),
]


def test_dry_run_writes_nothing(db) -> None:
    report = provision(db, None, "demo", "Demo", ROWS)
    assert [r[1] for r in report] == ["would create", "would create"]
    assert db.scalar(select(func.count()).select_from(Actor)) == 0


def test_apply_creates_school_users_and_classes(db) -> None:
    auth0 = FakeAuth0()
    report = provision(db, auth0, "demo", "Demo", ROWS)
    assert [r[1] for r in report] == ["created", "created"]
    assert report[0][2] == "https://invite/t@x.test"
    assert db.scalar(select(Actor.auth0_subject).where(Actor.email == "s@x.test")) == "auth0|s@x.test"
    assert db.scalar(select(func.count()).select_from(Classroom)) == 2
    assert db.scalar(select(func.count()).select_from(ClassMember)) == 3


def test_rerun_updates_without_duplicating(db) -> None:
    auth0 = FakeAuth0()
    provision(db, auth0, "demo", "Demo", ROWS)
    report = provision(db, auth0, "demo", None, [Row("s@x.test", "Student", "teacher", ["1A"])])
    assert report[0][1] == "updated"
    assert auth0.created == ["t@x.test", "s@x.test"]
    assert db.scalar(select(Actor.role).where(Actor.email == "s@x.test")) == "teacher"
    assert db.scalar(select(func.count()).select_from(ClassMember)) == 3


def test_unknown_school_needs_a_name(db) -> None:
    with pytest.raises(ValueError):
        provision(db, None, "nope", None, ROWS)


def test_csv_with_a_bad_role_is_refused(tmp_path) -> None:
    path = tmp_path / "r.csv"
    path.write_text("email,display_name,role,classes\na@x.test,A,principal,\n", encoding="utf-8")
    with pytest.raises(ValueError):
        read_rows(str(path))
