"""The JWKS cache: a TTL instead of forever, and the tenant's last known keys when Auth0 is down."""

import httpx
import pytest
from apps.api.app import auth
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def empty_cache():
    auth.reset_jwks_cache()
    yield
    auth.reset_jwks_cache()


@pytest.fixture
def fetches(monkeypatch):
    """Count calls to the live fetch, and let a test make the next one fail."""
    state = {"calls": 0, "fail": False, "keys": [{"kid": "first"}]}

    def fake_fetch() -> dict:
        state["calls"] += 1
        if state["fail"]:
            raise httpx.ConnectError("Auth0 unreachable")
        return {"keys": state["keys"]}

    monkeypatch.setattr(auth, "_fetch_jwks", fake_fetch)
    return state


def test_a_fresh_cache_is_reused_and_a_stale_one_is_refetched(fetches, monkeypatch):
    clock = {"now": 1000.0}
    monkeypatch.setattr(auth.time, "monotonic", lambda: clock["now"])

    auth._jwks()
    auth._jwks()
    assert fetches["calls"] == 1, "a second call inside the TTL must not reach Auth0"

    clock["now"] += auth.JWKS_TTL_SECONDS + 1
    auth._jwks()
    assert fetches["calls"] == 2, "past the TTL the key set is fetched again, so a rotation is picked up"


def test_a_stale_cache_is_served_when_auth0_cannot_be_reached(fetches, monkeypatch):
    clock = {"now": 1000.0}
    monkeypatch.setattr(auth.time, "monotonic", lambda: clock["now"])

    assert auth._jwks()["keys"] == [{"kid": "first"}]
    clock["now"] += auth.JWKS_TTL_SECONDS + 1
    fetches["fail"] = True

    # the keys we hold are still the tenant's keys, so an Auth0 outage must not 401 everyone
    assert auth._jwks()["keys"] == [{"kid": "first"}]


def test_with_no_cache_at_all_an_outage_is_503_not_401(fetches):
    fetches["fail"] = True
    with pytest.raises(HTTPException) as raised:
        auth._jwks()
    assert raised.value.status_code == 503


def test_an_unknown_kid_forces_one_refetch_before_the_token_is_rejected(fetches, monkeypatch):
    monkeypatch.setattr(auth.jwt, "get_unverified_header", lambda token: {"kid": "second"})

    with pytest.raises(HTTPException) as raised:
        auth._signing_key("irrelevant")
    assert raised.value.status_code == 401
    # one fetch to fill the empty cache, and no second one: that fetch was already live
    assert fetches["calls"] == 1

    fetches["keys"] = [{"kid": "first"}, {"kid": "second"}]
    assert auth._signing_key("irrelevant") == {"kid": "second"}
    assert fetches["calls"] == 2, "a kid missing from a cached key set is re-checked against Auth0 once"
