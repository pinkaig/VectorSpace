# Architecture Skeleton

## System boundary

```text
Editor React/Three.js ─┐
                       ├─ Shared TypeScript core ── FastAPI JSON API ── PostgreSQL
Runtime React/Three.js ┘                                  ├────────── Google Cloud Storage
                                                          └────────── Cloud CDN / published assets
```

The editor modifies a project. The runtime reads and executes a published project. The API is the authority for identity, access, persistence, and publication. The browser is never the authority for authorization.

## Module boundaries

| Module | Purpose | Owns | Must not own | Dependencies | Location |
|---|---|---|---|---|---|
| EditorApplication | Coordinate authoring lifecycle | editor session/mode | domain rules or persistence internals | editor UI, shared core | `apps/editor/src/EditorApplication.ts` |
| Editor UI | Present controls and collect input | transient UI state | direct arbitrary project mutation | EditorApplication, commands | `apps/editor/src/ui/` |
| Viewport | Render and navigate authoring scene | camera/view state | project persistence | spatial, selection, Three.js | `apps/editor/src/viewport/` |
| SelectionSystem | Select scene objects | selected object IDs | transform calculation | scene model, raycasting | `apps/editor/src/viewport/SelectionSystem.ts` |
| GizmoSystem | Manipulate transforms | drag session state | asset storage or API calls | spatial, commands | `apps/editor/src/gizmos/` |
| SceneTreePanel | Browse/select hierarchy | UI expansion state | scene graph ownership | selection, commands | `apps/editor/src/ui/SceneTreePanel.tsx` |
| AssetPanel | Browse/place approved assets | filter state | arbitrary upload/conversion | assets, commands | `apps/editor/src/ui/AssetPanel.tsx` |
| InspectorPanel | Edit selected properties | form state | validation policy | project, validation, commands | `apps/editor/src/ui/InspectorPanel.tsx` |
| InteractionBuilder | Create WHEN -> DO definitions | draft rule form | runtime execution | interaction types, validation | `apps/editor/src/ui/InteractionBuilder.tsx` |
| ProjectModel | Define entire experience | project graph | rendering or HTTP | scene, components | `packages/project/` |
| Spatial | Define transforms/rays/planes | immutable math values | UI state | none | `packages/spatial/` |
| InteractionEngine | Match triggers and execute actions | runtime dispatch state | React presentation details | interaction definitions | `packages/interaction/` |
| Serialization | Convert project <-> versioned file | schema/migration logic | database transport | project types | `packages/serialization/` |
| Validation | Check project correctness | validation rules | UI display | project/interaction | `packages/validation/` |
| Commands | Modify state and undo/redo | command history | UI controls | project | `packages/commands/` |
| AuthoringEngine | Standalone custom authoring component | selection/transform sessions, command timeline, draft checkpoints | React, API, database, renderer ownership | project, spatial, commands, serialization, validation | `packages/authoring-engine/` |
| Debugging | Structured diagnostics and logging | log levels, redaction, injectable sinks, request correlation | business decisions, persistence truth, secrets | shared packages, editor, API | `packages/debugging/`, `apps/api/app/main.py` |
| RuntimeApplication | Coordinate visitor playback | runtime lifecycle | editing commands | runtime scene, interaction | `apps/runtime/src/` |
| RuntimeScene | Reconstruct published scene | runtime scene instances | authoring state | project, Three.js | `apps/runtime/src/RuntimeScene.ts` |
| API | Communicate with server | request lifecycle | browser rendering | repositories/services | `apps/api/` |
| Persistence | Store projects/versions | database transactions | UI concerns | PostgreSQL/SQLAlchemy | `apps/api/src/repositories/` |
| AssetStorage | Store large assets/media | object references | project graph rules | S3-compatible API | `infrastructure/storage/` |
| Publishing | Create accessible experiences | publication records | editor presentation | validation, persistence, CDN | `apps/api/src/services/` |
| Auth/AccessControl | Enforce author/project access | identity/access decisions | client-only permissions | OIDC provider, API | `apps/api/src/` |

## Canonical interfaces

```text
interface ProjectRepository {
  get(projectId: ProjectId, actor: Actor): Promise<ProjectRecord | null>
  save(project: ProjectDocument, actor: Actor): Promise<ProjectVersion>
  listVersions(projectId: ProjectId, actor: Actor): Promise<ReadonlyArray<ProjectVersion>>
}

interface ProjectSerializer {
  serialize(project: ProjectDocument): string
  deserialize(serialized: string): ProjectDocument
  migrate(serialized: string, fromVersion: number): string
}

interface InteractionEngine {
  dispatch(event: RuntimeEvent, project: ProjectDocument, state: RuntimeState): DispatchResult
}

interface Command {
  execute(project: ProjectDocument): ProjectDocument
  undo(project: ProjectDocument): ProjectDocument
}

interface AssetStorage {
  createUploadUrl(asset: AssetDescriptor, actor: Actor): Promise<UploadUrl>
  createReadUrl(assetId: AssetId, access: AssetAccess): Promise<ReadUrl>
}

interface DraftPersistence {
  writeDraft(project: ProjectDocument, revision: number): Promise<PersistenceReceipt>
  readDraft(): Promise<ProjectDocument | null>
  readBackup(): Promise<ProjectDocument | null>
  clearDraft(): Promise<void>
}

interface AuthoringEngine {
  select(hit: SelectionHit): SelectionState
  beginTransform(input: TransformStart): TransformSession
  updateTransform(session: TransformSession, input: PointerSample): TransformPreview
  commitTransform(session: TransformSession): Command
  undo(): ProjectDocument
  redo(): ProjectDocument
}
```

## Persistence invariants

- Every user-visible edit is committed as one command or one compound command. Undo and redo operate on that same ordered timeline; a new edit clears the redo branch.
- The serialized project is canonical JSON with a schema version. Serialize -> deserialize must preserve IDs, ordering, transforms, components, interactions, and scene relationships.
- Draft writes are debounced, revisioned, and atomic from the caller's perspective. A failed primary write never reports `saved`.
- The browser keeps a recoverable local draft and a last-known-good backup. The server-backed version is the durable source of truth once synchronization succeeds.
- Recovery order is: valid current draft -> valid backup -> last server revision -> clean project. The UI must identify which source was recovered.
- Autosave and explicit save use the same persistence adapter. Export JSON remains the user-controlled escape hatch when storage or network recovery fails.
- Published versions are immutable snapshots. Editing a draft cannot mutate a published visitor experience.

## Standalone custom authoring component

`packages/authoring-engine/` is the project's primary custom-built technical component. It is framework-agnostic TypeScript and can be tested without React, the API, or a browser renderer.

It owns pointer-to-transform mathematics, gizmo handle hit testing, axis/plane constraints, selection sessions, command grouping, undo/redo, and checkpoint requests. Three.js adapters may provide camera/ray data, but Three.js does not own the authoring contract.

The engine must not own React state, persistence providers, HTTP, authentication, asset loading, or runtime visitor behaviour. The editor supplies input and renders the engine's preview/selection output; the persistence adapter stores the resulting versioned project.

## Data flow

1. Editor input becomes a command or validated project update.
2. Shared project state is serialized with a schema version.
3. API receives authenticated HTTPS JSON and validates ownership, schema, and publication rules.
4. API stores project metadata/version documents in PostgreSQL and large media in S3-compatible storage.
5. Publish creates an immutable published version and CDN-readable runtime endpoint.
6. Runtime loads the same versioned project document, reconstructs the scene, dispatches visitor events through the shared interaction engine, and sends analytics events to the API.

## Tradeoffs

- **JSON project versions in PostgreSQL:** keeps editor/runtime parity and version history explicit; large binary media stays out of the database.
- **FastAPI instead of a TypeScript API:** reuses the repository family's Python backend experience and gives typed OpenAPI contracts; generated TypeScript API types must prevent drift.
- **Cloud Storage with Cloud CDN:** separates delivery performance from the application API; private assets require signed URLs and explicit cache invalidation on publication. MinIO supplies the local S3-compatible development service.
- **No real-time transport:** collaboration is outside MVP, so WebSockets/WebRTC would add complexity without a current requirement.

## Dependency and cycle check

Allowed direction is UI/apps -> shared packages -> no app dependencies. API services may depend on shared schema definitions but shared packages must not import React, FastAPI, database code, or Three.js UI adapters. No dependency cycle is permitted.
