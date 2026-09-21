# VThere Spatial Experience Builder — Technology Stack

**Baseline phase:** Not stage-specific — describes the system the 8 stages implement. See [8-stage baseline overview](../baseline-phases.md).

**Status note:** this document was originally written as a pre-implementation proposal ("Stage 2 of 5", "Resolved proposal for human approval", closing status `BLOCKED`, Node/npm "unavailable"). All 8 baseline stages are now complete, `npm install`/`npm run build`/`npm test` run successfully in this environment, and the stack below is running code, not a proposal. Sections are corrected in place with confirmed versions and status; where a claim (cloud provider config, CI wiring, browser matrix) could not be verified against source in this repo, it is left as originally written and marked accordingly.

## 1. Technology Overview

The stack is a browser-first TypeScript application using React for authoring UI, Vite for development/build orchestration, and Three.js for the custom spatial viewport and authoring mathematics, backed by a FastAPI service.

- **CONFIRMED — Browser client:** authoring editor (`src/App.tsx`) and visitor runtime (`src/RuntimeView.tsx`), exposed through transitional `apps/editor`/`apps/runtime` boundaries.
- **CONFIRMED — Shared TypeScript domain packages:** `packages/project` (canonical model), `packages/authoring-engine`, `packages/assets`, `packages/interaction`, `packages/sync`, `packages/debugging`. There is no single monolithic "shared domain package" — responsibilities are split across these six packages plus `src/serializer.ts` for serialization.
- **PARTIAL — Backend services:** FastAPI routing, SQLAlchemy models, Auth0 JWT validation, and boto3 presigned-URL generation are implemented; persistence, publishing, access control enforcement, and analytics ingestion are not — the routes exist but return HTTP 501 (see [contracts.md](UNDATED--FOUNDATION--contracts.md)).
- **CONFIRMED — Custom authoring systems:** selection/raycasting (`src/viewport/`), transform manipulation (`src/gizmo/`, `packages/authoring-engine/src/transformMath.ts`), serialization (`src/serializer.ts`), interaction dispatch (`packages/interaction`), and undo/redo (`packages/authoring-engine`'s `createCommandTimeline`). No ready-made editor framework supplies these.
- **CONFIRMED — Persistence as a build factor:** command history correctness and undo/redo are tested (`packages/authoring-engine/src/index.test.ts`); canonical serialization and autosave are implemented (`src/serializer.ts`, `src/serializer.test.ts`); backup recovery exists in the serializer; revision safety and immutable published versions are modeled in `apps/api/app/models.py` (`ProjectVersion`) but not yet enforced end-to-end since publish routes are unimplemented.

## 2. Programming Languages

- **CONFIRMED — TypeScript 5.8.3** (root `package.json`): browser application, shared domain packages, editor, runtime, and API boundary types.
- **SQL:** used implicitly through SQLAlchemy/Alembic; no hand-written SQL in the repo.
- **CONFIRMED — Backend language:** Python 3.12, FastAPI app under `apps/api/`.

## 3. Frameworks

- **CONFIRMED — React 19.1.0 / React DOM 19.1.0** (root `package.json`): editor and runtime UI composition.
- **CONFIRMED — Vite 6.3.5** with `@vitejs/plugin-react` 4.4.1: browser dev server and production bundling (`npm run dev`, `npm run build`).
- **CONFIRMED — Backend framework:** FastAPI 0.115.12 (`apps/api/requirements.txt`), Pydantic v2 request/response models per router, Uvicorn 0.34.2 as the ASGI server.

## 4. Libraries

- **CONFIRMED — Three.js 0.177.0** (`@types/three` 0.177.0 pinned alongside): browser 3D rendering, camera, geometry, materials, scene graph primitives, and raycaster utilities in `src/Viewport.tsx` and `src/viewport/`. Custom selection constraints, gizmo mathematics (`src/gizmo/`), transform commands (`packages/authoring-engine`), and serialization (`src/serializer.ts`) remain project-owned.
- **CONFIRMED — React DOM 19.1.0:** browser mounting and UI rendering.
- **Schema validation library:** none added; `ProjectData` validation remains hand-written backfill logic in the serializer, not a library like Zod.
- **CONFIRMED — Frontend test runner:** Vitest 3.1.2, scoped to `packages/**/*.test.ts` and `src/**/*.test.ts` (`vitest.config.ts`).
- **CONFIRMED — Browser automation:** Playwright 1.55.0 (`@playwright/test`), `tests/e2e/`, Chromium project only today.
- **CONFIRMED — Backend test runner:** pytest 9.1.1 with httpx 0.28.1 (`apps/api/tests/test_health.py`).
- **FORBIDDEN — Ready-made spatial editor framework:** confirmed absent. Gizmos, scene serialization, and the interaction engine are all custom.

## 5. Runtime Environment

- **REQUIRED — Modern browser:** WebGL-capable browser for editor and visitor runtime.
- **CONFIRMED — Node.js LTS:** `package.json` `engines` requires Node >=22.0.0, npm >=10.0.0; enforced at `predev`/`prebuild` by `scripts/check-environment.mjs`.
- **REQUIRED — Production API runtime:** Uvicorn behind Caddy (see `deploy/Caddyfile`, `docker-compose.prod.yml`).
- **CONFIRMED, STILL TIER-1-ONLY — Browser storage:** `src/serializer.ts` uses `localStorage` for the primary draft/backup/autosave path (Tier 1). `packages/sync`'s `SyncClient`/`SyncQueue` (Tier 2, wired via `src/sync/projectSync.ts`) layers background dual-write on top, but its transport is currently a `StubSyncTransport` — no real backend write endpoint exists yet, so `localStorage` is still the only durable store today.

## 6. Build System

- **CONFIRMED — Vite:** `npm run dev` / `npm run build` (`tsc -b && vite build`) / `npm run preview`.
- **CONFIRMED — TypeScript compiler:** `tsc -b` (project references: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`) plus `npm run typecheck` (`tsc --noEmit`).
- **CONFIRMED — npm scripts:** `npm install`, `npm run dev`, `npm run build`, `npm test` (Vitest), `npm run test:e2e` (Playwright), `npm run check:environment`, all defined in the root `package.json`. See [build-system.md](UNDATED--FOUNDATION--build-system.md) for the full command list.
- **CONFIRMED — Backend build:** `pytest` (from `apps/api/`) and `uvicorn app.main:app --reload` for local API development; `alembic upgrade head` applies migrations.

## 7. Package / Dependency Management

- **CONFIRMED — npm workspaces:** root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`; each package's `package.json` sets `"exports": "./src/index.ts"` as a single string (subpath imports do not resolve — every package's `index.ts` re-exports everything consumers need).
- **CONFIRMED — Lockfile:** `package-lock.json` is committed at the repo root.
- **CONFIRMED — Explicit versions:** no `latest` ranges in the root `package.json` or `apps/api/requirements.txt`; every dependency is pinned to an exact version.
- **FORBIDDEN — Unreviewed convenience dependencies:** holds; the dependency lists in §3–4 above and `apps/api/requirements.txt` are the complete set.

## 8. Frontend Stack

- **CONFIRMED — React + TypeScript:** editor shell (`src/App.tsx`), viewport, scene tree (`src/editor/sceneTree.ts`), inspector, interaction/rule authoring UI, and runtime presentation (`src/RuntimeView.tsx`).
- **CONFIRMED — Three.js:** viewport rendering, camera, scene objects, raycasting, and gizmo-based transform tooling (`src/Viewport.tsx`, `src/viewport/`, `src/gizmo/`).
- **CONFIRMED — CSS:** `src/styles.css`, no UI framework.
- **CONFIRMED — Shared project representation:** editor and runtime both import `ProjectData` from `packages/project` and use `src/serializer.ts` for load/save; the interaction dispatcher (`packages/interaction`) is shared by both authoring-time preview and runtime playback paths.
- **CONFIRMED — Draft persistence adapter:** two-tier as originally specified — Tier 1 is `src/serializer.ts`'s primary-record-plus-backup `localStorage` writes (synchronous, authoritative for reads); Tier 2 is `packages/sync`'s `SyncClient` background queue (`src/sync/projectSync.ts`), currently pointed at a stub transport pending a real API write endpoint.
- **OPTIONAL — UI component library:** still not selected.

## 9. Backend Stack

- **PARTIAL — HTTP API:** routing for project creation/open/save, asset metadata, publishing, access checks, and analytics ingestion exists (`apps/api/app/routers/`), but every handler beyond `GET /health` raises HTTP 501 (`_skeleton.py`'s `not_implemented`). See [contracts.md](UNDATED--FOUNDATION--contracts.md) for the per-route table.
- **PARTIAL — Authentication/access boundary:** Auth0 JWT validation is real and implemented (`apps/api/app/auth.py`: JWKS fetch/cache, RS256 decode, audience/issuer checks, `get_current_token` FastAPI dependency) — this is not a skeleton. It is not yet wired as a `Depends(...)` into any router, so no route currently enforces authentication or organisation/project ownership. OIDC Authorization Code + PKCE browser login flow itself is not present in this repo (frontend-side login UI is not implemented).
- **CONFIRMED — API framework:** FastAPI with Pydantic v2 request/response models, one router module per resource.
- **CONFIRMED — API deployment model:** containerized (`apps/api/Dockerfile`), deployed behind Caddy in `docker-compose.prod.yml`; local Postgres/MinIO via root `docker-compose.yml`.

## 10. Database / Storage

- **PARTIAL — Durable project storage:** schema exists (`apps/api/app/models.py`: `Project`, `ProjectVersion`, `ContentSnapshot`) and migrates (`apps/api/alembic/versions/0001_init.py`), but no route persists to it yet.
- **PARTIAL — Asset storage:** `MediaAsset` model and boto3 presigned-URL helpers (`apps/api/app/storage.py`) exist; the `media.py` route that would call them and persist a row is unimplemented.
- **PARTIAL — Analytics storage:** `AnalyticsEvent` model exists with an index on `(project_id, occurred_at)`; the `analytics.py` route that would write to it is unimplemented.
- **CONFIRMED — Database technology:** PostgreSQL 16 (`docker-compose.yml`), covering organisations, actors, projects, project versions, media assets, interaction rules, and analytics events.
- **CONFIRMED — Database access:** SQLAlchemy 2.0.36 with Alembic 1.14.0 (`apps/api/alembic/`); `psycopg` 3.2.3 as the driver.
- **CONFIRMED — Object storage:** MinIO for local development (`docker-compose.yml`); boto3 client configured against it in `apps/api/app/storage.py`. Production S3/R2 target remains a deployment-time config choice (`deploy/README.md`), not verified against a specific provider in source.
- **UNDEFINED — Media limits and retention:** still unresolved; no size/retention policy found in source.
- **CONFIRMED, STILL TIER-1 — `localStorage`:** remains the only durable store the editor actually writes to today, pending Tier 2's real transport — see §5.

## 11. Networking / Communication

- **REQUIRED — HTTPS:** all deployed editor, API, asset, and published-runtime communication (enforced at the Caddy layer in production, per `deploy/Caddyfile`).
- **CONFIRMED — JSON over HTTP:** `ProjectData` and all router request/response models are JSON via Pydantic.
- **PARTIAL — Versioned project schema:** `ProjectData.schemaVersion` exists (currently always `1`); there is no explicit migration framework beyond additive-field backfill in the serializer (see [contracts.md](UNDATED--FOUNDATION--contracts.md)).
- **CONFIRMED — REST route shape:** resource-oriented HTTPS JSON, mounted at repo root (not `/api/v1/`) — see [contracts.md](UNDATED--FOUNDATION--contracts.md) for exact paths.
- **UNDEFINED — Real-time transport:** still no WebSocket/WebRTC in the repo; collaboration remains out of scope.
- **FORBIDDEN — Client trust of authorisation:** holds structurally (auth validation lives server-side in `auth.py`), though no route currently calls it, so this is enforced nowhere yet rather than violated somewhere.

## 12. Rendering / Engine / Graphics Stack

- **CONFIRMED — WebGL through Three.js 0.177.0:** browser 3D rendering for editor and visitor runtime.
- **CONFIRMED — Custom transform interaction:** screen-space hit testing and axis/plane constraints in `src/viewport/interactionMath.ts` and `src/gizmo/` (move/rotate/scale gizmos, view-snap, axis indicators), local/world transform composition in `packages/authoring-engine/src/transformMath.ts`.
- **CONFIRMED — Raycasting:** click selection in `src/Viewport.tsx`/`src/viewport/`.
- **CONFIRMED — Responsive camera/render sizing:** `src/viewport/cameraController.ts` and `ViewportOverlay.tsx`; explicit phone-width verification is not confirmed in source beyond this.
- **UNDEFINED — WebGL2/WebGPU policy:** unchanged; no WebGPU code found.
- **FORBIDDEN — VR/WebXR:** confirmed absent.

## 13. Cloud / Infrastructure

- **UNVERIFIED IN SOURCE — Hosting provider:** Google Cloud Run / Firebase Hosting / Cloud CDN / Cloud Storage are the originally proposed reference deployment; the deploy infrastructure actually present in this repo (`deploy/`, `docker-compose.prod.yml`, `Caddyfile`, `nginx.conf`, and the parent repo's `.github/workflows/deploy.yml`) is a self-hosted Docker Compose + Caddy setup, not a Cloud Run/Firebase pipeline. Treat the cloud-provider specifics in this section as an unresolved deployment-target decision rather than verified fact.
- **CONFIRMED — Static client hosting:** the frontend is built into a container (root `Dockerfile`) served behind Caddy/nginx.
- **CONFIRMED — API hosting:** `apps/api/Dockerfile`, served behind Caddy in `docker-compose.prod.yml`.
- **REQUIRED — Durable asset/project storage:** unchanged requirement; not yet satisfied end-to-end (see §10).
- **REQUIRED — Environment configuration:** `apps/api/app/config.py` reads settings via `pydantic-settings`; `.env.example` documents required variables.
- **UNVERIFIED IN SOURCE — CDN:** no CDN configuration found in this repo; nginx/Caddy serve directly.
- **CONFIRMED — Local infrastructure:** Docker Compose with PostgreSQL 16 and MinIO (`docker-compose.yml`).
- **CONFIRMED — Secrets:** `.env.example` at repo root documents required environment variables without committing real values; `config.py` loads them via `pydantic-settings`.

## 14. Testing Technologies

- **CONFIRMED — TypeScript build/type check:** `npm run typecheck` (`tsc --noEmit`) and `npm run build` (`tsc -b`).
- **CONFIRMED — Unit tests:** `packages/authoring-engine` (object ops, transform math), `packages/interaction` (dispatcher, zone tracker, action sequencer), `packages/assets` (resolvers, cache), `packages/sync` (queue, client), `packages/debugging` (logger). No dedicated `packages/project` test file exists yet.
- **PARTIAL — Persistence tests:** undo/redo timeline is tested (`authoring-engine/src/index.test.ts`); `src/serializer.test.ts` covers serialization/draft behavior; `src/sync/projectSync.test.ts` covers the sync adapter. Revision-conflict and published-snapshot-immutability tests are not present because publish is unimplemented server-side.
- **PRESENT, SCOPE UNVERIFIED — Browser integration tests:** `tests/e2e/` exists with Playwright wired to a real dev server; exact coverage (placement/selection/transform/save/load/preview) was not individually verified in this pass.
- **UNVERIFIED — Runtime parity tests:** no dedicated fixture-based preview-vs-published test was found; the runtime and editor do share the same `dispatch()` and viewport code paths structurally.
- **UNVERIFIED — Device/browser checks:** no automated phone-viewport or modest-hardware performance test found in source.
- **CONFIRMED — Test runner and browser automation:** Vitest 3.1.2, Playwright 1.55.0, pytest 9.1.1, httpx 0.28.1 — see §4.

## 15. Development Tools

- **REQUIRED — VS Code:** repository editing and team workflow.
- **REQUIRED — Git:** version control and review.
- **CONFIRMED — npm:** dependency and script management (npm workspaces).
- **REQUIRED — Browser developer tools:** WebGL, network, storage, and performance inspection.
- **REQUIRED — Jira and Scrum:** mandated project-management and grading evidence process (unverified from source, per original process requirement).
- **CONFIRMED — Docker:** used for local (`docker-compose.yml`) and production (`docker-compose.prod.yml`) infrastructure.

## 16. Platform Support

- **REQUIRED — Desktop browser authoring:** primary editor target.
- **REQUIRED — Mobile browser viewing:** published visitor target.
- **REQUIRED — Three-year-old school laptop scenario:** performance validation still not confirmed as automated (see §14).
- **UNDEFINED — Exact browser/version matrix:** unchanged.
- **FORBIDDEN — Native mobile application:** confirmed absent.

## 17. Version Constraints

- **CONFIRMED — Node.js:** >=22.0.0 required by `package.json` `engines` and enforced by `scripts/check-environment.mjs`.
- **CONFIRMED — TypeScript:** 5.8.3, single repository-wide version.
- **CONFIRMED — React/React DOM:** matching 19.1.0.
- **CONFIRMED — Vite and its React plugin:** Vite 6.3.5 with `@vitejs/plugin-react` 4.4.1.
- **CONFIRMED — Three.js and type declarations:** three 0.177.0 with `@types/three` 0.177.0.
- **CONFIRMED — Lockfile:** `package-lock.json` committed.
- **RESOLVED — the original BLOCKER no longer applies.** Node/npm are available in this environment; `npm install`, `npm run build`, and `npm test` run successfully (see [build-system.md](UNDATED--FOUNDATION--build-system.md)).

## 18. Dependency Constraints

- **CONFIRMED — Shared domain code must not depend on React UI:** verified — `packages/project`, `packages/authoring-engine`, `packages/assets`, `packages/interaction`, `packages/sync`, `packages/debugging` package.json files declare no React/Three.js/FastAPI dependency.
- **REQUIRED — Runtime must not import editor-only controls or editing commands:** `src/RuntimeView.tsx` uses the shared viewport and `packages/interaction`, not `packages/authoring-engine`'s command timeline — holds by inspection.
- **REQUIRED — Backend must not own browser rendering or gizmo mathematics:** holds; `apps/api/` contains no rendering code.
- **REQUIRED — Three.js is a rendering dependency, not the project persistence contract:** holds; `packages/project` has no Three.js dependency.
- **CONFIRMED — Every dependency must be license-compatible and recorded in the lockfile:** `package-lock.json` and `apps/api/requirements.txt` are the full pinned sets.
- **FORBIDDEN — Dependency on a full editor framework that replaces the custom technical component:** confirmed absent.

## 19. Integration Decisions

| Producer | Consumer | Protocol / API | Data format | Direction | Required dependency | Configuration requirement |
|---|---|---|---|---|---|---|
| Editor UI | Shared project model | In-process TypeScript API | `ProjectData` objects | Editor → `@vthere/project` | npm workspace package | Import boundary prevents UI ownership of persistence |
| Editor / runtime | Three.js renderer | In-process library API | Scene objects, transforms, vectors, rays | Client → renderer | three@0.177.0 | WebGL-capable browser |
| Editor client | Project API | HTTPS JSON API | Versioned project DTOs | Bidirectional (routes exist, handlers 501) | FastAPI app | API base URL and auth configuration — not yet wired |
| Runtime client | Published project service | HTTPS JSON API/static asset fetch | Published project JSON and asset references | Planned; not implemented | — | No `/published/{slug}` route exists yet |
| Runtime client | Analytics API | HTTPS JSON API | Versioned analytics events | Planned; route is a 501 skeleton | — | Event endpoint and privacy policy still undecided |
| Asset service | Editor/runtime | HTTPS asset fetch via presigned URL | Curated asset metadata and media | Storage helper implemented (`storage.py`); route unimplemented | boto3, MinIO | Asset URL and cache policy still undecided |

## 20. Explicitly Forbidden Technologies or Approaches

- **FORBIDDEN — Ready-made editor frameworks** that provide gizmos, scene serialization, or the interaction engine. Confirmed absent.
- **FORBIDDEN — Separate editor and runtime project schemas.** Confirmed absent — both consume `@vthere/project`.
- **FORBIDDEN — Browser-only `localStorage` as final persistence.** Still the only durable store in practice today (Tier 2 sync transport is a stub) — flag as a risk, not yet a violation, since the architecture has a real path off it.
- **FORBIDDEN — Client-side-only authorization or project isolation.** No route currently enforces authorization server-side either, since routers are unimplemented — this is a gap, not a violation of the "client trusts itself" rule specifically.
- **FORBIDDEN — WebSockets/WebRTC for MVP collaboration.** Confirmed absent.
- **FORBIDDEN — WebXR, native mobile, arbitrary model conversion, mesh editing, scripting, and billing infrastructure.** Confirmed absent.
- **FORBIDDEN — Unpinned `latest` dependencies at baseline release.** Confirmed — no `latest` ranges found.

## 21. Technology Risks

- **HIGH — Cloud deployment and identity configuration:** Auth0 JWT validation exists but is not wired into any route; this remains untested end-to-end before publication should be trusted.
- **HIGH — Undefined browser/device matrix:** unchanged.
- **MEDIUM (down from HIGH) — Three.js custom gizmo mathematics:** move/rotate/scale gizmos, view-snap, and axis indicators are implemented and tested (`src/gizmo/*.test.ts`, `src/viewport/interactionMath.test.ts`); camera-angle degeneracies and edge cases should still be reviewed but the core mechanism is no longer purely theoretical risk.
- **HIGH — Preview/published parity:** still a real risk — the runtime does share `dispatch()` and the viewport with the editor structurally, but there is no dedicated automated parity fixture confirmed (see §14).
- **MEDIUM — Unbounded media/assets:** unchanged; no size/retention policy implemented.
- **HIGH (up from MEDIUM) — Authentication and project isolation:** the routes that would need `Depends(get_current_token)` and per-project ownership checks are the same routes that are still HTTP 501 — this is now the single largest gap between "infrastructure exists" and "system is safe to expose."

## 22. Unresolved Technology Decisions

- **UNDEFINED — Exact CI provider and deployment pipeline implementation:** partially resolved — `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` exist at the monorepo root (outside this project folder); whether they build/deploy this specific project was not verified in this pass.
- **REQUIRED — Browser baseline:** unchanged from original (Chromium current-2 for authoring; Safari iOS 17+/Chromium Android current-2 for visitor viewing; WebGL2 target, no WebGPU requirement).
- **RESOLVED — Trigger/action vocabulary:** `packages/interaction` implements this as an open, extensible string vocabulary rather than a fixed closed set — see [contracts.md](UNDATED--FOUNDATION--contracts.md)'s Interaction contract section. The originally proposed six-trigger/six-action list is the default/intended vocabulary, not an enum enforced in code.
- **RESOLVED — Dependency lockfile generation:** `package-lock.json` is committed and `npm install` succeeds in this environment.

## 23. Build & Verification Command

### Frontend target

```text
Target:    frontend/editor and runtime client
Command:   npm install
Verified:  yes, re-run during this documentation pass — Node v24.19.0, npm workspace installs cleanly.

Target:    frontend/editor and runtime client
Command:   npm run build
Verified:  yes, re-run during this documentation pass — tsc -b && vite build succeeds. Vite emits a chunk-size
           warning (main bundle 867.20 kB / 237.87 kB gzipped, over the 500 kB default threshold) but the build
           completes with exit 0.

Target:    frontend/editor and runtime client
Command:   npm test
Verified:  yes, re-run during this documentation pass — Vitest: 29 test files, 210 tests, all passing, covering
           every packages/* subsystem plus src/**/*.test.ts.
```

### Backend target

```text
Target:    apps/api
Command:   python -m pytest apps/api/tests   (run from the REPO ROOT — see note)
Verified:  yes, re-run during this documentation pass — Python 3.12.10, 1 passed (test_health.py).
           Note: apps/api/tests/test_health.py imports `from apps.api.app.main import app`, an
           absolute import rooted at the repo root. Running plain `pytest` from inside apps/api/
           fails with ModuleNotFoundError: No module named 'apps'. Always invoke from the repo root.
```

See [build-system.md](UNDATED--FOUNDATION--build-system.md) for the complete command reference, including Docker Compose and Alembic steps.

## Usage

Minimal dependency map for a new package or module in this stack, grounded in what actually exists:

- A new shared TypeScript concern belongs in a new `packages/<name>/` workspace member with `"exports": "./src/index.ts"` and a `package.json` `dependencies` entry only on `@vthere/project` if it needs the canonical model (see `packages/interaction/package.json`, `packages/assets/package.json` for the pattern). It must not depend on React, Three.js, or FastAPI.
- A new editor-only UI concern belongs in `src/` (there is no populated `apps/editor/src/` beyond the transitional `EditorApplication.tsx`), importing shared packages via their workspace names (e.g. `import { dispatch } from '@vthere/interaction'`).
- A new API route belongs in `apps/api/app/routers/<name>.py`, registered in `apps/api/app/main.py`'s `app.include_router(...)` calls, following the existing skeleton pattern (Pydantic request/response models, `not_implemented()` placeholder body) until its business logic is built — see `apps/api/app/routers/_skeleton.py`.
- A new database table belongs in `apps/api/app/models.py` as a `Base` subclass, followed by `alembic revision --autogenerate` and a reviewed migration file under `apps/api/alembic/versions/`.

## Closing

```text
TECH STACK STATUS: IMPLEMENTED (frontend + infrastructure) / PARTIAL (backend business logic)

Frontend/shared packages:        built, tested, and running (npm install / build / test all re-verified during
                                  this documentation pass: build succeeds, 210/210 Vitest tests pass)
Backend infrastructure:          real (FastAPI routing, SQLAlchemy models + Alembic migration, Auth0 JWT
                                  validation, boto3 presigned URLs, Docker Compose local + prod deploy)
Backend business logic:          NOT implemented — every route handler except GET /health raises HTTP 501
Test suite size:                 210 Vitest tests across 29 files (TS/JS) + 1 pytest test (Python API)
Build command verified:          yes — npm install / npm run build / npm test all pass in this environment
                                  (210/210 Vitest tests), and python -m pytest apps/api/tests (run from the
                                  repo root) passes (1/1)
Unresolved decisions:            exact CI/deploy pipeline scope for this project, cloud provider vs. the
                                  self-hosted Docker/Caddy deploy actually present, media limits/retention,
                                  browser/device compatibility matrix
Recommended next step:           wire Auth0 dependency + authorization checks into the routers, then
                                  implement project/version/media/rules/analytics persistence against the
                                  existing SQLAlchemy models
```
