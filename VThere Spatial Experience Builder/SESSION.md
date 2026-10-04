# VThere Spatial Experience Builder - Session Handoff

> **Historical record.** Paths quoted below were correct when each entry was
> written. Reference documentation has since moved to the
> [project wiki](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki),
> and `docs/code/**` and `docs/archive/**` were removed from the repository, so
> `docs/` paths in older entries no longer resolve. They are left as written
> rather than rewritten, because this file is a log of what happened.

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
- Implemented AI declaration: `AI-DECLARATION.md`; verification is deliberately marked ongoing and must be updated only with completed checks.
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
- `AI-DECLARATION.md`
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

## 2026-09-28 Text system T1 (text-system.md build steps 3-5)

### Objective / topic

Implement `packages/text` from `docs/code/subsystems/text-system.md` per the
build prompt (`text-system-build-prompt.md`): core package (step 3),
`TextPanelHost` overlay (step 4), and runtime wiring (step 5) with the docs
synced in the same pass. Commits `58e339e`, `d1e9d70`, `ea608cc`.

### What exists now

- `packages/text` core: `RichTextParser` (markdown-lite/plain → bounded
  `TextNode` tree; raw HTML stays literal; caps truncate, never throw),
  `UrlPolicy` (https/mailto only), `TextLibrary` (sync project-data lookup),
  `TextLayout` + `FakeTextMeasurer` (CJK-aware wrap, grapheme force-break,
  heading-widow paging), `PanelManager` (modal-top stack, cap 3 non-modal,
  refocus not duplicate, injected-clock auto-close, prev/next index),
  `TextStateStore` (snapshot/subscribe, `modalOpen`, typed events),
  `TextSystem` facade (sync open; missing asset → error panel + `panelError`).
- `src/TextPanelHost.tsx`: the only place `TextNode` becomes elements;
  role=dialog, focus in/return, Escape consumed by the focused panel, lang on
  container, links `_blank noopener noreferrer`, "Content unavailable" error
  body, empty text renders no panel. Styles in `styles.css`.
- Wiring: `registerTextActions` (showPanel/hidePanel/advancePanel;
  `componentId` alias; hostless `assetId` form; disposers via
  `context.effects.add`) and `createTextEventBridge`
  (panelOpened/panelClosed → `emitRuntimeEvent`, re-entrancy guard), both
  registered in `Viewport.tsx` beside audio. `textAssets` prop flows from
  `RuntimeView`/`App` to the `TextLibrary` and `InlineTextResolver`.
  `interactionController` reads the one-way `modalOpen` boolean and pauses
  picking, look, drags, runtime key triggers and walk movement behind a modal.

### Known gaps / next steps

- `showPanel wait: true` is accepted but warns: the `ActionSequencer` has no
  wait-for-close primitive yet. Design it before building (new sequencer
  yield kind), do not bolt it into the executor.
- Build step 6 (demo scene + deliberately hostile text file) and the design
  doc's manual browser checks (focus trap, screen reader, hostile render) are
  not done — they need a browser session.
- All T2 rows (surface, dialogue queue, paging UI, localisation, DOM mirror,
  link confirmation, fonts) remain unbuilt by design.
- Docs synced: `contracts.md` (showPanel decision resolved+implemented),
  `when-do-dispatch-engine.md` (real executors noted), `text-system.md`
  (status = steps 2-5 built).

### Build / verify command and status

`npm run typecheck && npm test && npm run build` — all passing at each of the
three commits; final state 329 tests across 44 files. `packages/text` is now
inside the app tsc program (src imports it), so plain typecheck covers it.

## 2026-09-28 Shared attachment work slice (attachment-integration steps 2-5)

### Objective / topic

Build the shared attachment layer every media type system depends on, per
`docs/code/subsystems/attachment-integration.md`, as the prerequisite for
`packages/text` (its build-sequence step 2). Four commits on `weian_branch`:
`aa2cac6` (types + serializer), `c15bedc` (authoring ops), `7ef921d` (assets
machinery), `886eca8` (app wiring).

### Decisions made and why

- Scoped to `audio` + `text` attachment kinds: image/video shapes need their
  design docs' presentation types, and widening the union later is additive.
- Deferred to first consumers: `DecodedCache`/`MediaBudget` (image),
  `ObjectUrlResolver` (media import UI), migrating audio off its bespoke
  `audioResolver` seam.
- One host-addressed op set (`host: { kind: 'object' | 'zone', id }`) instead
  of four functions per host type.
- `ObjectIdFactory` gained a required `nextAttachmentId` (type-enforced, all
  factory sites updated) — attachment ids share one project-wide id space.
- Host `attachments` stay undefined when absent (files stay small);
  `textAssets` backfills to `[]` matching `audioAssets`.
- `setProjectTextAssets` invalidates cached text descriptors so edited text
  is never served stale through the descriptor cache.

### What exists now

- `packages/project`: `MediaKind`, `AssetRefKind`, `Attachment` (audio/text),
  `TextAssetMeta`/`TextPresentation`/`TextStyle`, `attachments?` on both host
  types, `textAssets?` on ProjectData, pure `findAttachment`/
  `collectAttachments`/`assetRefForAttachment`.
- `src/serializer.ts`: 16/host + 5,000 total attachment caps, project-wide
  attachment id uniqueness, hex-only colours, 64 KB/asset + 512 KB/project
  UTF-8 text caps (variants counted), control chars stripped, unknown
  assetIds accepted as runtime placeholders.
- `packages/authoring-engine`: `addAttachment`/`removeAttachment`/
  `updateAttachment`/`reorderAttachments`; `duplicateObject` re-ids copied
  attachments, `createScene` deep-copies them.
- `packages/assets`: `MEDIA_KIND_SPECS`, `KindRouterResolver`,
  `ContentGuardResolver`, `InlineTextResolver`, in-flight de-duplication in
  `CachingAssetResolver`, optional sizeBytes/width/height/durationMs.
- `src/viewport/assetResolution.ts`: chain is now
  `Placeholder(Caching(ContentGuard(KindRouter(...))))`; prefixed per-id
  store (`object:<id>` / `attachment:<id>`); `resolveAttachment`,
  `getAttachmentDescriptor`, `subscribeAttachmentResolution`,
  `retryAttachment`, `setProjectTextAssets`.

### Build / verify command and status

`npm run typecheck && npm test && npm run build` from
`VThere Spatial Experience Builder/` — all passing at each commit; final
state 288 tests across 38 files (was 251/34 before the slice; the jump from
251 to 262 at commit aa2cac6 includes 3 audio test files unblocked by
relinking workspaces). `npm install` was required once to link the
assets/audio/interaction/sync workspaces (lockfile unchanged).

### Open questions / next steps

- Nothing calls `setProjectTextAssets` yet: the text-system build step 5
  ("project-level textAssets prop", `Viewport.tsx` wiring) is the intended
  caller. `resolveAttachment` likewise has no consumer until a type system
  or inspector uses it — both are deliberate seams, not dead ends.
- Next smallest slice: `packages/text` core (build step 3 — parser,
  UrlPolicy, TextLibrary, TextLayout + FakeTextMeasurer, PanelManager,
  TextStateStore), which now has every dependency it needs.
- Image/video attachment shapes, editor attachment UI, and the client/backend
  allowlist parity fixture remain future slices.

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
