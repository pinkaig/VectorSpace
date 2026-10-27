"""Auth0 JWKS + JWT validation.

Real infrastructure (not skeleton): fetches and caches the tenant's JWKS,
validates bearer tokens against it, and exposes FastAPI dependencies that
routers can use to require a verified token (get_current_token) or a known,
active school user (get_current_actor).
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Actor

security = HTTPBearer(auto_error=True)

# A real Auth0 subject looks like "auth0|abc..."; "dev|" can never collide with one.
DEV_PREFIX = "dev|"


class TokenPayload(dict):
    """Decoded JWT claims."""


# How long a fetched key set is trusted without asking Auth0 again. Short enough that a
# rotated key is picked up on its own, long enough that Auth0 is not called per request.
JWKS_TTL_SECONDS = 600.0

_jwks_cache: dict[str, Any] | None = None
_jwks_fetched_at = 0.0


def reset_jwks_cache() -> None:
    """Forget the cached key set. For tests and for a deliberate re-fetch."""
    global _jwks_cache, _jwks_fetched_at
    _jwks_cache = None
    _jwks_fetched_at = 0.0


def _fetch_jwks() -> dict[str, Any]:
    settings = get_settings()
    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()
    return response.json()


def _jwks(force: bool = False) -> dict[str, Any]:
    """The tenant's signing keys, cached for JWKS_TTL_SECONDS.

    Two failure modes are deliberate. A cached key set that has gone stale is served when
    Auth0 cannot be reached, so an Auth0 outage does not take every protected endpoint
    down with it — the keys it holds are still the right ones. With no cache at all there
    is nothing to validate against, so the request fails as 503 (temporarily unable to
    answer) rather than 401 (your token is bad), which would be a lie.
    """
    global _jwks_cache, _jwks_fetched_at
    fresh = _jwks_cache is not None and time.monotonic() - _jwks_fetched_at < JWKS_TTL_SECONDS
    if fresh and not force:
        return _jwks_cache  # type: ignore[return-value]
    try:
        _jwks_cache = _fetch_jwks()
        _jwks_fetched_at = time.monotonic()
    except (httpx.HTTPError, ValueError) as exc:
        if _jwks_cache is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cannot reach the identity provider to verify this token",
            ) from exc
    return _jwks_cache


def _signing_key(token: str) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed token: {exc}",
        ) from exc
    kid = unverified_header.get("kid")
    # An unknown kid is what a just-rotated signing key looks like, so ask once more with
    # a forced re-fetch before calling the token invalid — but only if the first lookup was
    # answered from the cache, otherwise it has just been fetched and asking again is noise.
    fetched_at = _jwks_fetched_at
    for key in _jwks().get("keys", []):
        if key.get("kid") == kid:
            return key
    if _jwks_fetched_at == fetched_at:
        for key in _jwks(force=True).get("keys", []):
            if key.get("kid") == kid:
                return key
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find a matching JWKS signing key for this token",
    )


def decode_token(token: str) -> TokenPayload:
    settings = get_settings()
    signing_key = _signing_key(token)
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc
    return TokenPayload(claims)


def get_current_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    token = credentials.credentials
    if get_settings().auth_dev_bypass and token.startswith(DEV_PREFIX):
        return TokenPayload({"sub": token})
    return decode_token(token)


def get_current_actor(
    token: TokenPayload = Depends(get_current_token),
    db: Session = Depends(get_db),
) -> Actor:
    """Map a verified token to a school user row. Auth0 proves who; our table says what they may do."""
    actor = db.scalar(select(Actor).where(Actor.auth0_subject == token.get("sub")))
    if actor is None or not actor.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active account for this login")
    return actor
