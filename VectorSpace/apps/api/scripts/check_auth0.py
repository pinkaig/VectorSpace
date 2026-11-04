"""Check the Auth0 wiring against the real tenant, one layer at a time.

Run from apps/api (the .venv must be active, or call .venv\\Scripts\\python.exe):

    python scripts/check_auth0.py                       # everything that needs no token
    python scripts/check_auth0.py --token <access_token>  # also validate a token
    python scripts/check_auth0.py --token <t> --api http://localhost:8000   # also call /me

Layers: 1 API config, 2 tenant, 3 browser config, 4 the login redirect the browser
would make, 5 the SPA application's settings (needs the M2M creds), 6 token, 7 live API.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

# make `app` importable no matter where the script is launched from
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

import httpx  # noqa: E402
from dotenv import dotenv_values  # noqa: E402

from app.auth import decode_token, reset_jwks_cache  # noqa: E402
from app.config import get_settings  # noqa: E402

BROWSER_ENV = API_DIR.parents[1] / ".env.auth0"  # Vite loads this only for --mode auth0
ROOT_ENV = API_DIR.parents[1] / ".env"           # the VITE_ values lived here before .env.auth0
ORIGIN = "http://localhost:5173"
failures = 0


def report(ok: bool | None, label: str, detail: str = "") -> None:
    """ok=None prints a note that is neither a pass nor a failure."""
    global failures
    if ok is False:
        failures += 1
    tag = {True: "ok  ", False: "FAIL", None: "note"}[ok]
    print(f"[{tag}] {label}" + (f" -- {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n== {title}")


def check_api_config(s) -> bool:
    section("1. API config (apps/api/.env)")
    report(bool(s.auth0_domain), "AUTH0_DOMAIN set", s.auth0_domain or "empty: it must be in apps/api/.env, not the root .env")
    report(bool(s.auth0_audience), "AUTH0_AUDIENCE set", s.auth0_audience or "empty")
    report(not s.auth_dev_bypass, "AUTH_DEV_BYPASS off", "ON: dev|name tokens skip Auth0 entirely" if s.auth_dev_bypass else "")
    return bool(s.auth0_domain and s.auth0_audience)


def check_tenant(s) -> bool:
    section("2. Tenant")
    base = f"https://{s.auth0_domain}"
    try:
        meta = httpx.get(f"{base}/.well-known/openid-configuration", timeout=10).json()
        report(meta.get("issuer") == f"{base}/", "issuer matches what the API expects", str(meta.get("issuer")))
        keys = httpx.get(f"{base}/.well-known/jwks.json", timeout=10).json().get("keys", [])
        report(bool(keys), "JWKS publishes signing keys", f"{len(keys)} key(s)")
        return True
    except (httpx.HTTPError, ValueError) as exc:
        report(False, "tenant reachable", f"{exc} (typo in the domain, or no network)")
        return False


def check_browser_config(s) -> dict | None:
    section("3. Browser config (VectorSpace/.env.auth0)")
    if not (BROWSER_ENV.exists() or ROOT_ENV.exists()):
        report(False, f"{BROWSER_ENV.name} exists", f"not found at {BROWSER_ENV}; create it with the VITE_ values")
        return None
    # .env.auth0 is where `npm run dev:auth0` reads them; .env is the older home and still wins
    # nothing, so it is only a fallback for a checkout that has not moved them yet.
    env = {**dotenv_values(ROOT_ENV), **dotenv_values(BROWSER_ENV)}
    report(BROWSER_ENV.exists(), f"{BROWSER_ENV.name} exists",
           "" if BROWSER_ENV.exists() else f"falling back to {ROOT_ENV.name}; `npm run dev:auth0` reads .env.auth0")
    vite = {k: (env.get(k) or "").strip() for k in ("VITE_API_URL", "VITE_AUTH0_DOMAIN", "VITE_AUTH0_CLIENT_ID", "VITE_AUTH0_AUDIENCE")}
    for key, value in vite.items():
        report(bool(value), f"{key} set", value if key != "VITE_AUTH0_CLIENT_ID" else (value[:6] + "..." if value else "copy it from the SPA application in Auth0"))
    if vite["VITE_AUTH0_DOMAIN"]:
        report(vite["VITE_AUTH0_DOMAIN"] == s.auth0_domain, "VITE_AUTH0_DOMAIN equals AUTH0_DOMAIN")
    if vite["VITE_AUTH0_AUDIENCE"]:
        report(vite["VITE_AUTH0_AUDIENCE"] == s.auth0_audience, "VITE_AUTH0_AUDIENCE equals AUTH0_AUDIENCE", "must be identical, even a trailing slash")
    return vite if all(vite.values()) else None


def check_login_redirect(s, vite: dict) -> None:
    section("4. Login redirect (what the browser does when you click sign in)")
    params = {
        "client_id": vite["VITE_AUTH0_CLIENT_ID"],
        "response_type": "code",
        "redirect_uri": ORIGIN,
        "audience": vite["VITE_AUTH0_AUDIENCE"],
        "scope": "openid profile email",
        "code_challenge": "x" * 43,
        "code_challenge_method": "S256",
        "state": "check",
    }
    try:
        r = httpx.get(f"https://{s.auth0_domain}/authorize", params=params, follow_redirects=False, timeout=10)
    except httpx.HTTPError as exc:
        report(False, "authorize endpoint reachable", str(exc))
        return
    location = r.headers.get("location", "")
    if r.status_code in (301, 302, 303) and "/login" in urlparse(location).path:
        report(True, "Auth0 accepts the client, callback URL and audience", "would show the login page")
    elif location.startswith(ORIGIN):
        q = parse_qs(urlparse(location).query)
        report(False, "Auth0 accepted the client but refused the request", f"{q.get('error', ['?'])[0]}: {q.get('error_description', [''])[0]}")
    else:
        body = r.text[:300].replace("\n", " ")
        report(False, f"authorize returned HTTP {r.status_code}", body)
        if r.status_code in (400, 403):
            print(f"       likely causes: wrong client id, or {ORIGIN} missing from Allowed Callback URLs in the SPA application")


def check_spa_settings(s, vite: dict) -> None:
    section("5. SPA application settings (via the M2M credentials)")
    if not (s.auth0_mgmt_client_id and s.auth0_mgmt_client_secret):
        report(None, "skipped", "AUTH0_MGMT_CLIENT_ID/SECRET not set in apps/api/.env")
        return
    try:
        tok = httpx.post(
            f"https://{s.auth0_domain}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": s.auth0_mgmt_client_id,
                "client_secret": s.auth0_mgmt_client_secret,
                "audience": f"https://{s.auth0_domain}/api/v2/",
            },
            timeout=10,
        )
    except httpx.HTTPError as exc:
        report(False, "M2M token request", str(exc))
        return
    if tok.status_code != 200:
        report(False, "M2M credentials accepted", tok.json().get("error_description", tok.text[:200]))
        return
    report(True, "M2M credentials accepted by Auth0")
    r = httpx.get(
        f"https://{s.auth0_domain}/api/v2/clients/{vite['VITE_AUTH0_CLIENT_ID']}",
        headers={"Authorization": f"Bearer {tok.json()['access_token']}"},
        params={"fields": "name,app_type,callbacks,allowed_logout_urls,web_origins"},
        timeout=10,
    )
    if r.status_code in (401, 403):
        report(None, "cannot read the SPA application", "the M2M app lacks the read:clients scope; step 4 already covers the callback URL")
        return
    if r.status_code != 200:
        report(False, "SPA application found", f"HTTP {r.status_code}: {r.text[:200]}")
        return
    c = r.json()
    report(c.get("app_type") == "spa", "application type is Single Page Application", str(c.get("app_type")))
    for field, label in (("callbacks", "Allowed Callback URLs"), ("allowed_logout_urls", "Allowed Logout URLs"), ("web_origins", "Allowed Web Origins")):
        report(ORIGIN in (c.get(field) or []), f"{label} includes {ORIGIN}", str(c.get(field)))


def check_token(token: str) -> bool:
    section("6. Token against the API's own validator")
    reset_jwks_cache()
    try:
        claims = decode_token(token)
    except Exception as exc:  # HTTPException carries the reason in .detail
        report(False, "token accepted", str(getattr(exc, "detail", exc)))
        return False
    report(True, "token accepted", f"sub={claims.get('sub')}")
    return True


def check_live_api(api: str, token: str | None) -> None:
    section(f"7. Running API at {api}")
    try:
        h = httpx.get(f"{api}/health", timeout=5)
        report(h.status_code == 200, "/health", f"HTTP {h.status_code}")
    except httpx.HTTPError:
        report(False, "/health reachable", "the API is not running: start it with `uvicorn app.main:app --reload` from apps/api")
        return
    if not token:
        report(None, "/me skipped", "pass --token to call it")
        return
    me = httpx.get(f"{api}/api/v1/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if me.status_code == 200:
        report(True, "/me returned an account", me.text[:200])
    elif me.status_code == 403:
        report(None, "/me 403: token is valid, but no roster row matches this login", "Auth0 is wired; the next step is provisioning this user")
    else:
        report(False, f"/me HTTP {me.status_code}", me.text[:200])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--token", help="an access token for the API (APIs > your API > Test tab)")
    parser.add_argument("--api", help="base URL of a running API, e.g. http://localhost:8000")
    args = parser.parse_args()

    s = get_settings()
    if check_api_config(s) and check_tenant(s):
        vite = check_browser_config(s)
        if vite:
            check_login_redirect(s, vite)
            check_spa_settings(s, vite)
        if args.token:
            check_token(args.token)
    if args.api:
        check_live_api(args.api, args.token)

    print(f"\n{'All checks passed.' if not failures else f'{failures} check(s) failed.'}")
    return 1 if failures else 0


sys.exit(main())
