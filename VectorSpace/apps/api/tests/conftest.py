"""API test fixtures: in-memory SQLite, and a fake login where the bearer value is the Auth0 subject."""

import os

import pytest
from apps.api.app.auth import TokenPayload, get_current_token, get_optional_token
from apps.api.app.db import Base, get_db
from apps.api.app.main import API_PREFIX, app
from apps.api.app.models import Actor, ClassMember, Classroom, Organisation
from fastapi import Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# VS_RECORD_EXAMPLES=1 copies one real exchange per endpoint into app/openapi_examples.json
# (see record_examples.py); off by default so an ordinary run never rewrites that file
_recorder = None


def pytest_sessionstart(session) -> None:
    global _recorder
    if os.environ.get("VS_RECORD_EXAMPLES") == "1":
        from record_examples import Recorder

        _recorder = Recorder()
        _recorder.start()


def pytest_sessionfinish(session, exitstatus) -> None:
    if _recorder is not None:
        _recorder.stop()
        if exitstatus == 0:  # a failing run may have recorded answers the code no longer gives
            _recorder.write()


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


@pytest.fixture
def client(db: Session):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_token] = lambda authorization=Header(...): TokenPayload(
        {"sub": authorization.removeprefix("Bearer ")}
    )
    # the same fake login where signing in is optional (the visitor's page): no header, no one
    app.dependency_overrides[get_optional_token] = lambda authorization=Header(None): (
        TokenPayload({"sub": authorization.removeprefix("Bearer ")}) if authorization else None
    )
    # every request path in the tests is relative to the version prefix, as in src/api/client.ts
    yield TestClient(app, base_url=f"http://testserver{API_PREFIX}/")
    app.dependency_overrides.clear()


@pytest.fixture
def school(db: Session) -> dict[str, Actor]:
    """Two schools. School A: admin, two teachers, two classes, three students. School B: one teacher."""
    a, b = Organisation(name="A", slug="a"), Organisation(name="B", slug="b")
    db.add_all([a, b])
    db.flush()

    def person(org: Organisation, key: str, role: str) -> Actor:
        actor = Actor(
            organisation_id=org.id, auth0_subject=key, email=f"{key}@x.test", display_name=key, role=role
        )
        db.add(actor)
        return actor

    people = {
        "admin": person(a, "admin", "admin"),
        "t1": person(a, "t1", "teacher"),
        "t2": person(a, "t2", "teacher"),
        "s1": person(a, "s1", "student"),
        "s2": person(a, "s2", "student"),
        "s3": person(a, "s3", "student"),
        "other": person(b, "other", "teacher"),
    }
    class1, class2 = Classroom(organisation_id=a.id, name="1A"), Classroom(organisation_id=a.id, name="2B")
    db.add_all([class1, class2])
    db.flush()
    db.add_all(
        [
            ClassMember(class_id=class1.id, actor_id=people["t1"].id),
            ClassMember(class_id=class1.id, actor_id=people["s1"].id),
            ClassMember(class_id=class1.id, actor_id=people["s2"].id),
            ClassMember(class_id=class2.id, actor_id=people["t2"].id),
            ClassMember(class_id=class2.id, actor_id=people["s3"].id),
        ]
    )
    db.commit()
    people["class1"], people["class2"] = class1, class2
    return people
