# Repository Skeleton

**Baseline phase:** Not stage-specific — describes the system the 8 stages implement. See [8-stage baseline overview](../baseline-phases.md).

## Classification

This reflects the actual tree on disk today, not only the planned target:

```text
VThere Spatial Experience Builder/
├── apps/                         EXTENSIBLE
│   ├── editor/                   Transitional boundary — EditorApplication.tsx re-exports src/App.tsx
│   ├── runtime/                  Transitional boundary — RuntimeApplication.tsx re-exports src/RuntimeView.tsx
│   └── api/                      FastAPI app: app/main.py, routers/, models.py, auth.py, storage.py, alembic/, tests/
├── packages/                     FIXED boundary, EXTENSIBLE contents
│   ├── project/                  IMPLEMENTED canonical domain (ProjectData/SceneData/SceneObject/InteractionRule/ZoneDefinition)
│   ├── authoring-engine/         IMPLEMENTED standalone custom authoring component (object ops, transform math, command timeline)
│   ├── assets/                   IMPLEMENTED asset reference/resolver/cache contract
│   ├── interaction/              IMPLEMENTED WHEN->DO dispatch, zone tracking, action registry/sequencer
│   ├── sync/                     IMPLEMENTED offline dual-write queue/client
│   └── debugging/                IMPLEMENTED structured logging with redaction
├── src/                          The running editor/runtime prototype (see below); apps/editor and apps/runtime currently point back into it
├── deploy/                       Production Docker/Caddy/nginx deploy config (Caddyfile, nginx.conf, README.md)
├── docker-compose.yml             Local Postgres + MinIO
├── docker-compose.prod.yml        Production Caddy + frontend + api
├── Dockerfile                    Root: builds the frontend container (serves src/, via apps/editor+runtime)
├── tests/                        e2e/ (Playwright) — cross-system suites
├── docs/                         Planning/design documents, reorganised into docs/code/ and docs/archive/
├── package.json                  npm workspace root (workspaces: apps/*, packages/*)
└── package-lock.json              Committed
```

`packages/spatial/`, `packages/serialization/`, `packages/commands/`, and `packages/validation/` are **not present** on disk — those planned boundaries were not split out as separate packages. Their responsibilities currently live inside `src/viewport/`, `src/gizmo/`, `src/serializer.ts`, and `packages/authoring-engine`. There is no top-level `infrastructure/` directory; its planned contents (database, storage, deployment, docker) live in `apps/api/alembic/`, `apps/api/app/storage.py`, and `deploy/` respectively.

`src/` is the real running application, not a prototype scheduled for wholesale deletion: `apps/editor/src/EditorApplication.tsx` and `apps/runtime/src/RuntimeApplication.tsx` are documented transitional boundaries that re-export `src/App.tsx` and `src/RuntimeView.tsx` respectively, so the `apps/*` import boundary exists today even though the implementation still lives at the repository root. Do not create a parallel domain model under `apps/editor/` or `apps/runtime/` — extend `src/` and the shared `packages/*` until a real migration of the implementation itself is planned. `packages/authoring-engine/` remains independently testable without React, Three.js rendering, API access, or browser storage (its `*.test.ts` files import only `@vthere/project` and Vitest).

### `src/` structure

```text
src/
├── main.tsx                 Boots the app
├── App.tsx                   Editor UI shell: scene tabs, object tree, inspector, asset catalog, undo/redo wiring
├── Viewport.tsx               Three.js viewport: rendering, raycaster selection, pointer/gizmo wiring
├── RuntimeView.tsx            Visitor runtime view (wrapped by apps/runtime)
├── ReferenceViewport.tsx      Reference/comparison viewport component
├── model.ts                   Adapts the app to packages/project's ProjectData
├── serializer.ts              JSON serialization, localStorage draft/backup, autosave, export (Tier 1 persistence)
├── assets.ts                  Root-level asset catalog wiring
├── environments.ts            Environment (procedural/GLB) construction and loading
├── styles.css                 Prototype presentation
├── editor/                    editorOperations.ts (authoring policy, ID generation), sceneTree.ts (hierarchy helpers)
├── viewport/                  syncArtefacts.ts, syncGizmo.ts, createGizmoSet.ts, interactionMath.ts, cameraController.ts,
│                               interactionController.ts, environmentController.ts, ViewportOverlay.tsx, assetResolution.ts
├── gizmo/                     moveGizmo.ts, rotateGizmo.ts, scaleGizmo.ts, axisIndicator.ts, octaOrb.ts, viewSnap.ts, math.ts
└── sync/                      projectSync.ts — Tier 2 background sync wiring (@vthere/sync adapter for the editor)
```

## Naming and placement

- TypeScript classes/types use PascalCase; files match the canonical type where practical.
- React components use PascalCase `.tsx` filenames.
- Tests live beside the unit they cover — every `packages/*` subsystem and most `src/` modules have a sibling `*.test.ts` (e.g. `packages/interaction/src/dispatcher.test.ts`, `src/viewport/interactionMath.test.ts`); cross-system tests live under root `tests/e2e/` (Playwright).
- Python API modules use snake_case and live only under `apps/api/`.
- Database migrations are generated Alembic artifacts under `apps/api/alembic/versions/` (e.g. `0001_init.py`).
- Build output (`dist/`), `node_modules`, virtual environments, secrets, and local media are GENERATED/ignored.

## Architectural component rule

A new top-level directory, protocol, external service, or canonical subsystem is an architectural change. Stop, document the conflict, and obtain a decision. A new private implementation file inside an existing boundary is not an architectural component.

**Proposed, not built.** [`attachment-integration.md`](../subsystems/attachment-integration.md) treats `packages/audio`, `packages/image`, `packages/text`, and `packages/video` as new canonical subsystems and applies this rule to them: each is a decision to make before any code lands, not an implementation detail. None of those four packages exist on disk today; they are awaiting that architecture decision, and the `packages/` tree in Classification above lists only what is actually implemented.
