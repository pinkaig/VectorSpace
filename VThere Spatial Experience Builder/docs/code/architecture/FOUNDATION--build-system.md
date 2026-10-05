# Build System

**Baseline phase:** Not stage-specific — describes the system the 8 stages implement. See [8-stage baseline overview](../FOUNDATION--baseline-phases.md).

## Current client commands

Run from `VThere Spatial Experience Builder/`. This is a single npm workspace root (`package.json` declares `"workspaces": ["apps/*", "packages/*"]`); there is no per-package build step — `apps/*` and `packages/*` are consumed directly as TypeScript source (each package's `package.json` sets `"exports": "./src/index.ts"`).

```text
npm install
npm run check:environment   # node scripts/check-environment.mjs — also runs automatically as predev/prebuild
npm run dev                 # vite
npm run build                # tsc -b && vite build
npm run preview              # vite preview
npm run typecheck            # tsc --noEmit
npm test                     # vitest run
npm run test:e2e             # playwright test
```

These are the real scripts in the root `package.json`. `npm run check:environment` (`scripts/check-environment.mjs`) enforces Node.js 22+ and npm 10+ before dev/build proceed, and fails fast with an actionable message if `node_modules` is missing. `package-lock.json` is committed at the repo root.

Re-run during this documentation pass (Node v24.19.0): `npm install` completes cleanly; `npm run build` (`tsc -b && vite build`) succeeds — Vite emits a chunk-size warning (main bundle 867.20 kB / 237.87 kB gzipped, over the 500 kB default threshold) but exits 0; `npm test` (Vitest) passes all **29 test files / 210 tests**.

Vitest (`vitest.config.ts`) is scoped to `include: ['packages/**/*.test.ts', 'src/**/*.test.ts']` — it covers every package's unit tests (`packages/authoring-engine`, `packages/assets`, `packages/interaction`, `packages/sync`, `packages/debugging`, `packages/project` has no dedicated tests yet) plus root `src/**/*.test.ts` files (e.g. `src/serializer.test.ts`, `src/viewport/interactionMath.test.ts`, `src/gizmo/viewSnap.test.ts`, `src/sync/projectSync.test.ts`). It does **not** run the Python API tests.

Playwright (`playwright.config.ts`) drives `tests/e2e/` against a dev server it starts itself (`npm run dev -- --host 127.0.0.1 --port 4173`), using the Chromium project only.

## Backend commands

Dependencies are pinned in `apps/api/requirements.txt` (FastAPI 0.115.12, Uvicorn 0.34.2, SQLAlchemy 2.0.36, Alembic 1.14.0, psycopg 3.2.3, boto3 1.35.99, python-jose 3.3.0, pytest 9.1.1, httpx 0.28.1, pydantic-settings 2.7.1).

```text
pip install -r apps/api/requirements.txt
python -m pytest apps/api/tests               # run from the REPO ROOT, not apps/api/ — see note below
uvicorn app.main:app --reload                 # run from apps/api/ — local API server
alembic upgrade head                          # run from apps/api/ — apply migrations (0001_init.py exists)
```

Note: `apps/api/tests/test_health.py` imports the app as `from apps.api.app.main import app` (an absolute import rooted at the repository root, not a relative `apps/api`-local import). Re-verified during this documentation pass: running `pytest` from inside `apps/api/` fails with `ModuleNotFoundError: No module named 'apps'`; running `python -m pytest apps/api/tests` from the repository root passes (1 passed). Always invoke pytest from the repo root for this reason.

## Local infrastructure

```text
docker compose up -d postgres minio
```

`docker-compose.yml` at the repo root defines these two services (Postgres 16, MinIO with a healthcheck) for local development. Production deploy uses a separate `docker-compose.prod.yml` (Caddy reverse proxy, `frontend` built from the root `Dockerfile`, `api` built from `apps/api/Dockerfile`) — see `deploy/README.md`.

## Acceptance path

Fresh checkout -> install Node.js 22 LTS and Python 3.12 -> `npm install` at the repo root -> `pip install -r apps/api/requirements.txt` -> `docker compose up -d postgres minio` -> `alembic upgrade head` (from `apps/api/`) -> `npm run build` -> `npm test` (Vitest) -> `python -m pytest apps/api/tests` (from the repo root) -> `npm run test:e2e` (Playwright) -> `npm run dev` and `uvicorn app.main:app --reload` (from `apps/api/`) for manual verification.

Note: the FastAPI routers exist and are wired into `app.main:app`, but most route handlers (`projects.py`, `publish.py`, `media.py`, `analytics.py`, `rules.py`) still return HTTP 501 — only `GET /health` and JWT validation (`auth.py`) are real end-to-end behavior today. See [contracts.md](FOUNDATION--contracts.md) for the per-route status.
