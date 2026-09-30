# VThere Development Guide

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

This is the practical map for navigating the VThere Spatial Experience Builder and starting business-logic work without breaking persistence, editing history, or editor/runtime parity.

## Current reality

All 8 baseline stages are complete (see [8-stage baseline overview](../FOUNDATION--baseline-phases.md)).
The editor still runs from the root `src/` surface rather than `apps/editor/`, but every
planned shared package and the backend HTTP/persistence surface now exist and are wired
into the running app.

Implemented and currently usable:

- The root Vite/React editor in [`src/`](../../../src/), rendering through [`src/Viewport.tsx`](../../../src/Viewport.tsx).
- The canonical project model in [`packages/project/src/index.ts`](../../../packages/project/src/index.ts).
- Local serialization, autosave, backup recovery, JSON export, and Sync-engine dual-write in [`src/serializer.ts`](../../../src/serializer.ts).
- The command timeline in [`packages/authoring-engine/src/index.ts`](../../../packages/authoring-engine/src/index.ts), wired into `src/editor/`.
- The Asset Manager (`packages/assets`) resolving `SceneObject.assetId` through the viewport (Stage 4a/6).
- The WHEN->DO interaction engine (`packages/interaction`) dispatching gizmo/pointer events into `ProjectData.rules` (Stage 4b/7).
- The Sync engine (`packages/sync`) queuing and retrying project writes against the API (Stage 4c/8).
- The FastAPI backend in [`apps/api/app/`](../../../apps/api/app/): Auth0/JWT auth (`auth.py`), boto3-backed object storage (`storage.py`), SQLAlchemy models and Alembic migrations, and routers for projects, media, publish, analytics, and rules.
- Local Postgres + MinIO via [`docker-compose.yml`](../../../docker-compose.yml), and a production Caddy/API/Postgres stack via [`docker-compose.prod.yml`](../../../docker-compose.prod.yml) (see [`deploy/README.md`](../../../deploy/README.md)).
- Frontend unit tests (Vitest, ~30 test files across `packages/*` and `src/`) and a Playwright smoke test covering the editor-to-simulation flow.

Still planned or incomplete:

- The editor has not moved into the documented [`apps/editor/`](../../../apps/editor/) boundary; `apps/editor/src/EditorApplication.tsx` and `apps/runtime/src/RuntimeApplication.tsx` are placeholder entry points only.
- Python API tests (`apps/api/tests/`) are not wired into CI (`.github/workflows/ci.yml` only runs the npm/Playwright pipeline).
- Production deploy (`deploy.yml`) is `workflow_dispatch`-only scaffolding; no deployment provider/VM owner is confirmed yet (see `SESSION.md`).
- Broader browser end-to-end coverage (placement, undo/redo, save/load, import/export), runtime parity tests, and full integration tests remain incomplete.

Treat the architecture documents as the target contract and the actual source tree as the current implementation state; the biggest remaining drift is the editor/runtime app-boundary split, not missing business logic.

## Start the project

From the VThere directory:

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd install
npm.cmd run dev
```

Before starting, run the environment check if you are setting up a new machine:

```powershell
.\scripts\check-environment.ps1
```

The check reports missing Node.js, npm, or dependencies and exits with a non-zero code so setup problems are visible in scripts and CI. On macOS/Linux use `bash scripts/check-environment.sh`. Once Node.js is available, `npm.cmd run dev` automatically runs the Node-based preflight check before Vite starts.

Open the Vite URL, normally `http://localhost:5173`.

Run the API separately when working on API code. First bring up local Postgres and MinIO,
then run the API from `apps/api/`:

```powershell
cd "VThere Spatial Experience Builder"
docker compose up -d
cd apps/api
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

The API health check is `http://localhost:8000/health`. See
[docker-local-dev-environment.md](LEARNING--docker-local-dev-environment.md) for the
`docker-compose.yml` services and [environment-setup.md](CURRENT--environment-setup.md)
for `.env` setup. Run `python -m pytest apps/api/tests` (from
`VThere Spatial Experience Builder/`, using the `apps.api.app.main` import path baked into the
tests) to check the API in isolation.

PowerShell may block `npm.ps1`; use `npm.cmd` as shown above.

## Where to edit

| Goal | Start here | Then inspect |
|---|---|---|
| Add or change project data | [`packages/project/src/index.ts`](../../../packages/project/src/index.ts) | [`src/model.ts`](../../../src/model.ts), [`src/serializer.ts`](../../../src/serializer.ts) |
| Add an editor action | [`src/App.tsx`](../../../src/App.tsx) | [`packages/authoring-engine/src/index.ts`](../../../packages/authoring-engine/src/index.ts) |
| Change viewport behavior | [`src/Viewport.tsx`](../../../src/Viewport.tsx) | [`architecture`](../architecture/FOUNDATION--architecture.md), [`viewport subsystem`](../subsystems/CURRENT--viewport.md) |
| Change save, recovery, or export | [`src/serializer.ts`](../../../src/serializer.ts) | [`contracts`](../architecture/FOUNDATION--contracts.md), [`sync engine`](../subsystems/CURRENT--sync-engine.md) |
| Add undo/redo behavior | [`packages/authoring-engine/src/index.ts`](../../../packages/authoring-engine/src/index.ts) | [`packages/authoring-engine/src/index.test.ts`](../../../packages/authoring-engine/src/index.test.ts) |
| Add or change WHEN->DO rules | [`packages/interaction/src/dispatcher.ts`](../../../packages/interaction/src/dispatcher.ts) | [`when-do dispatch engine`](../subsystems/CURRENT--when-do-dispatch-engine.md) |
| Add or change asset resolution | [`packages/assets/src/index.ts`](../../../packages/assets/src/index.ts) | [`asset manager`](../subsystems/CURRENT--asset-manager.md) |
| Add API behavior | [`apps/api/app/main.py`](../../../apps/api/app/main.py) | [`apps/api/tests/test_health.py`](../../../apps/api/tests/test_health.py), [`contracts`](../architecture/FOUNDATION--contracts.md) |
| Change visual layout | [`src/styles.css`](../../../src/styles.css) | [`src/App.tsx`](../../../src/App.tsx) |
| Add diagnostic logging | [`packages/debugging/src/index.ts`](../../../packages/debugging/src/index.ts) | [`debugging`](CURRENT--debugging.md) |
| Understand intended ownership | [`architecture`](../architecture/FOUNDATION--architecture.md) | [`repository boundaries`](../architecture/FOUNDATION--repository.md) |
| Check phase order | [`FOUNDATION--baseline-phases`](../FOUNDATION--baseline-phases.md) | [`pre-baseline validation`](../../archive/delivery/CURRENT--pre-baseline-validation.md) |

## Business-logic implementation order

Implement domain behavior in this order. Keep React and Three.js at the edges.

### 1. Define the canonical data

Add types and defaults in [`packages/project/src/index.ts`](../../../packages/project/src/index.ts). Preserve stable IDs, ordering, transforms, scene relationships, and `schemaVersion`.

Do not create a second project model in the editor, runtime, or API. UI state such as selection, open panels, and camera position is not project data.

### 2. Add pure logic and tests

Create a focused package under `packages/` for the behavior. Prefer pure functions and framework-free TypeScript. Add a neighboring `.test.ts` file before connecting the logic to React.

Examples:

- Validation: reject missing scene references and invalid transforms.
- Spatial: calculate ray, plane, axis, and transform constraints.
- Interaction: match a trigger to ordered actions deterministically.
- Serialization: validate, serialize, deserialize, and migrate project documents.

The package must not import React, Three.js UI adapters, FastAPI, browser storage, or database code unless the architecture explicitly assigns that dependency.

### 3. Route changes through commands

Every user-visible edit must be one command or compound command. A drag operation must create one history entry when the drag is committed, not one entry per pointer event.

The command should:

1. Receive a project snapshot or immutable project input.
2. Return the next project state.
3. Preserve IDs and unrelated data.
4. Have an inverse or an equivalent previous snapshot for undo.
5. Clear the redo branch after a new edit.

Editor snapshot history in [`src/App.tsx`](../../../src/App.tsx) and [`src/editor/`](../../../src/editor/) is wired to [`packages/authoring-engine/`](../../../packages/authoring-engine/), as specified in [`authoring-engine.md`](../subsystems/FOUNDATION--authoring-engine.md).

### 4. Connect persistence through one adapter

Autosave and explicit save must use the same persistence path. Keep these states truthful:

- `saving`: a write is in progress.
- `saved`: the primary write completed.
- `recovered`: a fallback source was loaded.
- `failed`: no reliable primary or backup write completed.

Recovery order is current draft, backup, server revision, then a clean project. Export JSON remains the emergency fallback. Never silently overwrite a newer server revision.

The local implementation is in [`src/serializer.ts`](../../../src/serializer.ts), now dual-writing through the Sync engine (`packages/sync`, see [`sync-engine.md`](../subsystems/CURRENT--sync-engine.md)) to `apps/api` when the API is reachable. Preserve this contract rather than letting API calls spread through UI components.

### 5. Connect the UI last

The UI should collect input, call a command or domain service, render the result, and display persistence status. It should not directly mutate arbitrary project objects or contain validation rules that the runtime cannot share.

For the editor, the intended flow is:

```text
pointer/form input -> authoring engine or command -> project state
project state -> serializer/persistence adapter -> draft or server revision
project state -> viewport renderer
```

## Editing safety checklist

Before changing a shared model or public contract:

- Read [`project context`](../../archive/product/CURRENT--project-context.md).
- Check the ownership table in [`architecture`](../architecture/FOUNDATION--architecture.md).
- Search for all references to the type or function being changed.
- Add or update a focused test first when the behavior is persistence, history, serialization, validation, or interaction related.
- Run the build and the narrowest relevant test.
- Update the contract or implementation plan if the change alters a boundary.

Do not silently move fixed directories, add a new top-level subsystem, change the project schema without a migration decision, or make the runtime depend on editor-only state.

## Verification commands

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
python -m pytest apps/api/tests
```

Frontend tests cover the authoring-engine timeline, asset resolution/caching, WHEN->DO
dispatch, sync queueing/retry, and serialization/environment behavior. `python -m pytest`
is not wired into CI yet (see the [CI/CD guide](CURRENT--CI-CD-build-and-test-guide.md)) — run
it manually from `VThere Spatial Experience Builder/` when changing `apps/api`.

## Architecture readiness

Current answer: **baseline complete, app-boundary migration still pending**.

- All 8 baseline stages are implemented (data model, HTTP surface, asset manager, WHEN->DO
  engine, sync engine, production deploy scaffolding, and their frontend/runtime wiring).
- The project builds and the full test suite passes locally.
- The editor still runs from the temporary root `src/` surface rather than `apps/editor/`;
  `apps/runtime/` is likewise a placeholder entry point rather than a populated app.
- CI does not yet run the Python API tests, and production deploy is manual-trigger-only
  pending an approved hosting owner (see `SESSION.md`).

The next structurally important work is moving the editor into `apps/editor/` and the
runtime into `apps/runtime/` without duplicating the domain model, then closing the CI gaps
called out in the [CI/CD guide](CURRENT--CI-CD-build-and-test-guide.md).

## Reference documents

- [Project context and drift rules](../../archive/product/CURRENT--project-context.md)
- [Architecture ownership and interfaces](../architecture/FOUNDATION--architecture.md)
- [Repository boundaries](../architecture/FOUNDATION--repository.md)
- [Data and API contracts](../architecture/FOUNDATION--contracts.md)
- [Build and test commands](../architecture/FOUNDATION--build-system.md)
- [Baseline stage overview](../FOUNDATION--baseline-phases.md)
- [Testing strategy](../../archive/delivery/FOUNDATION--testing-strategy.md)
- [CI/CD, build, and test guide](CURRENT--CI-CD-build-and-test-guide.md)
- [Debugging and logging](CURRENT--debugging.md)
- [Engineering practices](FOUNDATION--engineering-practices.md)
- [Pre-baseline validation](../../archive/delivery/CURRENT--pre-baseline-validation.md)
- [Authoring-engine design](../subsystems/FOUNDATION--authoring-engine.md)
- [Session handoff](../../../SESSION.md)