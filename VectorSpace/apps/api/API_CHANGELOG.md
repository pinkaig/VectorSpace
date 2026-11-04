# VectorSpace API changelog

The contract itself is `openapi.yaml`, exported by `scripts/export_openapi.py` and checked by
`tests/test_openapi.py`. This file says what changed and whether a client has to do anything.

The rules:
- **Adding** a route, an optional request field or a response field is a v1 change. Note it here.
- **Renaming or removing** a field, making one required, or changing what a route means is a break.
  It goes under a new `/api/v2` router next to v1, and v1 keeps working until no client uses it.
- `/health` stays unversioned for the infrastructure probes (Render `healthCheckPath`, Docker
  `HEALTHCHECK`). `/api/v1/health` is the same answer for clients.

## v1 (4 Nov 2026)

- **Breaking for any client that called the old paths:** every route moved under `/api/v1`, for
  example `GET /me` is now `GET /api/v1/me`. The browser app adds the prefix in one place,
  `src/api/client.ts` (`apiPrefix`), so `VITE_API_URL` stays the bare origin.
- Added `GET /api/v1/health`. The bare `GET /health` is unchanged.
- First committed `openapi.yaml`, with one real example request and response per endpoint, recorded
  from the test suite (`tests/record_examples.py` → `app/openapi_examples.json`).
- Documented two status codes the spec was missing: `POST /api/v1/library/tickets` answers **201**
  for a new upload (200 only for a duplicate), and the unbuilt routes answer **501**.
- A protected route called with no `Authorization` header now answers **401** with
  `WWW-Authenticate: Bearer` (it was FastAPI's default 403). A bad token was already 401.
