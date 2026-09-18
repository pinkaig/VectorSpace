# VThere Spatial Experience Builder - Session Handoff

## Objective / topic

Two parallel workstreams (Week 3):
- **Phase 2 command-path slice:** Team owns custom gizmo build; this thread stays open for when the gizmo integration needs the move/rotate/scale command history wired up.
- **Full-stack infrastructure skeleton:** Tech lead effort to scaffold the complete architecture (frontend → backend → persistence → storage → deployment) with real plumbing and skeleton business logic, so the team can build on top of working infrastructure instead of hitting missing pieces at each phase.
Document the VThere implementation and establish the team workflow for documentation, CI, CD, and smoke testing. The current implementation slice also includes the Wk2 persistence/import/runtime work described below.

## Decisions made and why

- Browser `localStorage` remains a local draft mechanism only; it is not durable multi-user persistence.
- The editor exposes both `Load draft` for browser storage and `Import JSON` for a user-selected `.json` file.
- Imported files are validated before replacing the current project. Invalid imports leave the current project unchanged.
- Validation rejects malformed JSON, unsupported schema versions, wrong file types, files over 2 MB, invalid project/scene/object structure, non-finite transforms, duplicate IDs, overlong labels, more than 100 scenes, or more than 5,000 objects.
- Automatic corruption repair is intentionally not implemented. Silent guessing could destroy valid data; future recovery should produce a report or preview instead.
- The first save writes both the primary local draft and backup. Existing draft recovery tries primary, then backup, then a clean project.
- The runtime work is a local read-only simulation using the same current `ProjectData` and Three.js viewport. It is not a published URL or separate `apps/runtime` application yet.
- Asset management starts with a data-driven approved catalog and search. Arbitrary upload, conversion, remote storage, thumbnails, and missing-asset recovery remain deferred until their contracts are approved.
- File-level documentation is the implementation reference: source headers describe each file's current responsibility, inputs, outputs, members, and larger guide link.
- Markdown subsystem pages describe the larger cross-file systems, architecture, data flow, examples, error handling, testing, and history.
- The normal branch workflow is feature branch -> `working` pull request -> CI/review -> `working`; `main` is reserved for milestone/submission pull requests from `working`.
- The required CI status check is named `build-and-test`, covering `npm ci`, typecheck, unit tests, production build, and the initial browser smoke test.
- CD is intentionally deferred until CI and smoke tests are reliable. Deployment should run from protected `main` through a protected GitHub Environment.

## Current skeleton / plan state

- Phase plan: `docs/07-research-and-history/2026-09-07--HISTORY--week2-runtime-persistence-plan.md`.
- Implemented runtime preview controls: `Run simulation`, visitor-style simulation screen, `Exit simulation`, and non-interactive viewport mode.
- Implemented persistence clarity: `Load draft`, visible localStorage status, save/autosave status, backup status, and JSON export.
- Implemented JSON import: browser file picker, import status/error reporting, strict validation, and no state replacement on rejection.
- Implemented asset foundation: `src/assets.ts` owns asset metadata and filtering; the asset panel has searchable approved assets and match counts.
- Implemented viewport resource cleanup so scene objects are not recreated and GPU resources are not leaked every animation frame.
- Implemented file-level headers in the core application and package boundaries: `src/main.tsx`, `src/App.tsx`, `src/RuntimeView.tsx`, `src/Viewport.tsx`, `src/model.ts`, `src/serializer.ts`, `packages/project/src/index.ts`, `packages/debugging/src/index.ts`, and `packages/authoring-engine/src/index.ts`.
- Implemented verbose subsystem guides: `docs/05-subsystems/project-serialization.md` and `docs/05-subsystems/viewport.md`.
- Implemented documentation standard: `docs/04-engineering/source-file-header-standard.md`.
- Implemented AI declaration: `docs/ai-declaration.md`; verification is deliberately marked ongoing and must be updated only with completed checks.
- Updated `docs/README.md` to link the new documentation pages.
- Repository-level `.github/workflows/ci.yml` now runs the VThere checks on pull requests and pushes to the existing case-sensitive `Working` integration branch and `main`.
- Architecture remains intentionally unchanged. The root `src/` editor is still the current implementation surface; `apps/runtime` remains a placeholder and backend/API publishing is not wired.

## Architecture mapping update

- A VThere architecture map was generated in `CODEBASE_GUIDE.md` from commit `5a36a13355956f7339229af655d205ede6b4e1eb` on 2026-09-09.
- The map records the current root `src/` prototype, existing workspace packages, API health scaffold, missing planned boundaries, plan-versus-reality drift, dependency order, ownership guidance, and ECS-oriented pattern translations.
- AI assistance was used for repository analysis and documentation drafting. Human approval of the generated guide and confirmation of prompt data handling remain pending.

## Build / verify command and status

Run from `VThere Spatial Experience Builder/`:

```text
npm install
npm run build
npm run dev
python -m pytest apps/api/tests
python -m uvicorn apps.api.app.main:app --reload --port 8000
```

Current status: **CI implemented and verified locally for the VThere frontend**. `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd test` (4 files, 8 tests), `npm.cmd run build`, and `npm.cmd run test:e2e` (1 browser test) passed. The build still reports the existing Vite large-chunk warning. `python -m pytest apps/api/tests` could not run because `pytest` is not installed in the selected Python 3.12 environment; full backend integration tests and the planned app move remain outstanding.

The API pytest result in this handoff is therefore not a passing result for this session; the earlier documented passing result should be re-established after installing the API test dependencies.

1. Add an asset and save the project.
2. Reload the page and use `Load draft`.
3. Export JSON.
4. Import the exported JSON through the browser file picker.
5. Try a malformed, oversized, wrong-extension, or structurally invalid JSON file and confirm the current project remains unchanged.
6. Search the asset catalog.
7. Run simulation, confirm editor controls are absent, then exit simulation.

Current verification status: VS Code diagnostics report no errors in the CI and Playwright files. The frontend CI target commands pass locally on Node.js 24/npm 11; the project requires Node.js 22+/npm 10+. The GitHub-hosted workflow still needs to be exercised by pushing this workflow to GitHub and opening a pull request into `Working`.

CI/CD target verification:

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

The current `package.json` includes `typecheck` and `test:e2e`; Playwright is locked in `package-lock.json`, and the smoke test is under `tests/e2e/smoke.spec.ts`.

## Files touched for this topic

- `src/App.tsx`
- `src/serializer.ts`
- `src/assets.ts`
- `src/Viewport.tsx`
- `src/RuntimeView.tsx`
- `src/styles.css`
- `docs/07-research-and-history/2026-09-07--HISTORY--week2-runtime-persistence-plan.md`
- `docs/04-engineering/source-file-header-standard.md`
- `docs/05-subsystems/project-serialization.md`
- `docs/05-subsystems/viewport.md`
- `docs/ai-declaration.md`
- `docs/README.md`
- `src/main.tsx`
- `src/App.tsx`
- `src/RuntimeView.tsx`
- `src/Viewport.tsx`
- `src/model.ts`
- `src/serializer.ts`
- `packages/project/src/index.ts`
- `packages/debugging/src/index.ts`
- `packages/authoring-engine/src/index.ts`
- `SESSION.md`

## Failed approaches already tried

- Treating `localStorage` as the only project-loading mechanism was insufficient because it cannot load a JSON file from another browser or machine.
- Accepting any parsed object with `schemaVersion === 1` was insufficient because malformed structure, duplicate IDs, invalid transforms, and excessive resource counts could pass through.
- Automatic corruption repair was rejected as unsafe. The current behavior rejects and preserves the active project instead.
- A full build/test/browser run was attempted but blocked because Node/npm was unavailable in the current PowerShell PATH.
- A Git diff check was attempted but Git was unavailable in the current PowerShell PATH.
- A combined documentation/header patch initially failed because `src/model.ts` had changed into a re-export boundary; the header was then written to describe its actual role and the shared canonical model was documented separately.
Earlier implementation/design files remain in the folder as described above.

Architecture mapping session:

- `CODEBASE_GUIDE.md`
- `SESSION.md`

- Attempted `npm install` and build verification; failed because `npm`/Node.js was not installed or discoverable on Windows.
- Initial broad Stage 3 review omitted the formal validation block, per-phase verification commands, and testing-strategy document; these were added before this handoff.
- Temporary DOCX extraction was used for audit search and then removed; no extracted review artifact remains in the topic folder.
- API verification could not be rerun because the selected Python environment does not have `pytest` installed.

## Open questions

- Should imported JSON be autosaved immediately, or require an explicit confirmation before replacing the local draft?
- Should import support a preview/diff screen before commit?
- What exact asset metadata is required: thumbnail URL, GLB URL, license, scale, pivot, category, and performance budget?
- Should missing assets block loading, show placeholders, or produce a repair report?
- When should persistence move from browser storage to the FastAPI/PostgreSQL/object-storage path?
- When should the local simulation become the separate `apps/runtime` application boundary?
- What visitor interactions, navigation model, and analytics events must the runtime support?
- Should the documentation headers be added to every remaining source and test file, or only files with a public boundary and non-trivial implementation?
- Confirm whether the repository should rename the existing `Working` branch to lowercase `working`; the workflow currently follows the branch name that exists.
- Which approved deployment provider will own the protected production environment?
- Which instructor/team accounts should receive review and Actions visibility?

## Week 3 Parallel Efforts

### Workstream 1: Phase 2 command-path slice (Team gizmo owner)

**Current:** Custom gizmo implementation in progress (move/rotate/scale interactions, handles, visual feedback).  
**Status:** Open and independent until gizmo is ready to wire into the backend command service.  
**Next:** After infrastructure skeleton Stage 1–2 complete, the gizmo will receive the command service endpoint definition and can wire drag sessions into move/rotate/scale commands.

### Workstream 2: Full-stack infrastructure skeleton (Tech lead)

**Plan:** Committed to `docs/07-research-and-history/2026-09-17--PLAN--full-stack-infrastructure-skeleton.md` (expanded 2026-09-17 to include full content/component/media architecture).

**Decisions made:**
- Scope expanded after reading project-scope.md to include content attachment requirements (text/image/audio/video components).
- Content architecture: `SceneObject.components[]`, `MediaAsset` table, `ContentSnapshot` for immutable publishing, signed URLs.
- Interaction engine includes content actions: `showPanel`, `playAudio`.
- MediaRepository service enforces access control (two actors cannot see each other's media).
- Editor UI for content attachment and runtime presentation UI are NOT in skeleton (team-owned work).

**Principle:** Infrastructure (Docker, DB, routes, storage) is real and working. Domain logic (repos, services, dispatch) is skeleton (signature + NotImplementedError).

**Subsystems covered in skeleton:**
- Backend persistence (ProjectRepository, ProjectVersion, revision safety)
- Backend API surface (routers, Pydantic models, auth boundary)
- Content components (text/image/audio/video types, SceneObject.components)
- Media storage & signing (MediaAsset, presigned URLs, S3/MinIO, versioning)
- Publishing & access (PublishingService, ContentSnapshot, immutability invariant, isolation)
- Interaction engine (WHEN→DO dispatch, content actions, zone-entry-once, ordering)
- Deployment (Docker/Compose/Caddy/Actions, VM provisioning)

**Stages (each verified before next):**
1. Local infra: Docker Compose, `.env`, config, DB setup, Alembic init, MinIO for media storage
2. Data model: `models.py` with Organisation, Actor, Project, ProjectVersion, MediaAsset, ContentSnapshot, AnalyticsEvent + migration
3. Backend HTTP + services: routers (projects, media, publish, analytics) + repositories + services + docs
4. `packages/interaction` + `packages/components`: types and skeleton dispatch + docs
5. Production deploy: Dockerfiles, Caddy, Actions, `deployment.md`

**Log:** Progress recorded in `docs/07-research-and-history/2026-09-17--SKELETON--full-stack-infrastructure-log.md` after each stage completes.

**Next:** Tech lead begins Stage 1 (local infrastructure).
Push these changes to the existing `Working` branch, open a pull request targeting `Working`, and confirm that the `build-and-test` check appears and passes in GitHub Actions. Then configure the `Working` and `main` rulesets to require that status check. Keep CD deferred until deployment ownership and the protected production environment are agreed. Continue with focused serializer tests for malformed JSON, wrong schema, duplicate IDs, invalid transforms, size limits, and preservation of the current project after rejection.
Review and approve `CODEBASE_GUIDE.md`, confirm the AI-use and prompt data-handling statements, and resolve the product/brief decisions above. Install the API test dependencies and rerun `python -m pytest apps/api/tests`. Next, move the verified editor into `apps/editor/`, preserve the shared project and authoring-engine imports, then add persistence round-trip tests before implementing further runtime/API phases.

## ECS-style object management and hierarchy handoff

### Objective / topic

Define a safe, durable object architecture for VThere that supports stable IDs, visibility and enabled state, object creation/duplication/removal, and a future hierarchy model without destabilizing the current project snapshot or rendering pipeline.

### Decisions made and why

- Keep the current project snapshot as the canonical source of truth in `packages/project/src/index.ts`.
- Treat render objects, UI selection, and runtime caches as derived data rather than additional authorities.
- Separate `visible` from `enabled` so a hidden object can still be logically active, and an object can be visible but temporarily inactive.
- Avoid a global singleton `ObjectManager` as the primary state owner because it creates a second source of truth and increases cross-layer drift.
- Prefer domain commands or services such as `createObject`, `duplicateObject`, `setVisible`, `setEnabled`, and `removeObject` over direct mutation inside React event handlers.
- Keep this phase intentionally focused on lifecycle semantics; hierarchy and full ECS componentization remain future work, not a forced rewrite.
- Use a hybrid approach: canonical project state plus a future query/index layer and rendering sync, rather than trying to turn the current browser app into a full ECS implementation immediately.

### Current skeleton / plan state

- Current project model remains flat: `SceneData.objects: SceneObject[]`.
- `SceneObject` has an ID, transform, and asset identity; it does not yet encode the full runtime lifecycle state.
- The authoring model is a good fit for a command-based layer, because undo/redo, persistence, validation, and rendering all work from the same project snapshot.
- The render layer is allowed to reconstruct a disposable scene graph from the snapshot; it should not own or mutate the, authoritative object model.
- The hierarchy, grouping, and parent-child semantics are still a planned extension and should be added after lifecycle semantics are stable.
- Object lifecycle research and proposal notes are recorded in the Week 3 design docs, especially the object state lifecycle and hybrid ECS proposals.

### Architecture analysis

The current codebase is structurally healthy for a prototype because the canonical model is centralized and the editor state is not yet duplicated across unrelated subsystems. The risk appears when object behavior grows beyond editing and rendering: creation, duplication, hiding, disabling, deletion, history, persistence, and runtime interactions all become separate decision points if object logic is scattered across React and Three.js.

This means the most important architectural boundary is not whether the app uses ECS terminology, but where the authoritative state lives. If the app uses a mutable singleton or renderer-owned object list as a second source of truth, the system will accumulate bugs around undo, persistence, selection, and re-rendering. The safer model keeps one snapshot and derives behavior from it.

### Open questions

- Should the object model add `visible`, `enabled`, `parentId`, and `groupId` directly to the persisted schema, or should they be introduced behind a versioned migration boundary?
- Should parent-child hierarchy be implemented as a strict tree or a looser scene graph with explicit validation rules?
- Should the render layer filter hidden objects in raycasting and picking, or should visibility be enforced earlier in the object query layer?
- What semantics should a disabled object have in the editor: editable but visually marked, or non-editable while still serialized?
- How should duplicate operations handle references to assets, other objects, or runtime interactions?

### Next recommended step

1. Add the lifecycle fields to the project schema in a migration-safe way.
2. Add pure command functions for create, duplicate, visibility, enabled-state, and delete operations.
3. Validate those operations against the existing project snapshot and maintain one history entry per user-visible action.
4. Add a hierarchy/index layer only after lifecycle semantics are stable.
5. Keep the current renderer synchronization logic derived from the snapshot instead of independent mutation.
6. Revisit ECS alignment only after these commands and contracts are proven stable under undo, save, load, and selection flows.

### Relevant files

- [VThere Spatial Experience Builder/packages/project/src/index.ts](VThere%20Spatial%20Experience%20Builder/packages/project/src/index.ts)
- [VThere Spatial Experience Builder/src/App.tsx](VThere%20Spatial%20Experience%20Builder/src/App.tsx)
- [VThere Spatial Experience Builder/src/Viewport.tsx](VThere%20Spatial%20Experience%20Builder/src/Viewport.tsx)
- [VThere Spatial Experience Builder/src/serializer.ts](VThere%20Spatial%20Experience%20Builder/src/serializer.ts)
- [VThere Spatial Experience Builder/docs/07-research-and-history/Week3/2026-09-15--PROPOSAL--object-entity-and-ecs-architecture.md](VThere%20Spatial%20Experience%20Builder/docs/07-research-and-history/Week3/2026-09-15--PROPOSAL--object-entity-and-ecs-architecture.md)
- [VThere Spatial Experience Builder/docs/07-research-and-history/Week3/2026-09-15--PROPOSAL--object-state-lifecycle-and-web-architecture.md](VThere%20Spatial%20Experience%20Builder/docs/07-research-and-history/Week3/2026-09-15--PROPOSAL--object-state-lifecycle-and-web-architecture.md)

## Wk3 sustainability and current-codebase handoff

### Objective / topic

Assess whether the current Week 2 React/Three.js implementation can support
the remaining development cycle, and identify the smallest Week 3 step that
protects the project's required authoring, preview, persistence, and runtime
direction.

### Decisions made and why

- Treat the current root `src/` editor as a working prototype, not the final
	application boundary.
- Do not refactor `Viewport.tsx` purely to reduce its line count. Extract only
	responsibilities that have a clear owner, test value, or second consumer.
- Prioritize one shared command path for move, rotate, scale, delete, and
	inspector edits before broad file or package restructuring.
- Keep the canonical project snapshot as the only authoritative project state.
	Three.js objects, React selection state, and persistence records remain
	derived or adapter state.
- Keep Three.js for both editor and runtime during the MVP to protect parity
	and avoid maintaining two rendering pipelines.
- Delay full `apps/editor` migration, a new presentation package, ECS expansion,
	and alternate renderers until a vertical slice demonstrates the need.
- Use packages when a contract is framework-free, stable, or has a second
	consumer; use local modules for one-consumer extraction.

### Current skeleton / plan state

Implemented and usable from the current prototype:

- React/Vite editor with primitive scene objects and Three.js viewport.
- Selection, free movement, axis movement, rotation, scaling, orbit mode, and
	walk mode.
- Local save/load, autosave, backup recovery, JSON export, and validated JSON
	import.
- Snapshot undo/redo timeline in `packages/authoring-engine`.
- Local read-only runtime simulation using the current project model and
	viewport.
- Approved asset catalog and search.

Architecturally incomplete or high-risk for future scope:

- `Viewport.tsx` still owns renderer lifecycle, scene synchronization, camera
	behavior, raycasting, gizmos, drag sessions, keyboard navigation, and
	environment loading.
- `App.tsx` still owns direct project mutation callbacks and local snapshot
	history instead of routing all edits through a domain command service.
- The viewport currently rebuilds the object group on relevant changes rather
	than maintaining an entity-ID render cache.
- The runtime is a simulation mode and `apps/runtime` remains a placeholder.
- Shared packages for spatial math, commands, serialization, validation,
	interaction, assets, and presentation are not all implemented.
- API persistence, authentication, publishing, object storage, analytics, and
	full editor/runtime parity tests remain incomplete.

### Sustainability analysis

The current approach is sustainable for the primitive editing spike but not as
the final architecture. File size is not the primary issue. The material risks
are renderer-specific mutation, duplicated edit paths, weak separation between
authoring and rendering, and future drift between preview and published runtime.

The controlling boundary for Wk3 is:

```text
input -> command/domain operation -> new project snapshot
			 -> renderer projection and persistence checkpoint
```

The current code is closer to:

```text
input -> Three.js mutation -> React callback -> cloned project -> autosave
```

The second path can continue only while the feature set is small. Extending it
with content, zones, interactions, navigation, or publishing would increase
history, validation, and parity risk.

### Recommended Wk3 increment

Implement one narrow, tested command-path slice:

1. Define a small command/service contract for move, rotate, and scale.
2. Make viewport transform commits call that service rather than direct
	 project mutation callbacks.
3. Preserve one history entry per completed drag.
4. Add framework-free tests for command results and transform-session behavior.
5. Keep the existing viewport renderer and UI intact unless the slice requires
	 a small adapter change.

Acceptance evidence:

- viewport, inspector, and future scene-tree edits can use the same command
	entry point;
- undo and redo restore the same canonical project snapshots;
- invalid or cancelled transforms do not create history entries;
- existing serializer and browser smoke tests remain passing;
- the implementation does not require React, Three.js, HTTP, or database code
	inside the command logic.

### Build / verify command and status

Run from `VThere Spatial Experience Builder/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

The latest recorded frontend verification passed these checks on Node.js 24
and npm 11. The build still reports the existing Vite large-chunk warning.
The project requires Node.js 22+ and npm 10+. API pytest verification remains
blocked in the recorded environment because `pytest` is not installed.
This Wk3 handoff itself is documentation-only and does not claim a new build
or test run.

### Files touched for this handoff

- `SESSION.md`

Relevant prior analysis, not modified in this handoff:

- `docs/07-research-and-history/2026-09-15--EXPLORATION--web-file-size-and-factorisation.md`

No application source files were changed as part of this handoff.

### Failed or rejected approaches

- Splitting `Viewport.tsx` solely to reduce line count was rejected because it
	can relocate coupling without improving ownership.
- Creating all planned packages immediately was rejected because most do not
	yet have stable contracts or second consumers.

## Rendering factorisation and separation handoff

### Objective / topic

Factor the viewport into owned rendering modules and define a future-proof
rendering architecture for the editor and visitor simulation. The rendering
system should support separate exhibition environments, authored artefacts,
editor tools, runtime attachments, future parent-child relationships, and
custom lighting or post-processing without making renderer state authoritative.

### Current decisions

- Treat rendering as a coordinated presentation architecture, not as a
	replacement for React, the project model, the authoring engine, or
	persistence.
- Keep React responsible for DOM UI: editor panels, inspector controls,
	popups, tooltips, menus, status messages, and runtime overlays.
- Keep Three.js responsible for the simulation viewport: environment,
	artefacts/models, spatial tools, camera, lighting, attachments, and
	post-processing when introduced.
- Keep the canonical `ProjectData` snapshot renderer-independent.
- Treat Three.js objects, gizmos, raycasters, render caches, and GPU resources
	as disposable projections.
- Keep environment rendering separate from authored artefact rendering.
- Keep editor gizmos and selection outlines outside the authored artefact
	hierarchy.
- Keep Three.js for editor and runtime during the MVP to protect preview/runtime
	parity; consider another renderer only after measurable requirements justify
	it.
- Use local modules before creating a shared `packages/presentation` package.
- Do not create empty `RendererManager`, `StageManager`, or `ObjectManager`
	abstractions without a real ownership boundary.

### Completed factorisation

The following boundaries are implemented and documented:

| Concern | Current owner |
|---|---|
| React viewport boundary and remaining Three.js host | `src/Viewport.tsx` |
| Environment construction and asset loading | `src/environments.ts` |
| Environment loading lifecycle, cancellation, status, and replacement | `src/viewport/environmentController.ts` |
| Artefact geometry, materials, visibility, metadata, and disposal | `src/viewport/syncArtefacts.ts` |
| Gizmo handle assembly and disposal | `src/viewport/createGizmoSet.ts` |
| Gizmo placement, sizing, and local/world presentation | `src/viewport/syncGizmo.ts` |
| Pointer, picking, drag sessions, keyboard listeners, and commit callbacks | `src/viewport/interactionController.ts` |
| Camera pose and walk movement | `src/viewport/cameraController.ts` |
| Framework-free ray/axis/rotation calculations | `src/viewport/interactionMath.ts` |
| Loading/error/hint presentation | `src/viewport/ViewportOverlay.tsx` |
| Editor operation adapters and browser ID generation | `src/editor/editorOperations.ts` |
| Editor application boundary | `apps/editor/src/EditorApplication.tsx` |
| Runtime application boundary | `apps/runtime/src/RuntimeApplication.tsx` |

The previous inline pointer and keyboard implementation was removed from
`Viewport.tsx`. The interaction controller is now the active event owner.

### Current rendering-system shape

```text
ProjectData
		-> current viewport props / future render description
		-> Viewport.tsx render host
				+--> environmentController.ts
				+--> syncArtefacts.ts
				+--> cameraController.ts
				+--> interactionController.ts
				+--> createGizmoSet.ts + syncGizmo.ts
				+--> ViewportOverlay.tsx
		-> Three.js scene and WebGL canvas
```

This is a working local rendering system, not yet a general-purpose plugin
framework. The next planned host extraction is `RenderHost` or
`createViewportRuntime`, owning scene creation, renderer setup, lighting/grid,
resize handling, animation timing, stage coordination, and final disposal.

### Future rendering-stage model

After the host extraction, existing modules may be adapted to a small stage
contract:

```ts
interface RenderStage<Context> {
	setup?(context: Context): void
	update(context: Context): void
	dispose(): void
}
```

Candidate stages are:

```text
EnvironmentStage  -> environmentController.ts
ArtefactStage     -> syncArtefacts.ts
CameraStage       -> cameraController.ts
InteractionStage  -> interactionController.ts
GizmoStage        -> createGizmoSet.ts + syncGizmo.ts
OverlayStage      -> ViewportOverlay.tsx
```

The stage contract should not be introduced as empty wrappers before a host
exists. Students should be able to replace or extend stage behaviour while the
framework owns lifecycle, ordering, shared context, error reporting, and
resource cleanup.

### Parent-child rendering considerations

- Add `parentId` through an explicit project schema migration.
- Validate missing parents and cycles before rendering.
- Use local transforms in the project model; let the renderer compose world
	transforms through the Three.js hierarchy.
- Do not serialize both `parentId` and a child array.
- Maintain separate environment and artefact roots.
- Introduce explicit authored anchors if artefacts must attach to walls,
	stands, rooms, or other exhibition structures.
- Add an `EntityId -> THREE.Object3D` cache before complex hierarchy or large
	scenes; the cache must be rebuildable and disposable.

### Optimisation and risk controls

- Keep full artefact rebuilds until profiling justifies incremental sync.
- Measure frame time, draw calls, object count, asset load time, memory after
	runtime transitions, hierarchy update cost, and raycast cost.
- Reuse geometries, materials, textures, and loaded assets where ownership is
	explicit.
- Dispose geometries, materials, textures, controls, listeners, animation
	frames, and environment resources deterministically.
- Use stable entity IDs rather than array indexes.
- Add asset, texture, project-size, object-count, and draw-call budgets.
- Use lazy loading, frustum culling, level of detail, and instancing only when
	the target scenes require them.
- Cap device pixel ratio and provide graceful WebGL/asset-loading failure
	states.
- Keep editor and runtime reconstruction shared to prevent preview drift.
- Keep render stages from mutating `ProjectData`; authoring commands remain the
	only edit path.
- Test repeated editor/runtime entry and exit for duplicate canvases, active
	listeners, and GPU memory leaks.

### Expectations and limits

The rendering system is expected to provide:

- customisable environment and artefact rendering;
- editor tools and runtime presentation;
- image/video or other attachment support through explicit asset adapters;
- parent-child-ready scene composition;
- configurable lighting and future post-processing;
- inspectable resource ownership and cleanup;
- shared editor/runtime reconstruction contracts.

The rendering system is not expected to own:

- canonical project data;
- schema migration or hierarchy validation policy;
- undo/redo or command semantics;
- persistence, API calls, authentication, or publishing;
- React application state;
- a complete ECS registry before profiling demonstrates a need;
- an alternate rendering engine during the MVP.

### Verification status

The latest recorded frontend verification passed:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The suite reports 22 passing tests. The production build succeeds with the
existing Vite large-chunk warning. Browser interaction tests, hierarchy tests,
render-host tests, and API verification remain future work.

### Files and documents for the next agent

- `src/Viewport.tsx`
- `src/viewport/interactionController.ts`
- `src/viewport/cameraController.ts`
- `src/viewport/environmentController.ts`
- `src/viewport/syncArtefacts.ts`
- `src/viewport/createGizmoSet.ts`
- `src/viewport/syncGizmo.ts`
- `src/viewport/interactionMath.ts`
- `src/editor/editorOperations.ts`
- `docs/05-subsystems/viewport.md`
- `docs/05-subsystems/authoring-engine.md`
- `docs/07-research-and-history/Week3/Wk2_3--PLAN--future-proof-rendering-system.md`

### Next recommended step

Extract `RenderHost` or `createViewportRuntime` from `Viewport.tsx`. Preserve
the current stage modules and behaviour. The host should own only Three.js
scene lifecycle, renderer, lighting/grid, resize, animation timing, stage
registration, and disposal. Add a narrow render-description contract only
when it removes direct interpretation of project data from the renderer.
- Building a second runtime renderer was deferred because it would increase
	parity and maintenance risk during the MVP.
- Full ECS expansion was deferred; stable lifecycle commands and canonical
	snapshot semantics must come first.
- Moving the prototype into `apps/editor` before extracting boundaries was
	rejected because it would relocate, rather than remove, current coupling.

### Open questions

- What is the smallest complete author-preview-publish slice the team can
	demonstrate by Week 5?
- Which edits must be routed through the command service before new features
	are added?
- Does the current project document need lifecycle fields such as `visible`,
	`enabled`, and `parentId` in Wk3, or can they wait until the first hierarchy
	requirement is implemented?
- Which planned package has a real second consumer now?
- When does the runtime need shared scene reconstruction strongly enough to
	justify a `packages/presentation` boundary?
- Which acceptance tests prove editor and preview behavior remain equivalent?

### Next recommended step

Build and test the smallest command-path slice for move, rotate, and scale.
After it passes, extract only the pure transform/session logic that the tests
demonstrate is framework-independent. Do not begin the full app migration or
package expansion until that slice is integrated and verified.

## 2026-09-17 Lifecycle verification, parent-child slices 1-2, inspector styling, tests

### Objective / topic

Verify the object-lifecycle handoff
(`docs/07-research-and-history/Week3/2026-09-15--HANDOFF--object-lifecycle-scaffolding-and-next-agent-guide.md`)
against the current branch, then implement the first two parent-child hierarchy
slices (schema + engine operations), style the existing Inspector
duplicate/delete/visibility controls, and add permanent tests.

### Decisions made and why

- The handoff's lifecycle task (createObject/duplicateObject/removeObject/
  ObjectOperationError) was already complete on this branch via merges from
  `Working` (PR #4); it was verified rather than reimplemented.
- Parent-child hierarchy added in slices. Slices 1-2 only (data + operations);
  no UI exposes parenting yet because the editor layout/CSS may still change.
- `parentId` is optional on `SceneObject`; absent means top-level, so old saved
  drafts need no backfill and remain valid.
- Removing a parent removes its whole subtree (Unity-style) so no orphaned
  `parentId` can be saved. Duplicating a parent copies the subtree; the copied
  root keeps the original's parent, copied children point at the copied root.
- Transforms remain world-space: re-parenting does not yet move children with
  the parent. Transform inheritance is deliberately deferred (slice 5) and
  needs its own design review before implementation.
- Undo/redo needed zero changes: the CommandTimeline stores whole ProjectData
  snapshots, so `parentId` participates in undo automatically.

### Current skeleton / plan state

- Implemented: `parentId?: string` on `SceneObject` (packages/project);
  serializer validation rejecting unknown parents, self-parenting, and cycles;
  `reparentObject` (with `ReparentObjectInput`, null = detach to top level)
  plus subtree-aware `removeObject`/`duplicateObject` in the authoring engine;
  CSS for the Inspector `.toggle-row` and `.inspector-actions` controls that
  already existed in App.tsx but had no styling.
- Deferred (planned slices): hierarchy UI in the scene tree (slice 4) and
  transform inheritance / local-space semantics (slice 5). `status` field and
  groups remain future schema work.

### Build / verify command and status

Run from `VThere Spatial Experience Builder/` (Node 24.21.0, npm 11.19.0):

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

All passing as of 2026-09-17: typecheck clean, 36/36 tests across 7 files
(was 26 before this session), build succeeds with the known pre-existing Vite
large-chunk warning (845 kB bundle). `npm run test:e2e` was not run this
session.

### Files touched this session

- `packages/project/src/index.ts` (added `parentId`, updated pseudocode notes)
- `packages/authoring-engine/src/index.ts` (reparentObject, subtree
  remove/duplicate, collectSubtreeIds)
- `packages/authoring-engine/src/index.test.ts` (+6 tests: delete/undo/redo
  timeline integration, reparent/detach, cycle/self/missing-parent rejection,
  subtree duplicate, subtree remove, subtree undo restore)
- `src/serializer.ts` (parentId field validation + per-scene hierarchy checks)
- `src/serializer.test.ts` (+4 tests: valid parent kept; missing parent,
  self-parent, and cycle rejected)
- `src/styles.css` (`.toggle-row`, `.inspector-actions`)
- `SESSION.md`

All changes are uncommitted on `weian_branch`.

### Failed approaches already tried

- Verifying the new operations with a plain Node type-stripping script failed
  (`node` cannot elide type-only imports from `@vthere/project`); a temporary
  vitest file was used instead, then promoted into the permanent test suites.
- `tsc -b` (build) caught a TS7022 inference cycle in the reparent ancestor
  walk that `tsc --noEmit` (typecheck) missed; fixed with an explicit
  `string | undefined` annotation. Note: typecheck alone is not sufficient
  verification; always run the build too.
- Earlier this session, stale OneDrive file contents misrepresented the branch
  state (files appeared pre-implementation while git showed a clean tree).
  If file contents and `git status` disagree, re-read before editing.

### Open questions

- When parent-child reaches the UI: strict tree list with indentation, or
  drag-to-reparent? (slice 4)
- Transform inheritance semantics for slice 5: what does the inspector show
  for a child (local or world), and should re-parenting preserve the child's
  world position by recomputing its local transform?
- Should the duplicate/delete actions also get keyboard shortcuts
  (Del / Ctrl+D) in the viewport?

### Next recommended step

Commit this work in logical steps ([agent]-prefixed subjects per
GIT_AND_HANDOFF_CONVENTIONS.md), push to `weian_branch`, and open a PR into
`Working` so CI (`build-and-test`) validates it. Then decide slice 4 (hierarchy
UI) scope with the team before touching the scene-tree markup.

## Handoff precedence note

The `Rendering factorisation and separation handoff` section above is the
latest status for the rendering work. It supersedes earlier Wk3 notes that
describe `Viewport.tsx`, `App.tsx`, and the authoring-engine boundary as still
fully inline or unimplemented. Those earlier statements remain as historical
context; use the current source tree and the latest rendering section when
continuing work.

## 2026-09-17 Extended Infrastructure Skeleton + Object Manager Integration

### Objective / topic

Extend the full-stack infrastructure skeleton to include three critical subsystems
(Asset Manager, WHEN→DO dispatch engine, local→cloud sync vehicle), verify the
custom gizmo + object manager integration, and map out the complete 8-stage
implementation plan with blockers and dependencies clearly stated.

### Decisions made and why

- The gizmo (move/rotate/scale handles) is production-ready and already integrated
  with `src/viewport/interactionController.ts`. No gizmo work is needed; only wiring
  the gizmo's callbacks into the command path (Phase 2) when that merges.
- Object manager is complete: `SceneObject.id`, optional `parentId`, `visible`,
  `enabled`, `reparentObject`, subtree-aware `removeObject`/`duplicateObject`.
  Undo/redo works automatically via CommandTimeline snapshots. Parent-child validation
  (no cycles, no missing parents) is in the serializer.
- Three new subsystems are explicitly infrastructure-first ([REAL] not [SKELETON]):
  - Asset Manager: resolver vehicle, not asset vocabulary. Serves primitives/catalog/remote
    through one interface.
  - WHEN→DO Engine: dispatch vehicle, not trigger/action vocabulary. Pure function,
    pluggable executors, deterministic ordering.
  - Sync Engine: queue/retry/conflict vehicle, not policy. Offline-first, idempotent,
    revision-based conflict detection.
- All three subsystems are [REAL] infrastructure + [SKELETON] domain logic. They are
  fully testable in isolation before any domain integration.
- Stages 4a–4c (the three subsystems) run in parallel with backend stages 1–3, so
  infrastructure and client code don't block each other.
- Phase 2 command-path slice remains a blocker for Stage 7 (wiring WHEN→DO into
  runtime), not for stages 1–4.

### Current skeleton / plan state

**Plan documents:**
- `2026-09-17--PLAN--infrastructure-skeleton-extended.md` — complete 8-stage plan with
  three subsystems, dependency tree, and verification per stage.
- `2026-09-17--EXPLORATION--asset-manager-when-do-cloud-sync-guidelines.md` — best-practice
  guidelines for each subsystem (indirection, purity, offline-first, etc.).
- `2026-09-17--REASSESSMENT--after-object-manager-merge.md` — how the object manager
  arrival unblocks Asset Manager and WHEN→DO designs (moving them from Postpone to
  Approve).
- `2026-09-17--DESIGN--when-do-runtime-architecture.md` — the plan for the WHEN→DO logic
  system's runtime architecture: trigger detection (event listeners + edge-triggered
  frame polling for spatial/zone conditions), a `CoroutineManager`-derived
  `ActionSequencer` for timed/sequenced DO actions (JS generators), edit-mode vs.
  play-mode gating, and a shared `resetRuntime()` for both exiting play mode and
  mid-run restarts. Paper design only, still gated on Phase 2.
- `2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md` — next-agent build
  order for the above design (types → dispatch → event sources → ActionSequencer →
  mode gating → resetRuntime), boundary rules to preserve, and acceptance criteria.

**Gizmo and object manager integration:**
- Gizmo files live in `src/gizmo/`: `moveGizmo.ts`, `scaleGizmo.ts`, `rotateGizmo.ts`,
  `rotateGizmo.ts`, `octaOrb.ts`, `colors.ts`, `math.ts`, `types.ts`, `viewSnap.ts`
- Gizmo is mounted in `src/Viewport.tsx`, managed by `src/viewport/syncGizmo.ts`
- Gizmo drag sessions are owned by `src/viewport/interactionController.ts`, which
  calls `commitMove`, `commitScale`, `commitRotate` callbacks
- Object manager (`SceneObject.id`, `parentId`, lifecycle) is in `packages/project/src/index.ts`
- Object operations (`createObject`, `duplicateObject`, `removeObject`, `reparentObject`)
  are in `packages/authoring-engine/src/index.ts`
- All operations are tested (36 tests passing) and undo/redo works automatically

**Stages ready to start:**
- Stage 1 (Docker Compose, config, DB): ready, no blocker
- Stages 4a–4c (Asset Manager, WHEN→DO, Sync): ready, no blocker
- Stage 2 (data model): ready after Stage 1
- Stage 3 (backend HTTP): ready after Stage 2
- Stage 5 (deploy files): ready after Stage 3
- Stage 6 (wire Asset Manager): ready after 4a, no Phase 2 dependency
- Stage 4b (WHEN→DO engine): **done** — `packages/interaction` built and tested (60 tests)
- Stage 7 (wire WHEN→DO): **done** — Phase 2 merge confirmed (`573def4`, `c027666`), all three
  tiers wired into `Viewport.tsx`'s existing RAF loop behind a `runtimeMode` flag. See
  `docs/05-subsystems/when-do-dispatch-engine.md`
- Stage 8 (wire Sync): ready after 4c, independent of Phase 2

### Build / verify command and status

Run from `VThere Spatial Experience Builder/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

**Current pass rate:** 36/36 tests (updated from 22 after parent-child work).
Typecheck clean, production build succeeds (existing Vite chunk-size warning remains).
All gizmo tests in viewport/interactionMath pass. No parent-child UI is exposed yet
(slice 4); only data and operations (slices 1–2) are implemented.

**Uncommitted work:** Parent-child slices 1–2 are on `weian_branch`, merged into
`Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder`. Not yet in
`Working` or `main`.

### Files touched this planning session

- `docs/07-research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md` (new)
- `docs/07-research-and-history/2026-09-17--EXPLORATION--asset-manager-when-do-cloud-sync-guidelines.md` (new)
- `docs/07-research-and-history/2026-09-17--REASSESSMENT--after-object-manager-merge.md` (new)
- `docs/07-research-and-history/2026-09-17--DESIGN--when-do-runtime-architecture.md` (new)
- `docs/07-research-and-history/2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md` (new)
- `Agent Skills/ponytail-skill/SKILL.md` (created, was referenced but never existed)

### Failed approaches already tried

- Waiting for Phase 2 command path before designing Asset Manager / WHEN→DO: unnecessary
  blocker. Object manager arrival + entity-ID resolution means designs can be concrete
  (paper) now.
- Building all packages upfront: avoided. Stages 4a–4c are parallel infrastructure, not
  blocking stages 1–3.
- WHEN→DO vocabulary-first: rejected. The dispatch vehicle (stages 4b) is architecture
  and runs independently of what specific triggers/actions exist; vocabulary is a
  separate design question.

### Open questions

- Should Stage 4a (Asset Manager) include a dev-time GLB catalog scaffolding, or just
  the resolver interface (catalog is filled in later)?
- For Stage 4c (Sync), should conflict resolution strategy be a skeleton body (showing
  the decision tree) or pure interface (just the return signature)?
- Once Phase 2 command path merges, how long should Stage 7 (WHEN→DO wiring) take?
- ~~Where does RuntimeState/dispatch ticking get invoked from?~~ Resolved by
  `2026-09-17--DESIGN--when-do-runtime-architecture.md`: driven from the existing
  `Viewport.tsx` RAF loop, gated by an edit/play mode flag — not a new standalone
  runtime loop.
- Should the Sync Engine's idempotency key format be UUIDv4, or a simpler client-generated
  counter per resource?
- When does the backend's `InteractionRule` schema get designed — Stage 2 (with
  ProjectVersion) or Stage 7 (when wiring starts)?

### Next recommended step

**Immediate (this session):**
1. Push parent-child slices 1–2 from `weian_branch` to `Working` as a PR, verify CI passes.
2. Commit the three extended-plan docs to main branch history (they're architectural
   decisions, not code).
3. Start Stage 1 (Docker Compose + config) in parallel with the PR/CI step.

**Next session (after Phase 2 status is known):**
1. Verify Stage 1 (Compose, health-checks, Alembic init).
2. Begin Stages 4a–4c in parallel (Asset Manager resolver tests, WHEN→DO dispatcher tests,
   Sync queue tests).
3. Start Stage 2 (data model, with schema migration for InteractionRule if Phase 2 is done).
4. Document each subsystem (asset-manager.md, when-do-dispatch-engine.md, sync-engine.md).

**Blocker watch:**
- Phase 2 command-path slice must merge before Stage 7. If Phase 2 is delayed, Stages 1–6
  and 8 proceed without it.
- New gizmo work should land in Phase 2's PR so gizmo+command-path are reviewed together.

### Verification status

All three planning documents are reviewed and ready. Gizmo is production-ready (no
changes needed). Object manager is tested and working. No implementation code has been
written for the three subsystems yet — design is complete, stages 4a–4c are ready to
start when prioritized.

**CI status:** Frontend tests passing, no backend pytest run (Python pytest not installed
in prior session). The extended plan includes explicit backend pytest verification for
each stage.

## 2026-09-17 Phase/Stage reassessment and per-step agent prompt set

### Objective / topic

Reassess actual completion status against the two overlapping numbering schemes in this
repo (old Phase 0–6 from `TECH_LEAD_INFRASTRUCTURE_PLAN.md`, new Stage 1–8 from
`2026-09-17--PLAN--infrastructure-skeleton-extended.md`), and produce a self-contained
prompt per remaining step so future sessions can hand each step to a fresh agent without
re-deriving context.

### Decisions made and why

- Corrected a conflation: the gizmo (Workstream 1) being production-ready is not the same
  as "Phase 3" in `TECH_LEAD_INFRASTRUCTURE_PLAN.md`. Phase 3 there means the interaction/
  WHEN→DO experience system, which is still blocked on Phase 2. The gizmo is a separate,
  already-complete parallel workstream.
- Confirmed Phase 2 (command-path service) is the actual current blocker, not done despite
  gizmo and object-manager both being complete. Gizmo drags still mutate `ProjectData`
  directly in React handlers instead of going through a `TransformCommand` service.
- Found a direct contradiction between two same-day planning docs: the extended plan lists
  Stage 4b (WHEN→DO package) as "ready, no blocker," but
  `2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md` explicitly says not to
  scaffold real `packages/interaction` code until Phase 2 merges. Resolved in favor of the
  newer, more cautious handoff — Stage 4b's types/dispatch design work can proceed, but
  real code should wait.
- Assigned a model/effort tier per step for Claude Code sessions: Sonnet 5 direct-mode for
  mechanical scaffolding (config, packages, tests, docs); Sonnet 5 + Plan Mode for anything
  touching shared history/undo/transform semantics; Opus 5 + Plan Mode reserved for the two
  architecturally load-bearing steps (Phase 2's command interface, and Stage 4b/7's
  WHEN→DO wiring into the RAF loop), since a wrong first draft there is expensive to unwind.

### Current skeleton / plan state

Reassessed order (dependency-driven, not raw phase/stage numbers):

1. Phase 2 — command-path service (`TransformCommand`, move/rotate/scale) — **not started**,
   critical path, blocks Stage 7 and formal Phase 3.
2. Hierarchy UI — parent-child slice 4 — not started, no blocker (slices 1–2 already done).
3. Transform inheritance — parent-child slice 5 — not started, should follow Phase 2 since
   it touches the same commit path.
4. Stage 1 — local dev environment (Docker/DB/config) — not started, no blocker.
5. Stage 4a — Asset Manager package — not started, no blocker.
6. Stage 4c — Sync Engine package — not started, no blocker.
7. Stage 2 — data model + migration — not started, needs Stage 1.
8. Stage 3 — backend HTTP surface — not started, needs Stage 2.
9. Stage 6 — wire Asset Manager into frontend — not started, needs Stage 4a.
10. Stage 4b + Stage 7 — WHEN→DO types, pure `dispatch()`, event sources, `ActionSequencer`,
    mode gating, `resetRuntime()` — not started, needs Phase 2 merged; do not scaffold real
    code before that per the handoff.
11. Stage 8 — wire Sync into autosave — not started, needs Stage 4c.
12. Stage 5 — production deploy — not started, needs Stage 3.

Twelve self-contained prompts (one per step above) were written out in the parent
conversation, each naming the exact docs/files to read, the acceptance criteria, and
whether to use Plan Mode. They are not persisted as a separate file yet — see "Next
recommended step" below if a future session wants them promoted into a tracked doc.

### How to use the Agent tool with these prompts

Reference for running a step as a subagent instead of inline in the main session:

- Use the `Agent` tool with `subagent_type: "claude"` (general) or `"Plan"` (if the prompt
  says to propose an approach before implementing) and paste the step's prompt verbatim as
  the `prompt` argument.
- Steps marked Opus 5 in the parent conversation should have `model: "opus"` passed to the
  `Agent` call; steps marked Sonnet 5 can omit `model` (session default) or pass `"sonnet"`
  explicitly.
- Steps marked "Plan Mode first" expect the agent to propose the interface/data-flow/test
  contracts and stop for approval before writing code — the prompt text itself says this,
  so a general-purpose agent will honor it without needing `EnterPlanMode` from the parent
  session.
- Independent steps (4, 5, 6, 7 vs. 1–3) can be dispatched as parallel background agents
  since they don't share files; steps with a listed dependency (e.g. Stage 3 needs Stage 2)
  must run sequentially.
- After an agent finishes, verify its actual diff before trusting its summary — this
  applies especially to the Phase 2 and Stage 7 steps, since both touch undo/history
  semantics that are easy to get subtly wrong without it showing up as a build failure.

### Open questions

- Should the twelve prompts be promoted into a tracked doc (e.g.
  `docs/07-research-and-history/2026-09-17--PLAN--phase2-to-stage8-prompts.md`) so they
  survive context compaction, or kept only in conversation history?
- Should Stage 4b's type/shape design (RuntimeEvent/RuntimeState/DispatchResult) proceed
  now as paper-only work, given it's explicitly allowed before Phase 2 merges, separate
  from the real dispatcher code which is not?

### Next recommended step

Start Phase 2 (command-path service) in its own session with Opus 5 and Plan Mode, since
it is the single blocker unblocking the largest number of downstream steps (Stage 7,
transform inheritance slice 5, and formal Phase 3). Steps 4–9 can run in parallel sessions
without waiting on Phase 2.

## 2026-09-17 Phase 2 + hierarchy UI + transform inheritance shipped; pivot to frontend business logic; backlog split into per-feature docs

### Objective / topic

Close out steps 1–3 of the reassessed backlog above (Phase 2 command-path service, hierarchy
UI slice 4, transform inheritance slice 5), then a mid-session redirect: pause the backend
track (Stage 1 local dev environment) and pivot to frontend business logic, splitting the
shared multi-feature infrastructure plan into fully self-contained per-feature planning docs.

### Decisions made and why

- Phase 2's command-path service, hierarchy UI, and transform inheritance are now **done** —
  see "Files touched" below for commits. This resolves the single biggest blocker in the
  reassessed backlog: Stage 4b/Stage 7 (WHEN→DO engine) was gated on Phase 2 merging, and
  that gate is now open.
- Transform inheritance (slice 5) decision, confirmed and implemented: re-parenting recomputes
  the child's local transform to preserve its world position (Unity-style), via a new
  framework-free `packages/authoring-engine/src/transformMath.ts` (quaternion/vector TRS
  composition, no `three` dependency). The renderer now nests meshes per `parentId` through
  Three.js's own `Object3D` hierarchy instead of adding everything flat into one group; gizmo
  and drag math convert between world and local space at the interaction boundary via
  `getWorldPosition`/`getWorldQuaternion`/`worldToLocal`, never by hand-rolling matrix math in
  the project model.
- Stage 1 (local dev environment: Docker/Postgres/MinIO/pydantic-settings/Alembic) was started
  — the plan section was read — then explicitly deprioritized before any file was written, in
  favor of frontend business logic. Nothing on disk changed for Stage 1; it is genuinely
  untouched, not partially done.
- The reassessment's open question ("should the twelve prompts be promoted into a tracked doc
  so they survive context compaction") is resolved: **yes**, and further split per-feature
  rather than kept as one shared multi-stage doc. The user's stated preference: smaller,
  specific markdown files per feature/optimization/implementation, each fully generated (not
  a one-line summary), with a pointer added to the subsystem summary index
  (`docs/05-subsystems/`, referenced from `docs/README.md`) even for planned-but-not-yet-built
  subsystems — so the "summary of systems" surfaces planned work, clearly marked as planned,
  alongside built subsystems.
- User preference, for memory: durable planning/context should live in the repo as markdown
  (this backlog, these per-feature docs, `SESSION.md`), not rely on any out-of-repo memory
  mechanism.

### Current skeleton / plan state

Backlog status now tracked in
[`docs/07-research-and-history/2026-09-17--PLAN--frontend-business-logic-backlog.md`](07-research-and-history/2026-09-17--PLAN--frontend-business-logic-backlog.md)
(the full table, supersedes the numbered list in the "2026-09-17 Phase/Stage reassessment"
section above for status purposes — that section's decisions/rationale are still current, only
its status column is stale now):

1. Phase 2 — **done** (`573def4`, `c027666`)
2. Hierarchy UI slice 4 — **done** (`316c3f8`)
3. Transform inheritance slice 5 — **done** (`7cbb708`)
4. Stage 1 (local dev env) — not started, deprioritized (backend track)
5. Asset Manager — not started, no blocker. Full spec:
   [`2026-09-17--PLAN--asset-manager-vehicle.md`](07-research-and-history/2026-09-17--PLAN--asset-manager-vehicle.md)
6. Sync Engine — not started, no blocker. Full spec:
   [`2026-09-17--PLAN--sync-engine-vehicle.md`](07-research-and-history/2026-09-17--PLAN--sync-engine-vehicle.md)
7–9, 12. Stage 2/3/5 backend + Stage 6 (needs Asset Manager) — not started, unchanged from prior reassessment
10. WHEN→DO engine + wiring — not started, **now unblocked** (was: needs Phase 2). Full spec:
    [`2026-09-17--PLAN--when-do-dispatch-engine.md`](07-research-and-history/2026-09-17--PLAN--when-do-dispatch-engine.md)
11. Wire Sync into autosave — not started, needs step 6

Each of steps 5, 6, 10 above also has a short stub in `docs/05-subsystems/` (`asset-manager.md`,
`sync-engine.md`, `when-do-dispatch-engine.md`) marked "planned, not yet implemented," linking
to its full spec — this is the "added to the summary of systems" piece.

### Build / verify command and status

```powershell
npm.cmd run typecheck   # clean
npm.cmd test             # 88/88 passing (was 77 before this session; +9 transformMath, +2 reparent)
npm.cmd run build        # succeeds, known pre-existing 852 kB chunk-size warning only
npm.cmd run test:e2e     # 1/1 passing
```

All four green as of this session, on top of the three feature commits below. No commands run
for Stage 1 (nothing built) or the new doc-only work (no code changed).

### Files touched this session

Code (Phase 2 was completed in a prior, now-summarized part of this session; hierarchy UI and
transform inheritance are this session's own commits):

- `316c3f8` — hierarchy UI slice 4: `src/editor/sceneTree.ts` (new), `sceneTree.test.ts` (new),
  `src/editor/editorOperations.ts`, `src/App.tsx`, `src/styles.css`,
  `docs/05-subsystems/authoring-engine.md`.
- `7cbb708` — transform inheritance slice 5: `packages/authoring-engine/src/transformMath.ts`
  (new), `transformMath.test.ts` (new), `packages/authoring-engine/src/index.ts`,
  `index.test.ts`, `src/App.tsx`, `src/viewport/interactionController.ts`,
  `src/viewport/syncArtefacts.ts`, `src/viewport/syncGizmo.ts`,
  `docs/05-subsystems/authoring-engine.md`.

Docs (uncommitted as of this handoff — see "Next recommended step"):

- `docs/07-research-and-history/2026-09-17--PLAN--frontend-business-logic-backlog.md` (new)
- `docs/07-research-and-history/2026-09-17--PLAN--asset-manager-vehicle.md` (new)
- `docs/07-research-and-history/2026-09-17--PLAN--when-do-dispatch-engine.md` (new)
- `docs/07-research-and-history/2026-09-17--PLAN--sync-engine-vehicle.md` (new)
- `docs/05-subsystems/asset-manager.md` (new stub)
- `docs/05-subsystems/when-do-dispatch-engine.md` (new stub)
- `docs/05-subsystems/sync-engine.md` (new stub)
- `docs/README.md` (subsystems row updated with the three new stub links)
- `SESSION.md` (this section)

### Failed approaches already tried

- None new this session beyond what's already recorded in the transform inheritance and
  hierarchy UI sections above (`ExitPlanMode` twice showed a stale prior plan's content in its
  tool result rather than the newly-approved plan — a recurring tooling artifact, not a real
  approval of the wrong plan; proceeded with the actually-approved plan both times).

### Open questions

- Should the backend track (Stage 1/2/3/5) get the same per-feature doc split treatment now,
  or only if/when backend work actually resumes? Left as shared-doc-only for now per "Per-step
  scope reference" in the backlog file.
- `docs/05-subsystems/*.md` stubs for unbuilt subsystems are a new pattern for this repo (prior
  convention: 05-subsystems only documents built systems, 07-research-and-history holds plans).
  If this pattern causes confusion (stub churn as specs change pre-implementation), reconsider
  and fold the stubs back into a single "planned subsystems" row in `docs/README.md` instead.

### Next recommended step

Commit the doc-only changes listed above (they are uncommitted), then start step 10 (WHEN→DO
engine) in its own session with Opus 5 + Plan Mode per
`2026-09-17--PLAN--when-do-dispatch-engine.md` — it's the architecturally riskiest remaining
frontend piece and the one item that just became unblocked. Steps 5 and 6 (Asset Manager, Sync
Engine) can run as parallel background sessions without waiting on step 10.

## 2026-09-18 Stage 5 — Production deploy infrastructure (Sonnet 5, direct)

### Objective / topic

Implement Stage 5 of `docs/07-research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md`
("Production deploy"): API and frontend Dockerfiles, a production Docker Compose stack fronted
by Caddy, a GitHub Actions deploy workflow, and a concrete VM provisioning README. Infrastructure
only, explicitly not wired to run against a real target yet.

### Decisions made and why

- The deploy workflow (`.github/workflows/deploy.yml`, at the **repo root**, not under
  `VThere Spatial Experience Builder/`, matching where `ci.yml` already lives) is
  `workflow_dispatch`-only with no `push` trigger, and requires a GitHub Environment named
  `production` with required reviewers. This is a deliberate gate, not an oversight: the open
  question "Which approved deployment provider will own the protected production environment?"
  (see Open questions below) is still unresolved, so nothing should be able to run automatically
  against a real VM. No secrets exist yet; the workflow will fail immediately if triggered until
  someone configures `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY`/`DEPLOY_PATH` on that
  environment.
- MinIO is intentionally **not** included in `docker-compose.prod.yml` (unlike the dev
  `docker-compose.yml`, which does run it). A single-container MinIO is a dev-only convenience;
  production should point `MINIO_ENDPOINT_URL` at a managed S3-compatible bucket. Documented this
  explicitly in `deploy/README.md` so a future agent doesn't "complete" the stack by adding MinIO
  back in.
- Postgres does run as a container in `docker-compose.prod.yml` for now (simplest path for a
  single small VM), with an explicit README note to swap it for managed Postgres if the VM needs
  to scale.
- Caddy was chosen as instructed by the plan (automatic TLS via Let's Encrypt, no manual cert
  management); it proxies `/api/*` to the API container and everything else to the frontend
  container (`deploy/Caddyfile`).
- The frontend Dockerfile lives at the **repo root** of the VThere app
  (`VThere Spatial Experience Builder/Dockerfile`), not under `apps/`, because the actual Vite
  project root is the top-level `src/`/`package.json`, not a separate `apps/editor` build target
  — `apps/editor` and `apps/runtime` have no `package.json` and are not real npm workspaces yet
  (only `packages/*` are). The build stage installs from `package.json` + `packages/*` first, then
  copies `apps/editor`/`apps/runtime` source in afterward, so an `npm ci` failure surfaces before
  wasting time copying app source.
- Found and fixed a **pre-existing, unrelated repo bug** while validating the frontend Docker
  build: `package-lock.json` was missing the `@vthere/interaction` entries from commit `8416364`
  (WHEN→DO engine package), so `npm ci` was already broken at the repo root on this branch —
  independent of anything in this session. Confirmed via `npm ci` on the host, which failed with
  the same `EUSAGE`/"Missing: @vthere/interaction@0.1.0" error before any Docker work touched it.
  Ran `npm install --package-lock-only`, which produced an 11-line lockfile diff (just the missing
  package entries, no dependency version changes) and fixed both the host `npm ci` and the Docker
  build. This means `build-and-test` CI on this branch was very likely broken before this session
  too — worth confirming once pushed.

### Current skeleton / plan state

Implemented and verified this session:

- `apps/api/Dockerfile` + `apps/api/.dockerignore` — Python 3.12-slim, installs
  `requirements.txt`, copies `app/`/`alembic/`/`alembic.ini`, healthcheck against `/health`,
  runs `uvicorn app.main:app`.
- `Dockerfile` (repo root of the VThere app) + `.dockerignore` — multi-stage: Node 22-slim build
  (`npm ci` against `package.json` + `packages/*`, then `npm run build`) → `nginx:1.27-alpine`
  serving `dist/` with `deploy/nginx.conf` (SPA fallback to `index.html`, plus a `/health` stub
  route).
- `docker-compose.prod.yml` — `caddy` (ports 80/443, reads `deploy/Caddyfile`), `frontend`,
  `api`, `postgres`, all on one default network; required env vars (`DOMAIN`,
  `POSTGRES_PASSWORD`, `MINIO_ENDPOINT_URL`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`) use
  Compose's `:?` required-variable syntax so `compose config` fails loudly if any are unset,
  rather than silently deploying with dev defaults.
- `deploy/Caddyfile` — `{$DOMAIN}` site block, `/api/*` → `api:8000`, everything else →
  `frontend:80`.
- `.github/workflows/deploy.yml` (repo root) — `workflow_dispatch` only, `environment: production`,
  SSH key setup, `rsync` the repo to the VM, remote `docker compose build && up -d`, then a
  `curl` health check over SSH. Heavily commented with exactly what repo/environment
  configuration is required before it can run at all.
- `deploy/README.md` — concrete VM provisioning steps for a fresh Ubuntu VM: Docker Engine +
  Compose plugin install, dedicated `deploy` user, SSH keypair generation and installation,
  clone location, firewall rules, DNS pointer, production `.env.prod` file contents, first manual
  `docker compose up -d --build` bring-up and health check, GitHub Environment/secrets setup
  steps, and a rollback procedure.

Not implemented (out of scope per this stage / explicitly deferred):

- No secrets configured anywhere (GitHub Environment does not exist yet in the actual repo
  settings — only documented as a prerequisite).
- No automatic deploy trigger on push to `main`/`Working` — intentional per the open question.
- No managed Postgres or S3 migration — documented as a future step in `deploy/README.md`, not
  implemented.

### Build / verify command and status

Run from `VThere Spatial Experience Builder/`:

```bash
docker build -t vthere-api -f apps/api/Dockerfile apps/api
docker build -t vthere-frontend -f Dockerfile .
DOMAIN=example.com POSTGRES_PASSWORD=x MINIO_ENDPOINT_URL=http://minio:9000 \
  MINIO_ROOT_USER=x MINIO_ROOT_PASSWORD=x \
  docker compose -f docker-compose.prod.yml config
```

**Status: all three pass**, verified this session (Docker Desktop 29.7.2 on Windows). Both
`docker build`s complete successfully (API installs all `requirements.txt` deps; frontend runs
`npm ci` + `tsc -b && vite build` inside the build stage, producing the same 867 kB/238 kB gzip
bundle as the existing local build, then copies `dist/` into an nginx image). `docker compose
config` validates cleanly with the required env vars supplied and fails loudly (as designed) if
any of `DOMAIN`/`POSTGRES_PASSWORD`/`MINIO_ENDPOINT_URL`/`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`
are missing. Test images were removed after verification (`docker rmi`).

The frontend/root-level typecheck/test/build/e2e suite (`npm run typecheck` / `test` / `build` /
`test:e2e`) was not re-run this session beyond what the Docker build stage itself exercises
(`tsc -b && vite build`, which passed inside the image). The lockfile fix
(`npm install --package-lock-only`) was verified by re-running `npm ci` on the host successfully
afterward.

### Files touched this session

- `apps/api/Dockerfile` (new)
- `apps/api/.dockerignore` (new)
- `Dockerfile` (new, VThere app root)
- `.dockerignore` (new, VThere app root)
- `docker-compose.prod.yml` (new)
- `deploy/Caddyfile` (new)
- `deploy/nginx.conf` (new)
- `deploy/README.md` (new)
- `.github/workflows/deploy.yml` (new — **at the repository root**, i.e.
  `Project5_DoReMi-yaki/.github/workflows/deploy.yml`, not inside
  `VThere Spatial Experience Builder/`)
- `package-lock.json` (modified — lockfile drift fix, see Decisions above)
- `SESSION.md` (this section)

All of the above are uncommitted as of this handoff.

### Failed approaches already tried

- First attempt at the frontend Dockerfile copied `apps/editor` and `apps/runtime` into the
  build context before running `npm ci`, on the assumption they were npm workspaces like
  `packages/*`. Rejected after checking: neither directory has a `package.json`, so they aren't
  workspace members; reordered the Dockerfile to `npm ci` right after `package.json` +
  `packages/*` are copied, then copy `apps/editor`/`apps/runtime` source afterward.
- First `docker build` of the frontend failed with `npm ci`'s `EUSAGE` /
  "Missing: @vthere/interaction@0.1.0 from lock file" — this was not a Dockerfile bug, it was the
  pre-existing lockfile drift described above. Confirmed by reproducing the identical failure with
  a plain host-side `npm ci` before touching Docker again.
- `npm ci` (full reinstall, not `--package-lock-only`) failed on the host with `EPERM` on
  `node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node` (Windows file lock, e.g.
  antivirus or another process holding the file). Worked around by using
  `npm install --package-lock-only` instead, which only rewrites the lockfile and doesn't touch
  `node_modules`; re-verified with a subsequent plain `npm ci` that this then succeeded, confirming
  the lockfile fix itself was correct and the `EPERM` was unrelated host-environment noise.

### Open questions

- Which approved deployment provider will own the protected production environment? (Carried over
  from earlier sessions, still unresolved — this is the gate on filling in `deploy.yml` secrets
  and creating the `production` GitHub Environment.)
- Should Postgres stay containerized in `docker-compose.prod.yml` long-term, or move to a managed
  instance before first real deploy? Left as a documented future step, not decided.
- Is a single VM (as `deploy/README.md` assumes) the target topology, or should this become
  multi-host/managed-container (e.g. ECS, Cloud Run) once the provider is chosen? The current
  Dockerfiles/compose file work either way, but `deploy.yml`'s rsync+SSH approach is VM-specific
  and would need to change for a managed-container target.
- Is the pre-existing `build-and-test` CI check currently green on this branch, given the lockfile
  was broken? Not verified this session (no push was made) — should be checked on next push.

### Next recommended step

Push this branch (including the lockfile fix) and confirm `build-and-test` CI is green — this
should be done regardless of deploy-provider decisions, since the lockfile bug likely predates
this session and may already be failing CI. Separately, once the deployment-provider open question
is resolved: provision a VM per `deploy/README.md`, create the `production` GitHub Environment
with the four required secrets, then trigger `deploy.yml` manually via `workflow_dispatch` and
verify the health check step passes before considering any automatic trigger.
