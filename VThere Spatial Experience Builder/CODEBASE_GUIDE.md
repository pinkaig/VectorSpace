# VThere Spatial Experience Builder - Codebase Guide

## 1. Analysis Boundary

- Project root: `VThere Spatial Experience Builder/`
- Analysis commit: `5a36a13355956f7339229af655d205ede6b4e1eb`
- Analysis date: 2026-09-09
- Scope: planning documents, workspace configuration, `src/`, `apps/`, `packages/`, API tests, and verification documentation
- Current phase: Stage 4, Phase 0 baseline in progress

This guide describes the VThere project only. The repository on disk is
authoritative; planning-only structures are labeled PLANNED or MISSING.

Written when this repository also held a sibling ChargedUp project and an
`Agent Skills/` directory. Both were removed for the M1 submission, so the
repository root now contains this project only.

## 2. Intended Architecture

The planning documents describe this direction:

```text
Editor React/Three.js
        |
Visitor runtime React/Three.js
        |
Framework-free shared TypeScript packages
        |
FastAPI API
        |
PostgreSQL + object storage + publishing/CDN
```

The intended system has one canonical, versioned project representation shared
by editor and runtime. The editor owns authoring UI and adapters; shared
packages own project data, spatial math, interaction, serialization, validation,
commands, and assets; the API owns persistence, authorization, publishing,
asset metadata, and analytics.

The plans also require preview/published parity, browser and API integration
tests, persistence tests, and device/performance verification. These are goals,
not all current capabilities.

Primary planning references live on the project wiki:
[Architecture v0.1](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Architecture-v0.1),
[Contracts](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Contracts),
[Repository Skeleton](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Repository-Skeleton),
and [Testbed Spec](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Testbed-Spec).

## 3. Implemented Source Inventory

### Root frontend prototype

`src/` is the real running application and currently owns the temporary editor
surface:

- `src/main.tsx` boots the application.
- `src/App.tsx` owns editor UI state, scene tabs, object tree, inspector,
  primitive asset catalog, local persistence, and undo/redo wiring.
- `src/Viewport.tsx` owns Three.js rendering, raycaster selection, floor-plane
  pointer dragging, and viewport interaction.
- `src/model.ts` adapts the root application to the project model.
- `src/serializer.ts` owns JSON serialization, local draft storage, backup
  recovery, autosave, and export.
- `src/styles.css` owns the prototype presentation.

For viewport work, start with the [Viewport](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport) wiki page.
Its “Where to Find Things” table maps rendering ownership to the current files.
The most important local rendering modules are:

- `src/viewport/syncArtefacts.ts` for artefact reconstruction and disposal;
- `src/viewport/syncGizmo.ts` for gizmo presentation synchronisation;
- `src/viewport/createGizmoSet.ts` for gizmo handle assembly and disposal;
- `src/viewport/interactionMath.ts` for framework-free ray/axis and angle math;
- `src/viewport/cameraController.ts` for camera poses and walk movement;
- `src/viewport/interactionController.ts` for pointer, drag, gizmo, and keyboard listeners;
- `src/viewport/environmentController.ts` for environment loading lifecycle;
- `src/viewport/ViewportOverlay.tsx` for loading/error/hint presentation;
- `src/editor/editorOperations.ts` for editor-specific authoring policy and browser ID generation. It is intentionally a thin boundary today; do not add domain rules there.
- `src/environments.ts` for environment asset construction and loading.

`src/Viewport.tsx` still owns the Three.js runtime lifecycle and pointer state
machines. Those are planned extraction targets, not duplicate implementations.

Implemented user-facing behavior includes primitive cube, sphere, and cylinder
placement; scene and object selection; transform editing; local save/load;
backup recovery; autosave; JSON export; and snapshot undo/redo.

### `packages/project`

Exports the current prototype model: `ProjectData`, `SceneData`, `SceneObject`,
`TransformData`, `AssetKind`, `defaultProject`, `cloneProject`, and `makeObject`.
It supports project identity, scenes, primitive objects, and transforms. It does
not yet model components, zones, interactions, navigation, media, environments,
or migrations.

### `packages/authoring-engine`

Implements and tests a generic snapshot command timeline with commit, undo, redo,
redo-branch invalidation, history limits, and defensive cloning. The documented
gizmo mathematics, hit testing, constraints, transform sessions, compound
commands, and persistence checkpoints are not implemented here yet.

### `packages/debugging`

Implements and tests debug, info, warning, and error levels; injectable sinks;
child loggers; context logging; sensitive-key redaction; an in-memory test sink;
and browser-configurable log levels.

### `apps/api`

`apps/api/app/main.py` contains a FastAPI application with request logging,
`x-request-id` correlation, and `GET /health`. `apps/api/tests/test_health.py`
covers the health route.

Project CRUD, authentication, authorization, persistence, publishing, asset
URLs, analytics ingestion, database models, and migrations are absent.

### `apps/runtime`

Contains only a README. The visitor runtime boundary is documented but not
implemented.

## 4. Missing Planned Boundaries

The following planned structures are not present in the current source tree:

- `apps/editor/`
- `packages/spatial/`
- `packages/interaction/`
- `packages/serialization/`
- `packages/commands/`
- `packages/validation/`
- `packages/assets/`
- `infrastructure/`
- root `tests/`

The root `src/` editor is therefore a documented migration point, not evidence
that the planned editor application boundary already exists.

## 5. Actual Dependency Order

The current import flow is approximately:

```text
index.html
  -> src/main.tsx
      -> src/App.tsx
          -> src/model.ts
              -> packages/project/src/index.ts
          -> src/serializer.ts
              -> src/model.ts
              -> packages/debugging/src/index.ts
          -> src/Viewport.tsx
              -> src/model.ts
              -> three
```

Independent test paths are:

```text
packages/authoring-engine/src/index.test.ts
  -> packages/authoring-engine/src/index.ts
  -> vitest

packages/debugging/src/index.test.ts
  -> packages/debugging/src/index.ts
  -> vitest

apps/api/tests/test_health.py
  -> apps/api/app/main.py
  -> FastAPI/Starlette
```

Recommended reading order for a new engineer:

1. `package.json`, `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts` - workspace and verification boundaries.
2. `packages/project/` - current canonical project data.
3. `packages/debugging/` - logging and redaction behavior.
4. `packages/authoring-engine/` - current history abstraction and tests.
5. `src/model.ts` and `src/serializer.ts` - root application adapters and persistence.
6. `src/Viewport.tsx` - rendering, picking, and direct manipulation.
7. `src/App.tsx` - editor orchestration and UI state.
8. `apps/api/` - independent HTTP service boundary and health verification.
9. `apps/runtime/` - planned visitor boundary, currently placeholder-only.
10. The project wiki - intended future boundaries and acceptance criteria.

The planned dependency direction is shared data and math first, then
serialization and validation, then commands and authoring, then editor/runtime
consumers, followed by API persistence, publishing, analytics, and performance
verification. That planned graph is not yet the implemented graph.

## 6. Plan Versus Reality

| Area | Status | Finding |
| --- | --- | --- |
| Root React/Vite/Three.js editor | IMPLEMENTED | Running prototype exists under `src/`. |
| Canonical project package | IMPLEMENTED | `packages/project` exports the current model. |
| Full versioned project schema | MISSING | Components, zones, interactions, navigation, media, and environments are absent. |
| Local serialization | IMPLEMENTED | JSON draft, backup, recovery, autosave, and export exist. |
| Schema migrations | MISSING | No migration system exists beyond a version check. |
| Generic command timeline | IMPLEMENTED | Snapshot history exists and is tested. |
| Full authoring engine | DRIFTED | Planned gizmo and manipulation ownership is not implemented in the package. |
| Gizmo mathematics | DRIFTED | Basic dragging is in `src/Viewport.tsx`; custom gizmos are absent. |
| Editor application boundary | DRIFTED | Planned `apps/editor/` is absent; editor remains in root `src/`. |
| Visitor runtime | PLANNED / MISSING | `apps/runtime/` contains only a README. |
| WHEN/DO interaction engine | MISSING | No interaction package, builder, triggers, actions, or dispatcher exists. |
| Asset browser | DRIFTED | Prototype uses a hard-coded primitive catalog; curated GLB storage is absent. |
| API health endpoint | IMPLEMENTED | `/health` and its test exist. |
| API project services | MISSING | CRUD, auth, persistence, publishing, assets, and analytics are absent. |
| Debugging logger | IMPLEMENTED | Logger and redaction behavior exist and are tested. |
| Analytics | PLANNED | Concepts are documented, but instrumentation and ingestion are absent. |
| Infrastructure | MISSING | Database, storage, deployment, and infrastructure code are absent here. |
| Browser and integration suites | MISSING | Only focused package tests and API health coverage exist. |

## 7. Systems-Programming Translation

- `ProjectData` is closest to a serialized world or document.
- `SceneData` is a scene or level partition.
- `SceneObject` resembles an entity record, but is not a true ECS entity because
  its data is stored directly rather than composed from independent components.
- `TransformData` is currently an inline transform component.
- `App.tsx` is the editor controller and UI state owner.
- `Viewport.tsx` combines renderer setup, scene reconstruction, ray picking,
  pointer input, and movement mutation. An ECS design would normally separate
  rendering, input, selection, and transform systems.
- `serializer.ts` is the persistence adapter and file-format boundary.
- `authoring-engine` currently resembles a generic history buffer. It is planned
  to become the command/manipulation system.
- `apps/api` is a service boundary, not an ECS system. It should own persistence
  and authority rather than rendering or gizmo mathematics.
- No ECS registry, component store, system scheduler, or runtime world exists.

The practical implication is that the current prototype favors direct object
mutation and UI orchestration. That is simpler for the baseline, but it is not
yet a cache-oriented, batched runtime architecture.

## 8. Task-to-Files Ownership

| Task | Primary files | Dependencies | Boundary | Status |
| --- | --- | --- | --- | --- |
| Authoring UI and scene tree | `src/App.tsx` | `packages/project/`, styles | Planned `apps/editor/` boundary | DRIFTED |
| Viewport rendering and selection | `src/Viewport.tsx` | `src/model.ts`, Three.js | Shared packages should not own React or renderer UI | DRIFTED |
| Gizmos and transforms | `src/Viewport.tsx` basic drag | `packages/project/`, authoring engine | Future spatial/authoring packages | MISSING / DRIFTED |
| WHEN/DO builder and dispatch | None | Project model and planned contracts | Future `packages/interaction/` | MISSING |
| Project model | `packages/project/src/index.ts` | None | Keep framework-free | IMPLEMENTED, INCOMPLETE |
| Serialization and migrations | `src/serializer.ts` | `src/model.ts`, debugging | Future `packages/serialization/` | DRIFTED |
| Undo/redo | `packages/authoring-engine/`, `src/App.tsx` | Project model | Future command boundary | DRIFTED |
| Asset catalog | `assetCatalog` in `src/App.tsx` | Project model | Future assets package and storage | DRIFTED |
| Visitor runtime | None; `apps/runtime/README.md` | Project contracts | Runtime must consume canonical data | MISSING |
| API/backend | `apps/api/app/main.py` | FastAPI | API must not own editor UI or renderer logic | HEALTH ONLY |
| Debugging | `packages/debugging/src/index.ts`, API middleware | None | Redaction at logging boundary | IMPLEMENTED, LIMITED |
| Analytics | None | Planned runtime and API contracts | Consent, retention, and access decisions required | MISSING |

## 9. Build, Test, and Verification

Fresh checks for this guide were run from `VThere Spatial Experience Builder/`:

- `npm run build` passed. Vite emitted the existing warning that the production
  JavaScript chunk is larger than 500 kB.
- `npm test` passed: 2 test files and 2 tests passed in Vitest.
- `python -m pytest apps/api/tests` could not run because `pytest` is not
  installed in the selected Python 3.12 environment.

Useful project commands are:

```text
npm run check:environment
npm run build
npm test
python -m pytest apps/api/tests
python -m uvicorn apps.api.app.main:app --reload --port 8000
```

The Vitest configuration currently includes `packages/**/*.test.ts`, so
`npm test` does not execute the Python API test. Browser tests, full backend
integration tests, runtime parity tests, persistence tests, authorization,
analytics, and performance verification remain outstanding.

## 10. AI Use and Verification

- AI tool: GitHub Copilot.
- AI-assisted activities: architecture prompt design, repository structure
  analysis, and drafting this architecture guide.
- Analysis commit: `5a36a13355956f7339229af655d205ede6b4e1eb`.
- Human review: the project owner requested this VThere-specific continuation;
  additional human approval of the architecture guide remains pending.
- Fresh verification: frontend build passed; configured Vitest passed; API
  pytest was not available in the selected Python environment.
- Personal data or unpublished third-party work in prompts: Pending human
  confirmation.
- Asset licensing, attribution, publication rights, consent, and production
  data use: Pending human confirmation.

No human approval, user study, licensing decision, consent process, or production
data use should be inferred from this guide. Update this section when the owner
confirms those facts.
