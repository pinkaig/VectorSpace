"""Auth0 JWKS + JWT validation.

Real infrastructure (not skeleton): fetches and caches the tenant's JWKS,
validates bearer tokens against it, and exposes a FastAPI dependency that
routers can use to require an authenticated actor.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from .config import get_settings

security = HTTPBearer(auto_error=True)


class TokenPayload(dict):
    """Decoded JWT claims."""


@lru_cache
def _jwks() -> dict[str, Any]:
    settings = get_settings()
    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()
    return response.json()


def _signing_key(token: str) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed token: {exc}",
        ) from exc
    kid = unverified_header.get("kid")
    for key in _jwks().get("keys", []):
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
    return decode_token(credentials.credentials)
