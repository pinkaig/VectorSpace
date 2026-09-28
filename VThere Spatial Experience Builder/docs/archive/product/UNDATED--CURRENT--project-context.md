# VThere Spatial Experience Builder â€” Project Context

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

## Identity

VThere is a browser-based no-code spatial exhibition authoring tool. Authors build scenes from approved assets, define WHEN -> DO interactions, preview them, and publish a visitor URL.

## Current phase

All 8 baseline stages are complete (see [8-stage baseline overview](../../code/baseline-phases.md)). The canonical project package, authoring-engine history seam, API HTTP surface (real auth/storage, skeleton business logic), and three shared packages — `packages/assets`, `packages/interaction`, `packages/sync` — are implemented and wired into the editor/runtime. Concretely, an author can today: place assets in the viewport via `packages/assets`-backed resolution, define WHEN -> DO interaction rules that dispatch through `packages/interaction` and fire live in the viewport, and have edits staged for sync through `packages/sync`'s queue/retry machinery in `src/sync/projectSync.ts`.

What is *not* yet implemented: the API's project/rules/media/publish/analytics route handlers are real, auth-checked routes that all currently return `501 Not Implemented` (see `apps/api/app/routers/_skeleton.py`) — there is no durable server-side persistence yet. Client-side sync therefore runs against a stub transport rather than a live backend. `apps/editor/` and `apps/runtime/` exist as application boundaries but are thin shells; the substantial editor/runtime logic still lives in the root `src/` prototype.

## Architecture

- **Editor:** React UI and Three.js viewport for authoring (`src/App.tsx`, `src/Viewport.tsx`, `src/viewport/*`, plus the `apps/editor/` boundary shell).
- **Shared core:** TypeScript project model (`packages/project`), the standalone custom `authoring-engine` (command/undo-redo history), `packages/assets` (asset refs/descriptors/resolvers/cache), `packages/interaction` (WHEN -> DO dispatch, action executors, zone tracking), and `packages/sync` (sync queue, client, conflict detection). Components, zones, navigation, and schema migrations are still not modeled.
- **Runtime:** `apps/runtime/` application boundary consuming the same project document and interaction engine as the editor; currently a thin shell, with the WHEN -> DO dispatch itself already exercised from viewport code in `src/`.
- **API:** FastAPI service (`apps/api/`) with real Auth0/JWT auth, boto3 object storage, and SQLAlchemy models/migrations for projects, versions, media, rules, and analytics. Routers exist for all of these, but handler bodies are still `501` skeletons — no persistence business logic runs yet.
- **Persistence:** PostgreSQL for structured metadata; S3-compatible object storage for large assets/media; CDN for published delivery. Data model and migrations exist; the routes that would read/write through them are not yet implemented.

## Stack

TypeScript, React 19, Vite 6, Three.js 0.177, Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 16, MinIO locally, Google Cloud Storage/Cloud CDN in the reference deployment, Auth0 OIDC, Vitest, Playwright, pytest, HTTPX, Docker Compose.

## Key constraints

The runtime has no editing capability. Editor and runtime consume one versioned project representation. Gizmos, serialization, interaction dispatch, and undo/redo remain custom project-owned work. Persistence is release-blocking: autosave status must be truthful, corrupt drafts must recover through a tested fallback chain, and published versions are immutable. Arbitrary model conversion, scripting, collaboration, WebXR, native apps, billing, and LMS/SCORM are outside MVP.

## Baseline status

All 8 baseline stages complete (verified against `docs/code/baseline-phases.md` and commits `0ad9c20`..`8831960`): local dev environment, data model + migrations, backend HTTP surface, `packages/assets`, `packages/interaction`, `packages/sync`, production deploy scaffolding, and all three packages wired into the editor/runtime. Node.js/npm and Python are installed; the frontend build, Vitest suite, one Playwright smoke spec, and the API health test pass.

Still required for the next slice: real persistence behind the API's route handlers (currently `501` skeletons), a CI pipeline (no `.github/workflows/` yet), broader browser/integration test coverage, and migrating the bulk of editor/runtime logic out of root `src/` into the `apps/editor/`/`apps/runtime/` boundaries, which are currently thin shells.

## Entry points

- Client: `npm install`, `npm run dev`, `npm run build`
- API after baseline scaffold: `python -m pytest`, `uvicorn app.main:app --reload`
- Local services after infrastructure scaffold: `docker compose up -d postgres minio`

## Architecture drift rules

Agents may implement existing interfaces, add tests, add files inside extensible directories, and fix defects. Agents may not silently rename canonical systems, move fixed boundaries, change technologies, replace frameworks, change protocols, change public contracts, add major dependencies, create top-level systems, or change subsystem responsibilities. Architectural conflicts must stop for a decision.

See `../../code/architecture/UNDATED--FOUNDATION--architecture.md`, `../../code/architecture/UNDATED--FOUNDATION--repository.md`, `../../code/architecture/UNDATED--FOUNDATION--contracts.md`, `../../code/architecture/UNDATED--FOUNDATION--build-system.md`, `../delivery/UNDATED--FOUNDATION--testing-strategy.md`, `../delivery/UNDATED--FOUNDATION--implementation-plan.md`, `../../code/subsystems/authoring-engine.md`, `../../code/subsystems/UNDATED--CURRENT--asset-library-contract.md`, `../delivery/UNDATED--GOVERNANCE--roles-and-delivery.md`, `../research-and-history/UNDATED--GOVERNANCE--pilot-and-conduct.md`, `2026-09-06--HISTORY--source-brief-audit.md`, and `../delivery/UNDATED--CURRENT--pre-baseline-validation.md`.
