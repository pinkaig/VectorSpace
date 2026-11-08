# VectorSpace API changelog

The contract itself is `openapi.yaml`, exported by `scripts/export_openapi.py` and checked by
`tests/test_openapi.py`. This file says what changed and whether a client has to do anything.

The rules:
- **Adding** a route, an optional request field or a response field is a v1 change. Note it here.
- **Renaming or removing** a field, making one required, or changing what a route means is a break.
  It goes under a new `/api/v2` router next to v1, and v1 keeps working until no client uses it.
- Every added or changed route also gets a request in the Postman collection
  (`postman/build_collection.py`, then regenerate and run Newman), in the same change.
- `/health` stays unversioned for the infrastructure probes (Render `healthCheckPath`, Docker
  `HEALTHCHECK`). `/api/v1/health` is the same answer for clients.

## v1, pack asset resolve (7 Nov 2026)

- Added `POST /api/v1/packs/resolve`, **no token needed**. Body `{ids: ["pack:<slug>:<asset id>", ...]}`
  (1 to 200 ids, each up to 200 characters; otherwise **422**). Answers `{assets: [...], missing: [...]}`:
  each asset has `id`, `url`, `kind`, `content_type`, `size_bytes`, `title`, `attribution`. An id the
  server will not serve (malformed, unknown pack, pack not published, file no longer in it) is listed
  in `missing`, never as an error. A client reads `missing` as "gone" and a failed request as "try
  again". It exists so a visitor with no token and no school can still show a shared project's cloud
  models; it gives only the public address the bucket already serves.
- Answers **503** if the server has no public storage address set (`S3_PUBLIC_BASE_URL`).
- Postman collection: two requests added to the Packs folder, 122 in all.

## v1, permissions (6 Nov 2026)

- Added `GET` and `PUT /api/v1/admin/schools/{school}/permissions` (admins, own school only). `GET`
  answers all 9 settings, saved or default, each with `enforced`. `PUT` takes a list of
  `{key, students, educators, can_adjust}`; a key left out keeps its value, and one unknown key
  answers **422** with nothing saved.
- Added `GET /api/v1/permissions/mine`: `{key: true|false}` for the caller's role. Admins get all true.
- **Behaviour change, same contract:** `POST /api/v1/projects` with a `template_id` now answers **403**
  when the school's "Set up projects from templates" setting refuses the caller's role. By default
  students are refused and teachers are allowed, so a client where a student copies a template
  itself must have the admin switch it on. Copies a teacher sends (`assign`, `assign-class`) are
  not affected. Admins are always allowed.
- The packs routes (`/api/v1/packs/*`, `/api/v1/admin/schools/{school}/packs`) were added in the
  asset-management change (PR #87) and are in `openapi.yaml`; they were not noted here at the time.
- Postman collection: new Packs (16 requests) and Permissions (12) folders, 120 requests in all.

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
