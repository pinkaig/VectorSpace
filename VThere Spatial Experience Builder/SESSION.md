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
