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
