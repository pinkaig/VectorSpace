# Postman collection for /api/v1

A second client of the API the web app uses, with nothing changed for it. 139 requests in 13 folders:
Health, Auth, Me, Classes, Projects, Media, Submissions, Public, Analytics, Library, Packs, Admin,
Permissions. Every request checks its status code, a time budget and the JSON shape. 52 of them carry
the recorded example from `app/openapi_examples.json`, which is what a Postman mock server answers with.

**A new or changed route gets a request here in the same change** (the rule is also in
`API_CHANGELOG.md`). Add it to `build_collection.py`, regenerate, and run Newman before committing.

The JSON files are generated. Edit `build_collection.py`, then, from `VectorSpace/`:

    apps/api/.venv/Scripts/python apps/api/postman/build_collection.py

## Environments

| File | Points at | Tokens | `allow_writes` |
|---|---|---|---|
| `local.postman_environment.json` | uvicorn on 127.0.0.1:8000 | `dev\|admin`, `dev\|teacher`, `dev\|student1`, `dev\|student2` | true |
| `ci.postman_environment.json` | the CI job's uvicorn | same dev logins | true |
| `deployed.postman_environment.json` | the Render API | **empty**: never commit real ones | false |

`allow_writes=false` skips the 26 requests that leave rows behind or change a setting: a new account, a
student's copy and its hand-ins, a library ticket, the templates permission (switched off and put back).
The rest create a draft (a project, a pack) and delete it again.

## Run it locally

The data is the synthetic Demo School from `app/seed.py`, in the local Docker Postgres and MinIO.
`apps/api/.env` points at Neon and R2, so do not start uvicorn by hand with it. The launcher overrides
every setting that matters (environment variables win over `.env`), creates the bucket, migrates,
reseeds and starts the API. With Docker Desktop running, from `VectorSpace/`:

    apps/api/.venv/Scripts/python apps/api/postman/run_local_api.py

Leave it running (Ctrl+C stops it; `--no-seed` keeps the last run's data). Then, in a second terminal,
in `apps/api/postman`:

    npx newman@6.2.1 run vectorspace.postman_collection.json -e local.postman_environment.json

### In the Postman app

1. **Import** (top left) → drop in `vectorspace.postman_collection.json` and `local.postman_environment.json`.
2. Top right environment dropdown → **VectorSpace local**.
3. Collection → ⋯ → **Run collection** → keep the order → **Run**. Every folder should be green.
4. Click any request to see its status, time and the **Test Results** tab.

Use the **desktop** app. The browser version of Postman cannot reach `127.0.0.1` unless the Postman
Desktop Agent is installed. A rerun works on the same data, because new names include a `run_id`.

## In CI

The `postman` job in `.github/workflows/ci.yml` does the same with GitHub's Postgres service and a
MinIO container, runs the collection with `ci.postman_environment.json`, and uploads `newman-report.xml`
(junit) plus the uvicorn log as the `newman-report` artifact.

## Run it against the deployed API

You need four Auth0 access tokens from the pilot school: the admin, a teacher, and two students in
one of that teacher's classes. Sign in on the deployed site as each person, open DevTools → Network,
click any `/api/v1/...` request and copy the value after `Bearer ` in its `Authorization` header.
The tokens expire, so take them just before the run.

Pass them on the command line so they never land in a file:

    npx newman@6.2.1 run vectorspace.postman_collection.json -e deployed.postman_environment.json \
      --env-var token_admin=... --env-var token_teacher=... \
      --env-var token_student=... --env-var token_student2=...

Or, in the Postman app, paste them as **current values** in the deployed environment. Postman keeps
current values on your machine and does not export or sync them. A free Render service sleeps, so the
first request gets a 90 s budget.

## Mock server

The current Postman app has no "Mock collection" on the free plan. Its local mocks are a JavaScript
file, and a shareable URL needs a paid plan. So `build_mock.py` turns the 48 recorded examples into
`vectorspace_mock.cjs`, a mock of `/api/v1` with the same answers. A UUID in a path matches any id,
query strings are ignored, a list gets `X-Total-Count`, and an unknown route answers 404 with the
routes it knows.

    apps/api/.venv/Scripts/python apps/api/postman/build_mock.py     # after build_collection.py

In Postman: **Mocks → + → new mock**, open its `default` scenario, replace the template with the
contents of `vectorspace_mock.cjs`, and press **Start**. Then send `GET http://localhost:4500/api/v1/health`.
Without Postman: `node apps/api/postman/vectorspace_mock.cjs` serves the same thing on port 4500.
