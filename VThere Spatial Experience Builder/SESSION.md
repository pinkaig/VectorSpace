# VThere Spatial Experience Builder - Session Handoff

## Objective / topic

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

## Next recommended step

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

## 2026-09-21 Attachment model and audio/image/text/video system designs (docs only)

### Objective / topic

Plan the Audio System for the Spatial Experience Builder and the shared attachment model it depends on. Audit which
attachment types (image, text, video, audio, 3D) the Asset Manager can load and with what libraries. Design audio
(master volume, per-audio meta, simultaneous channels, spatial and 360 audio, scrubbing, captions, transport, a
queryable state store, lazy loading and memory management), then design the image, text and video systems and how
attachments bind to scene objects, project data, asset kinds and resolvers. Deliverable: design documents first,
then a full implementation (implementation not started).

### Decisions made and why

- **Docs first, then full implementation** (user choice). The docs are proposals; no code exists for any of it.
- **Per-audio meta lives on the project** as `ProjectData.audioAssets`, not in sidecar files, so it saves, syncs and undoes with the project JSON.
- **Spatial and 360 audio use raw Web Audio inside `packages/audio`** (`PannerNode`, first-order ambisonic decode). No Three.js import, because `tech-stack.md` L155-158 forbids it. Positions come in as `[x,y,z]` tuples.
- **`AssetKind` stays the placeable-primitive set.** A new `MediaKind = 'audio'|'image'|'video'|'text'` and `AssetRefKind = AssetKind | MediaKind` avoid breaking `restingHeight`, `ASSET_COLORS`, `createGeometry`, `ReferenceViewport.tsx:124` and the serializer allowlist.
- **Audio is behind an `AudioBackend` interface** (`WebAudioBackend`, `FakeAudioBackend`) because jsdom has no `AudioContext`; the same pattern for image, text and video.
- **Attachments live on the host** (proposed, unconfirmed): `SceneObject.attachments[]` and `ZoneDefinition.attachments[]`. An attachment carries no trigger; rules start it (`playAudio { attachmentId }`). Reason: the viewport receives only the active scene's objects and zones, and a host-bound list cannot orphan on delete or duplicate. Rejected: project-level table (orphan problem), rule-only (no emitter position, nothing in the inspector), media as objects (ripples through `AssetKind`).
- **Shared code:** `DecodedCache` and `MediaBudget` in `packages/assets`; captions start in `packages/audio` and are extracted to `packages/captions` when video is the second consumer.
- **Video soundtrack goes through the audio system** (`AudioSystem.attachMediaElement`, a `video` channel), so master mute and ducking apply. Needs CORS on media. Unconfirmed.
- **Tiers:** T1 built in the main implementation, T2 after if time allows, T3 roadmap only.
- Libraries: browser-native APIs by default. Third-party names in `attachment-integration.md` section 7 are marked **verify** (from general knowledge, not checked).

### Current skeleton / plan state

Design docs written (in `docs/code/subsystems/`), all marked "Design specification (2026-09-21)":

- `attachment-integration.md` (shared model: architecture placement, project data, scene-object binding, asset kinds, resolver chain, libraries, shared runtime pieces)
- `attachment-types-and-asset-manager.md` (status map of every attachment type)
- `audio-system.md` (23 functionality sections, tiers, data model, class design, actions, integration points, build sequence)
- `image-system.md`, `text-system.md`, `video-system.md`

Approved: nothing. Pending: user review of all six docs and the open questions at the end of each. Implemented: none. Per
`Agent Skills/CLAUDE.md`, no implementation code before the skeleton is approved; these docs are the skeleton proposal.
The `packages/audio`, `image`, `text` and `video` packages also await the architecture decision required by
`repository.md` L67-69.

### Build / verify command and status

No code changed, so no build or test was run for this work. The last recorded frontend verification (2026-09-17 section
above, 36 tests) is not re-established by this session. From `VThere Spatial Experience Builder/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Run `npm install` when a new workspace package is added and commit `package-lock.json` (missed once, commit `afc27cf`).
`tsconfig.app.json` includes only `src`, so a new package is type-checked only once `src/` imports it.

### Files touched this session

New:
- `docs/code/subsystems/attachment-integration.md`
- `docs/code/subsystems/attachment-types-and-asset-manager.md`
- `docs/code/subsystems/audio-system.md`
- `docs/code/subsystems/image-system.md`
- `docs/code/subsystems/text-system.md`
- `docs/code/subsystems/video-system.md`

Edited:
- `docs/README.md` (rows for the new docs)
- `docs/code/subsystems/asset-manager.md` ("See also" line)
- `SESSION.md`

Nothing is committed; branch `sherman-branch`. The plan file `C:\Users\pc\.claude\plans\prompt-to-continue-the-woolly-adleman.md` is outside the repo and superseded by the docs.

### Failed approaches already tried

- `ExitPlanMode` was rejected twice. The user wanted the markdown written into the repo as two separate documents, with audio features fleshed out, not a plan for approval. Write the docs directly.
- An `Edit` failed because the target sentence was wrapped across two lines; grep for the exact wrapped text first.
- Line-number citations to `Viewport.tsx` in the first docs were stale (cited L219 and L226-237). Current: `createActionRegistry()` L278, `emitRuntimeEvent` L287, `zoneTracker.tick` L447, `stopRun(false)` L503. Re-check citations against the file before relying on them.
- Doc-relative code links follow the house style (`../../packages/...`), which does not resolve from `docs/code/subsystems/`. Pre-existing; not fixed.

### Open questions

- Attachments on the host, or a project table? Decides `duplicateObject`, the serializer and the inspector.
- Add the `panel` primitive (touches seven places, two renderers)? Should `ReferenceViewport.tsx` show media surfaces?
- `visible` and `enabled` semantics for attachments.
- Shared media budget ceiling; default audio budget (64 MB is a placeholder); image working size (2048) and video slot limits.
- Caption source of truth (inline cues or caption assets); `showPanel` argument (`attachmentId` vs `componentId`); trigger names `audioStarted`, `audioEnded`, `audioMarker:<name>`.
- Route video soundtrack through the audio system?
- No real media storage exists (Stage 3 routes return 501, project JSON capped at 2 MB): first builds use a bundled `public/` catalog or session-only object URLs. Confirm that is acceptable.

### Known existing bug (not caused by this design)

`removeObject` (`packages/authoring-engine/src/index.ts`, around L213-227) removes the subtree but not `project.rules`
that reference it. `validateRules` (`src/serializer.ts`, around L131-151) then rejects the saved project on reload, and
the loader silently falls back to the backup or a clean project. No rule-authoring UI exists yet, so it has not surfaced.
Fix before rule authoring ships.

### Next recommended step

1. User reviews the six docs and answers the open questions above. Record each decision as a dated "Decision" line in the doc it belongs to.
2. Fix the `removeObject` orphan-rule bug with tests (drop rules referencing the removed subtree; check zones and scene removal too; confirm a `serializeProject` then `deserializeProject` round trip).
3. Sync `architecture.md`, `repository.md`, `development-guide.md` and `contracts.md` for built code only; mark the new designs as proposals there.
4. On approval, implement in this order: types and serializer, authoring operations (`duplicateObject`, `createScene`), `packages/assets` work (kind specs, content guard, in-flight de-duplication, `DecodedCache`), then `packages/audio` with `FakeAudioBackend` and tests first, then `WebAudioBackend` and wiring, then image, text, video.
5. Commit in logical steps. `GIT_AND_HANDOFF_CONVENTIONS.md` asks for an `[agent]` subject prefix and no `Co-authored-by` trailer unless the team agreed. The session attribution setting says to add one; resolve that before the first commit.

## 2026-09-27 Text system: prev/curr/next navigation, modal-input boundary, build-handoff prompt (docs only)

### Objective / topic

Continue `text-system.md` (docs-only, per the 2026-09-21 design-docs entry above) to close two open design questions
— sequence navigation direction and who owns modal-input decisions — then produce a handoff prompt so a teammate
(Wei An) can pick up implementation with a comprehension step built in, not just a spec to translate into code.

### Decisions made and why

- **Sequences navigate both ways (prev/curr/next), not forward-only.** A dialogue queue or paged panel tracks a
  plain `index`/`length` pair over an array that is already fully resolved in memory (text is capped at 64 KB/asset,
  512 KB/project — see the 2026-09-27 project-data-only decision already in `text-system.md`). Explicitly rejected:
  buffering or pre-loading upcoming panels, raised and self-scoped down as over-engineering for content this small.
  `advance(sel, dir?: 'next' | 'prev')` defaults to `'next'`; both directions no-op at the sequence ends rather than
  closing the panel or erroring.
- **The modal-input boundary is one read-only boolean, not a text-system decision.** `packages/text` exposes only
  `TextStateStore.getSnapshot().modalOpen`; every decision about what that means for input — which keys/pointer
  events get swallowed, whether the runtime clock pauses, walk-mode pointer-lock interaction — belongs to
  `src/viewport/interactionController.ts`. The dependency points one way (store → controller, read not pushed), the
  same shape as the existing event bridge but inverted. This closes what was previously an open "settle when wiring"
  note.
- **Fixed a stale doc inconsistency** (self-identified, not user-flagged): section 10 still described a
  `DecodedCache`/file-fetch path left over from before the 2026-09-21 "text is project data only" decision was fully
  swept through the doc. Corrected to synchronous parse-on-open, no cache.
- **A build-handoff prompt, not a plain instruction dump, for the next implementer.** Wrote
  `text-system-build-prompt.md` telling whoever builds `packages/text` to run the (already-existing, uncommitted
  until this session) `codebase-comprehension` skill (`Agent Skills/agents/codebase-comprehension.skill`) against
  `text-system.md` and the real `packages/audio`/`packages/assets` code first, producing a dependency diagram and a
  tour-walkthrough for their own understanding before writing code — rather than translating the spec
  section-by-section.
- **When-Do integration is called out as a checkable gate, not an implied step.** The commit message for this
  session's work says it directly: "abit apprehensive on the when-do interaction integration as we have to check the
  asset manager and systems itself is working." The build prompt was extended with a dedicated section requiring
  verification that `registerTextActions` is actually called from `Viewport.tsx` (not just built), that all three
  actions (`showPanel`/`hidePanel`/`advancePanel`, including both `advancePanel` directions and `wait: true`) have
  working executors, that panel-close disposers are wired to scene reset, and that `panelOpened`/`panelClosed`
  actually reach `emitRuntimeEvent` — because `packages/audio` documents hitting this exact gap once already
  (`Viewport.tsx:278` creating the registry and registering nothing), and unit tests on `packages/text` in isolation
  won't catch a missing registration call.
- **Where the text asset itself lives is flagged, not fully re-settled, in the commit message**: "the text asset
  would live inside the serialised project data in the asset section, probably, unless we open up url to be used for
  bigger text document." This matches `text-system.md` section 1's existing decision (project-data-only, no
  file-backed kind) but the phrasing ("probably", "unless") signals the author still sees the document-dock
  large-text case (section 1's "What was deferred, not solved", Open questions item 6) as a live possibility worth
  re-litigating later, not fully closed. Treat item 6 as still open in spirit even though the doc calls it shelved.

### Current skeleton / plan state

- `docs/code/subsystems/text-system.md`: updated with the §7 "Navigation: prev/curr/next" subsection, matching
  `TextSystem`/`PanelHandle`/action-vocabulary signature updates, the "Modal input boundary" rewrite in
  "Considerations and limits" and the integration-points table, the §10 stale-cache fix, and two new dated Open
  Questions decisions. Status remains **design specification, nothing implemented**.
- `docs/code/subsystems/text-system-build-prompt.md` (new): a handoff prompt for the teammate implementing
  `packages/text`, built around running the codebase-comprehension skill first, then an explicit When-Do
  integration verification checklist, then the existing build sequence in `text-system.md`.
- `Agent Skills/agents/codebase-comprehension.skill` (new, committed this session): a packaged skill for generating
  a dependency/data-flow diagram plus a tour-style walkthrough when onboarding someone onto a codebase/system. Its
  own instructions include a hard rule never to commit on the user's behalf.

### Build / verify command and status

Docs-only session; no code changed, so no build or test was run. Working tree is clean on `sherman-branch` — this
session's changes are already committed (see below), unlike some earlier sessions in this file where changes were
left uncommitted at handoff time.

### Files touched this session

Already committed in `3fc195d` ("Building out the prompt for text system, passing to wei an"), on top of `02e65fd`
and `eba1c58`:

- `docs/code/subsystems/text-system.md` (edited)
- `docs/code/subsystems/text-system-build-prompt.md` (new)
- `Agent Skills/agents/codebase-comprehension.skill` (new)
- `SESSION.md` (this entry)

### Failed approaches already tried

- None this session — both rounds of user instructions (prev/curr/next navigation design, then the When-Do
  integration check) were forward-moving requests, not corrections of prior work.

### Open questions

- Carried over, unresolved, from `text-system.md`'s own Open Questions section (untouched this session): panel stack
  cap (how many simultaneously open panels), link confirmation default, where dialogue lives long-term, font package
  ownership, `ReferenceViewport.tsx` text-surface parity, and the shelved document-dock idea (item 6 — see the
  commit-message caveat above; treat as softer-closed than the doc text implies).
- Whether the codebase-comprehension skill's generated diagram/walkthrough should be saved anywhere durable (a
  scratch file per the build prompt's own instruction) or is genuinely throwaway once the implementer has internalised
  it — not yet decided, low stakes either way.
- Whether `text-system-build-prompt.md` itself should get folded back into `text-system.md` once `packages/text` is
  actually implemented (build sequence step 8, "docs sync," mentions marking the design doc as implemented, but
  doesn't mention what happens to this companion prompt file).

### Next recommended step

Wei An (or whoever picks up `packages/text`) reads `text-system-build-prompt.md`, runs the codebase-comprehension
skill against `text-system.md` per that prompt, then works through the When-Do integration verification checklist
and the existing "Build sequence" in `text-system.md` in order. Before implementation starts, confirm with the user
whether the document-dock/large-text question (Open questions item 6) needs a firmer decision now given the
commit-message caveat, or whether "shelved" stands as written.

## Handoff precedence note

The `2026-09-27 Text system: prev/curr/next navigation, modal-input boundary, build-handoff prompt` section above is
the latest status for the text-system design specifically; it extends, and does not contradict, the
`2026-09-21 Attachment model and audio/image/text/video system designs` section below it.

The `2026-09-21 Attachment model and audio/image/text/video system designs` section above is the latest status for the
attachment and audio design work; it is docs-only and supersedes nothing about the rendering or lifecycle sections.

The `Rendering factorisation and separation handoff` section above is the
latest status for the rendering work. It supersedes earlier Wk3 notes that
describe `Viewport.tsx`, `App.tsx`, and the authoring-engine boundary as still
fully inline or unimplemented. Those earlier statements remain as historical
context; use the current source tree and the latest rendering section when
continuing work.
