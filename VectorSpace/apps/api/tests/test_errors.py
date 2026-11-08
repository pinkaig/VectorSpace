"""Every failure the API reports has one shape: detail, code, apiVersion, source, timestamp, requestId."""

from datetime import datetime

import pytest
from apps.api.app.main import API_PREFIX, app
from fastapi.testclient import TestClient

ENVELOPE = {"detail", "code", "apiVersion", "source", "timestamp", "requestId"}


def assert_envelope(response, status: int, code: str) -> dict:
    body = response.json()
    assert response.status_code == status
    assert ENVELOPE <= set(body)
    assert body["code"] == code
    assert body["apiVersion"] == "v1"
    assert body["source"] == "vectorspace-api"
    datetime.fromisoformat(body["timestamp"])
    assert body["requestId"] == response.headers["x-request-id"]
    return body


def test_an_unknown_path_answers_in_the_one_shape(client) -> None:
    body = assert_envelope(client.get("no-such-route"), 404, "not_found")
    assert isinstance(body["detail"], str)


def test_a_refused_request_answers_in_the_one_shape(client, school) -> None:
    # signed in as someone with no account: the 403 raised in auth.py
    body = assert_envelope(client.get("me", headers={"Authorization": "Bearer nobody"}), 403, "forbidden")
    assert body["detail"] == "No active account for this login"


def test_the_request_id_sent_by_the_caller_comes_back_in_the_body(client) -> None:
    response = client.get("no-such-route", headers={"x-request-id": "trace-me-1"})
    assert response.json()["requestId"] == "trace-me-1"
    assert response.headers["x-request-id"] == "trace-me-1"


def test_bad_input_says_which_field_and_why_in_plain_words(client, school) -> None:
    reply = client.post("classes", json={"school_id": str(school["admin"].organisation_id)}, headers={"Authorization": "Bearer admin"})
    body = assert_envelope(reply, 422, "invalid_request")
    assert isinstance(body["detail"], str)  # a sentence a popup can show, not FastAPI's list
    assert body["fields"][0]["field"] == "name"
    assert body["fields"][0]["message"]


def test_a_conflict_keeps_its_object_detail(client, school) -> None:
    # the editor reads detail.current_revision from a 409, so the envelope must not flatten it
    from apps.api.app.errors import envelope

    body = envelope(409, {"message": "Saved elsewhere since you loaded it", "current_revision": 3}, request_id="r")
    assert body["detail"]["current_revision"] == 3
    assert body["code"] == "conflict"


@pytest.mark.parametrize(
    ("status", "code"),
    [(400, "bad_request"), (401, "unauthorised"), (403, "forbidden"), (404, "not_found"), (409, "conflict"),
     (413, "too_large"), (422, "invalid_request"), (429, "rate_limited"), (500, "server_error"),
     (502, "upstream_unavailable"), (503, "unavailable"), (501, "not_built")],
)
def test_each_status_has_a_stable_code(status: int, code: str) -> None:
    from apps.api.app.errors import envelope

    assert envelope(status, "x", request_id="r")["code"] == code


def test_a_crash_is_reported_without_leaking_what_went_wrong() -> None:
    @app.get(f"{API_PREFIX}/_boom")
    def boom() -> None:
        raise RuntimeError("secret connection string postgres://user:pw@host")

    try:
        reply = TestClient(app, raise_server_exceptions=False).get(f"{API_PREFIX}/_boom")
    finally:
        app.router.routes.pop()
    body = assert_envelope(reply, 500, "server_error")
    assert "secret" not in reply.text
    assert "try again" in body["detail"].lower()


# ---- limits on what a caller may send ------------------------------------------------------

def _bodies(spec: dict):
    for path, operations in spec["paths"].items():
        for method, operation in operations.items():
            ref = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {}).get("$ref")
            if ref:
                yield f"{method.upper()} {path}", spec["components"]["schemas"][ref.rsplit("/", 1)[1]]


def test_every_text_and_list_a_route_accepts_has_a_limit() -> None:
    """A new field with no max_length fails here, so no route can take an unbounded string or list."""
    unlimited = []
    for route, schema in _bodies(app.openapi()):
        for name, prop in schema.get("properties", {}).items():
            options = prop.get("anyOf", [prop])
            for option in options:
                kind = option.get("type")
                if kind == "string" and not ({"maxLength", "enum", "pattern"} & set(option)) and option.get("format") not in ("uuid", "date", "date-time"):
                    unlimited.append(f"{route} {name}: text with no maxLength")
                if kind == "array" and "maxItems" not in option:
                    unlimited.append(f"{route} {name}: list with no maxItems")
    assert unlimited == []


def test_a_request_too_big_to_be_real_is_refused_before_it_is_read(client, school) -> None:
    reply = client.post(
        "projects",
        content=b'{"name": "' + b"x" * (6 * 1024 * 1024) + b'"}',
        headers={"Authorization": "Bearer admin", "Content-Type": "application/json"},
    )
    body = assert_envelope(reply, 413, "too_large")
    assert "too large" in body["detail"].lower()


def test_a_long_name_is_refused_with_the_field_named(client, school) -> None:
    reply = client.post("projects", json={"name": "x" * 500}, headers={"Authorization": "Bearer t1"})
    body = assert_envelope(reply, 422, "invalid_request")
    assert body["fields"][0]["field"] == "name"
    assert "at most" in body["fields"][0]["message"]


# ---- the spec documents the same shape ------------------------------------------------------

def test_the_spec_documents_the_error_shape_with_examples() -> None:
    spec = app.openapi()
    schema = spec["components"]["schemas"]["ErrorResponse"]
    assert ENVELOPE <= set(schema["properties"])
    operation = spec["paths"][f"{API_PREFIX}/projects"]["post"]["responses"]
    for status in ("401", "403", "404", "413", "422", "500"):
        reply = operation[status]
        assert reply["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")
        assert ENVELOPE <= set(reply["content"]["application/json"]["example"])
    assert "fields" in operation["422"]["content"]["application/json"]["example"]
