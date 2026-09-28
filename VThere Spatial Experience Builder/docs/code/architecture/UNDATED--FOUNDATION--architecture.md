# Architecture Skeleton

**Baseline phase:** Not stage-specific — describes the system the 8 stages implement. See [8-stage baseline overview](../baseline-phases.md).

## System boundary

```text
Editor React/Three.js ─┐
                       ├─ Shared TypeScript core ── FastAPI JSON API ── PostgreSQL
Runtime React/Three.js ┘                                  ├────────── Google Cloud Storage
                                                          └────────── Cloud CDN / published assets
```

The editor modifies a project. The runtime reads and executes a published project. The API is the authority for identity, access, persistence, and publication. The browser is never the authority for authorization.

## Module boundaries

This table is now grounded in the actual source tree. `apps/editor/src/EditorApplication.tsx` and `apps/runtime/src/RuntimeApplication.tsx` are thin, documented pass-through boundaries — each simply re-exports a component that still lives at the repository root (`src/App.tsx`, `src/RuntimeView.tsx`) while that migration completes. Treat the `apps/editor` and `apps/runtime` rows below as the intended long-term boundary; the "Location" column for editor/runtime UI work is currently `src/`.

| Module | Purpose | Owns | Must not own | Dependencies | Location |
|---|---|---|---|---|---|
| EditorApplication | Documented apps/editor entry boundary | re-export of the root editor component | domain rules or persistence internals | `src/App.tsx` | `apps/editor/src/EditorApplication.tsx` |
| Editor UI / App shell | Present controls, collect input, own editor session state | scene tabs, object tree, inspector, asset catalog UI, undo/redo wiring | direct arbitrary project mutation | project model, authoring-engine, assets, interaction, sync | `src/App.tsx`, `src/editor/` |
| Viewport | Render and navigate authoring/runtime scene | camera/view state, Three.js scene graph, pointer/gizmo listeners | project persistence | authoring-engine, assets, Three.js | `src/Viewport.tsx`, `src/viewport/` |
| SceneTree | Browse/select hierarchy | tree ordering/lookup helpers | scene graph ownership | project model | `src/editor/sceneTree.ts` |
| Gizmos | Manipulate transforms (move/rotate/scale, view-snap, axis indicators) | drag session visuals, handle geometry | asset storage or API calls | authoring-engine transform math, Three.js | `src/gizmo/` |
| InspectorPanel / AssetPanel | Edit selected properties, browse/place assets | form state, filter state | validation policy | project, assets, commands | `src/App.tsx` (panel sections) |
| InteractionBuilder | Author WHEN -> DO rules onto `ProjectData.rules` | draft rule form | runtime execution | `packages/interaction` types, project model | `src/App.tsx` (rules UI) |
| ProjectModel | Define the canonical experience document | `ProjectData`/`SceneData`/`SceneObject`/`InteractionRule`/`ZoneDefinition`/`EnvironmentDefinition` | rendering or HTTP | none | `packages/project/src/index.ts` |
| AuthoringEngine | Standalone custom authoring component: object CRUD, transform math, command timeline | object operations (create/duplicate/remove/reparent/transform/rename), world-transform composition, undo/redo snapshot timeline, cascading removal of rules that reference a removed object (`removeObject`'s `removedRules`) | React, API, database, renderer ownership | `packages/project` | `packages/authoring-engine/src/` |
| Assets | Resolve asset references to renderable descriptors, with caching | `AssetRef`/`AssetDescriptor`/`AssetResolver` contract, `PrimitiveResolver`/`LocalCatalogResolver`/`RemoteMediaResolver`, `CachingAssetResolver`, `PlaceholderAssetResolver` | project graph rules, HTTP transport details beyond fetch | `packages/project` (AssetKind) | `packages/assets/src/` |
| Interaction / InteractionEngine | Match WHEN triggers and sequence DO actions | pure `dispatch()`, `RuntimeState`, `DispatchResult`, zone occupancy tracking, action registry/sequencer | React presentation details, I/O | `packages/project` (InteractionRule, ActionSpec) | `packages/interaction/src/` |
| Sync | Offline-tolerant dual-write of project saves to a backend | `SyncQueue`, `SyncClient`, `SyncResult`, retry/backoff, conflict detection | UI state, canonical persistence truth | none (generic over payload type) | `packages/sync/src/` |
| Debugging | Structured diagnostics and logging | log levels, redaction, injectable sinks, request correlation | business decisions, persistence truth, secrets | none | `packages/debugging/src/`, `apps/api/app/main.py` |
| RuntimeApplication | Documented apps/runtime entry boundary | re-export of the root runtime view | editing commands | `src/RuntimeView.tsx` | `apps/runtime/src/RuntimeApplication.tsx` |
| RuntimeView | Coordinate visitor playback using the shared viewport | runtime lifecycle, dispatch wiring | authoring commands | project, interaction, viewport | `src/RuntimeView.tsx` |
| API | FastAPI HTTP surface: routing, auth, request logging | request lifecycle, route registration, JWT validation | browser rendering | SQLAlchemy models, Auth0 JWKS | `apps/api/app/main.py`, `apps/api/app/routers/`, `apps/api/app/auth.py` |
| Persistence (models) | Define the relational schema for organisations/actors/projects/versions/media/rules/analytics | SQLAlchemy `Base` models and constraints | route/business logic (still skeleton) | PostgreSQL | `apps/api/app/models.py`, `apps/api/alembic/` |
| AssetStorage | Generate presigned S3-compatible upload/download URLs | boto3 client, MinIO bucket config | project graph rules | boto3, MinIO | `apps/api/app/storage.py` |
| Publishing / Analytics / Media / Rules routers | Declare the resource-oriented route surface for versions, analytics, media, and rules | route signatures, Pydantic request/response models | handler business logic (currently `raise not_implemented(...)`, HTTP 501) | FastAPI | `apps/api/app/routers/publish.py`, `analytics.py`, `media.py`, `rules.py` |
| Auth/AccessControl | Validate Auth0-issued JWTs against tenant JWKS | JWKS fetch/cache, token decode, `get_current_token` dependency | client-only permissions, route authorization decisions (not yet wired into routers) | Auth0 OIDC, `python-jose`, `httpx` | `apps/api/app/auth.py` |

Note: the project/publish/media/analytics/rules routers are real FastAPI routing with typed Pydantic models, but every handler body currently raises `not_implemented(...)` (HTTP 501) per `apps/api/app/routers/_skeleton.py`. Do not treat route existence as evidence that CRUD, publishing, or analytics ingestion is implemented — see [contracts.md](UNDATED--FOUNDATION--contracts.md) for the per-route status.

**Proposed, not built.** [`attachment-integration.md`](../subsystems/attachment-integration.md) and its four companion type docs (audio, image, text, video) propose new `Audio`/`Image`/`Text`/`Video` modules and changes to `ProjectModel`, `AuthoringEngine`, `Assets`, and `Viewport`. None of that is implemented; no `packages/audio`, `packages/image`, `packages/text`, or `packages/video` exist on disk. Treat the table above as the current module set only.

## Canonical interfaces

The interfaces below are as originally planned; they describe the target shape, not all of which is implemented verbatim. Where the real exported name differs, it is noted inline.

```text
interface ProjectRepository {
  get(projectId: ProjectId, actor: Actor): Promise<ProjectRecord | null>
  save(project: ProjectDocument, actor: Actor): Promise<ProjectVersion>
  listVersions(projectId: ProjectId, actor: Actor): Promise<ReadonlyArray<ProjectVersion>>
}
// NOT YET IMPLEMENTED as a repository/service. apps/api/app/routers/projects.py and
// publish.py declare the matching FastAPI routes (GET/POST /projects, GET .../versions,
// POST .../versions to publish) but every handler raises HTTP 501 not_implemented.

interface ProjectSerializer {
  serialize(project: ProjectDocument): string
  deserialize(serialized: string): ProjectDocument
  migrate(serialized: string, fromVersion: number): string
}
// Implemented as concrete functions, not a class/interface, in src/serializer.ts
// (saveProject/loadProject/exportProjectJson-style helpers) — there is no
// packages/serialization/ package yet; schema migration is limited to the
// additive-field backfill described in packages/project/src/index.ts.

interface InteractionEngine {
  dispatch(event: RuntimeEvent, project: ProjectDocument, state: RuntimeState): DispatchResult
}
// IMPLEMENTED, close to verbatim. Real signature (packages/interaction/src/dispatcher.ts):
//   dispatch(event: RuntimeEvent, rules: readonly InteractionRule[], project: ProjectData, state: RuntimeState): DispatchResult
// Argument order differs (rules is explicit, ahead of project) — see "Usage" below.

interface Command {
  execute(project: ProjectDocument): ProjectDocument
  undo(project: ProjectDocument): ProjectDocument
}
// NOT a Command class per object mutation. packages/authoring-engine instead exposes
// pure functions (createObject, removeObject, updateObjectTransform, ...) that each
// return a new ProjectData, plus a generic createCommandTimeline<T>() for undo/redo
// over whatever state type the caller commits (see authoring-engine's "Usage" below).

interface AssetStorage {
  createUploadUrl(asset: AssetDescriptor, actor: Actor): Promise<UploadUrl>
  createReadUrl(assetId: AssetId, access: AssetAccess): Promise<ReadUrl>
}
// PARTIALLY IMPLEMENTED. apps/api/app/storage.py implements real boto3 presigned URL
// generation (generate_presigned_upload_url, generate_presigned_download_url) against
// MinIO, but apps/api/app/routers/media.py's request_media_upload handler that would
// call it and persist a MediaAsset row still raises not_implemented.

interface DraftPersistence {
  writeDraft(project: ProjectDocument, revision: number): Promise<PersistenceReceipt>
  readDraft(): Promise<ProjectDocument | null>
  readBackup(): Promise<ProjectDocument | null>
  clearDraft(): Promise<void>
}
// IMPLEMENTED as src/serializer.ts's localStorage-backed draft/backup/autosave
// functions (Tier 1). packages/sync/src/SyncClient.ts layers a Tier 2 background
// sync queue on top (see sync's "Usage" below); it does not replace Tier 1.

interface AuthoringEngine {
  select(hit: SelectionHit): SelectionState
  beginTransform(input: TransformStart): TransformSession
  updateTransform(session: TransformSession, input: PointerSample): TransformPreview
  commitTransform(session: TransformSession): Command
  undo(): ProjectDocument
  redo(): ProjectDocument
}
// DRIFTED from this exact shape. Selection/drag-session pointer math lives in
// src/viewport/interactionMath.ts and src/gizmo/ (not in packages/authoring-engine).
// packages/authoring-engine/src/index.ts instead exports createCommandTimeline<T>()
// (generic commit/undo/redo over snapshots) plus the object-operation functions
// listed above. There is no SelectionHit/TransformSession type in the package.
```

## Usage

Real, grounded example of the editor's core loop — author edits an object's transform, commits it to the undo/redo timeline, and the interaction engine later dispatches a runtime event against the resulting `ProjectData`:

```ts
import { updateObjectTransform, createCommandTimeline } from '@vthere/authoring-engine'
import { cloneProject, type ProjectData } from '@vthere/project'
import { dispatch, createRuntimeState } from '@vthere/interaction'

// 1. Authoring: a pure operation returns a new ProjectData; commit it to history.
const timeline = createCommandTimeline<ProjectData>(project, cloneProject)
const { project: nextProject } = updateObjectTransform(timeline.current, {
  sceneId: 'scene-gallery',
  objectId: 'cube-123',
  changes: { position: [1, 0.55, 0] },
})
timeline.commit('Move Cube', nextProject)
// timeline.undo() / timeline.redo() step the same timeline.

// 2. Runtime: dispatch a visitor event against the project's authored rules.
const runtimeState = createRuntimeState(nextProject.activeSceneId)
const result = dispatch(
  { kind: 'objectClick', objectId: 'cube-123' },
  nextProject.rules ?? [],
  nextProject,
  runtimeState,
)
// result.actions is the ordered ActionSpec[] to execute; result.nextState replaces runtimeState.
```

See [contracts.md](UNDATED--FOUNDATION--contracts.md) for the full API resource list and its 501-skeleton status, and [../subsystems/when-do-dispatch-engine.md](../subsystems/when-do-dispatch-engine.md) / [../subsystems/authoring-engine.md](../subsystems/authoring-engine.md) for deeper subsystem detail.

## Persistence invariants

- Every user-visible edit is committed as one command or one compound command. Undo and redo operate on that same ordered timeline; a new edit clears the redo branch.
- The serialized project is canonical JSON with a schema version. Serialize -> deserialize must preserve IDs, ordering, transforms, components, interactions, and scene relationships.
- Draft writes are debounced, revisioned, and atomic from the caller's perspective. A failed primary write never reports `saved`.
- The browser keeps a recoverable local draft and a last-known-good backup. The server-backed version is the durable source of truth once synchronization succeeds.
- Recovery order is: valid current draft -> valid backup -> last server revision -> clean project. The UI must identify which source was recovered.
- Autosave and explicit save use the same persistence adapter. Export JSON remains the user-controlled escape hatch when storage or network recovery fails.
- Published versions are immutable snapshots. Editing a draft cannot mutate a published visitor experience.

## Standalone custom authoring component

`packages/authoring-engine/` is the project's primary custom-built technical component. It is framework-agnostic TypeScript and is tested (`index.test.ts`, `transformMath.test.ts`) without React, the API, or a browser renderer.

As implemented, it owns: world-transform composition/decomposition for reparenting (`composeWorldTransform`, `localTransformForNewParent` in `transformMath.ts`), object lifecycle operations (create/duplicate/remove/reparent/rename/transform/visibility, scene create/update/activate), and the generic snapshot undo/redo timeline (`createCommandTimeline`). Gizmo handle hit testing, axis/plane pointer-drag math, and selection session state are implemented separately in `src/gizmo/` and `src/viewport/interactionMath.ts` at the root editor level — they are not (yet) inside this package. Three.js adapters may provide camera/ray data, but Three.js does not own the authoring contract.

The engine must not own React state, persistence providers, HTTP, authentication, asset loading, or runtime visitor behaviour. The editor supplies input and renders the engine's preview/selection output; the persistence adapter (`src/serializer.ts`, and `packages/sync` for background sync) stores the resulting versioned project.

## Data flow

1. Editor input becomes an authoring-engine object operation or a validated project update, committed to the undo/redo timeline.
2. Shared project state is serialized with a schema version (`src/serializer.ts`); `packages/sync`'s `SyncClient` stages the same project for background delivery to the API.
3. API receives authenticated HTTPS JSON and would validate ownership, schema, and publication rules — routing and Pydantic contracts for this exist (`apps/api/app/routers/projects.py`, `publish.py`), but the handlers are not yet implemented (HTTP 501).
4. API would store project metadata/version documents in PostgreSQL (schema exists: `apps/api/app/models.py`) and large media in S3-compatible storage (presigned URL generation exists: `apps/api/app/storage.py`); the routes that persist rows are not yet implemented.
5. Publish would create an immutable published version and CDN-readable runtime endpoint — planned, not implemented.
6. Runtime (`src/RuntimeView.tsx`, wrapped by `apps/runtime/src/RuntimeApplication.tsx`) loads the same `ProjectData`, reconstructs the scene, and dispatches visitor events through `@vthere/interaction`'s `dispatch()`. Sending analytics events to the API is planned (`apps/api/app/routers/analytics.py` exists as a 501 skeleton) but not implemented.

## Tradeoffs

- **JSON project versions in PostgreSQL:** keeps editor/runtime parity and version history explicit; large binary media stays out of the database.
- **FastAPI instead of a TypeScript API:** reuses the repository family's Python backend experience and gives typed OpenAPI contracts; generated TypeScript API types must prevent drift.
- **Cloud Storage with Cloud CDN:** separates delivery performance from the application API; private assets require signed URLs and explicit cache invalidation on publication. MinIO supplies the local S3-compatible development service.
- **No real-time transport:** collaboration is outside MVP, so WebSockets/WebRTC would add complexity without a current requirement.

## Dependency and cycle check

Allowed direction is UI/apps -> shared packages -> no app dependencies. API services may depend on shared schema definitions but shared packages must not import React, FastAPI, database code, or Three.js UI adapters. No dependency cycle is permitted.

As implemented, the shared TypeScript packages are `packages/project`, `packages/authoring-engine`, `packages/assets`, `packages/interaction`, `packages/sync`, and `packages/debugging` (see `packages/*/package.json` for their declared `dependencies`; only `authoring-engine`, `assets`, and `interaction` depend on `@vthere/project`, and none depend on each other or on React/Three.js). There is no `packages/spatial/`, `packages/serialization/`, `packages/commands/`, or `packages/validation/` — those planned boundaries have not been split out; their responsibilities currently live inside `src/viewport/`, `src/gizmo/`, `src/serializer.ts`, and `packages/authoring-engine`.
