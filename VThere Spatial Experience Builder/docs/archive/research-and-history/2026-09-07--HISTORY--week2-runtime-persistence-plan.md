# Week 2 Monday: Runtime and Persistence Slice

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

Date: 2026-09-07

## Phase identification

Requested phase: runtime preview, persistence clarity, verified JSON import, and asset-management foundations.

### Purpose

Make the current editor understandable as a complete local authoring loop:

```text
Edit project -> save/load local draft -> run simulation -> return to editor
```

This is a focused vertical slice of the documented runtime and persistence architecture. It does not claim to implement publishing, server persistence, or the final `apps/editor` and `apps/runtime` boundaries.

### Prerequisites and dependencies

- Existing root Vite/React editor.
- Existing versioned `ProjectData` model.
- Existing `localStorage` draft and backup serializer.
- Existing Three.js viewport.
- Browser file-picker APIs for importing user-selected JSON.

### Systems involved

- Editor UI and project state.
- Local persistence adapter.
- Read-only runtime simulation view.
- Shared project data and Three.js presentation.
- Import validation and bounded asset catalog search.

### Allowed files to change

- `src/App.tsx`
- `src/serializer.ts`
- `src/assets.ts`
- `src/Viewport.tsx`
- `src/RuntimeView.tsx`
- `src/styles.css`
- `2026-09-07--HISTORY--week2-runtime-persistence-plan.md`

No new backend, authentication, storage provider, or package boundary is introduced in this slice.

## Skeleton

### `src/App.tsx`

- Add an `editor | runtime` view state.
- Add explicit `Save project`, `Load draft`, `Export JSON`, and `Run simulation` actions.
- Display the persistence location and latest load/save status.
- Keep editing commands and local autosave in the existing editor path.
- Open a browser file picker for JSON import and report rejected files without changing the current project.
- Filter the approved asset catalog by search text.

### `src/serializer.ts`

- Validate imported project structure before it can replace editor state.
- Reject malformed JSON, unsupported schema versions, wrong file types, oversized files, duplicate IDs, invalid transforms, and excessive project sizes.
- Keep the existing draft/backup recovery path separate from user-selected file import.

### `src/assets.ts`

- Own approved asset catalog metadata.
- Provide a searchable/filterable catalog API for the editor.

### `src/RuntimeView.tsx`

- Render the active scene using the existing viewport presentation.
- Provide a visitor-style header and an exit-simulation action.
- Do not expose selection, inspector, scene tree, asset library, undo, or save controls.

### `src/Viewport.tsx`

- Add an `interactive` option.
- Preserve the current editor pointer selection and floor dragging when interactive.
- Render the same objects without pointer editing when not interactive.

### `src/styles.css`

- Add runtime header and simulation status styles.
- Add persistence location/status styles.

## Data movement

```text
Editor input
  -> ProjectData state
  -> serializer.saveProject()
  -> browser localStorage primary + backup

ProjectData state
  -> RuntimeView
  -> Viewport(interactive=false)
  -> read-only simulation

JSON file selected in browser
  -> size/type/extension checks
  -> JSON parse and project validation
  -> replace project state only after all checks pass
  -> pending autosave to browser localStorage
```

## Today's checklist

- [x] State where drafts are saved and loaded.
- [x] Add an explicit local draft load action.
- [x] Keep save, autosave, backup, and JSON export visible.
- [x] Add a run-simulation action.
- [x] Render the current project in a read-only visitor-style view.
- [x] Allow returning to the editor without changing the project.
- [x] Import a project through a browser file picker.
- [x] Reject malformed or unsafe project data without overwriting the current project.
- [x] Add bounded scene/object limits for import stability.
- [x] Make the approved asset catalog searchable.
- [ ] Verify the golden path in a browser after Node.js/npm is available.

## Preplan

### Next slice: runtime interaction proof

1. Add a shared interaction definition for one supported trigger and action.
2. Add a runtime event path that consumes the same project data as the editor.
3. Add one visitor-facing interaction test and one editor-preview parity fixture.
4. Keep the runtime view free of editor controls.

### Asset management slice

1. Add asset metadata IDs, categories, thumbnails, and source references.
2. Add asset availability and missing-asset warnings to project validation.
3. Add project-level asset usage inspection and unused-asset cleanup suggestions.
4. Keep arbitrary model upload out of scope until asset storage and conversion contracts exist.

### Later slice: persistence and publishing

1. Move project persistence behind an API client adapter.
2. Add authenticated project/version endpoints in the existing FastAPI boundary.
3. Add immutable published snapshots and a runtime project loader.
4. Add analytics events at runtime boundaries.
5. Move the temporary root editor and simulation into the documented app boundaries only after the shared contracts exist.

### Decisions to preserve

- Local storage is a browser draft mechanism, not durable multi-user persistence.
- Simulation reads the current in-memory project; it is not a published URL.
- The project model remains the single source of scene/object data.
- Backend hosting and remote storage remain deferred until the API and publication contracts are approved.
- Import validation rejects bad data; it does not guess how to repair corrupted JSON.
- A future recovery tool may offer a preview or salvage report, but it must never silently rewrite a project.

## Acceptance criteria

- The interface states that drafts are stored in this browser using localStorage.
- Save and autosave continue to write the primary draft and backup.
- Load draft replaces the current project with the stored draft and reports the result.
- Export JSON remains available as a user-controlled fallback.
- Import JSON opens a browser file picker and verifies the file before loading it.
- Rejected imports preserve the current project and explain the rejection reason.
- Asset search filters the approved asset catalog without changing project data.
- Run simulation displays the current project without editor controls or editing pointer behavior.
- Exit simulation returns to the editor without changing the project.
- The application builds and existing tests pass.

## Deferred work

- Separate `apps/runtime` application boundary.
- Published URLs and immutable published versions.
- API/database/object-storage persistence.
- Runtime interaction engine, media components, navigation, and analytics.
- Preview/published parity tests.
- Authentication and teacher/admin contexts.
- Automatic corrupted-file repair or arbitrary asset upload.

## Verification commands

```powershell
npm.cmd run build
npm.cmd test
```

For the UI acceptance check, start the development server with `npm.cmd run dev`, then verify save, load, export, run simulation, and exit simulation in the browser.

## Evidence log

- Skeleton created before implementation.
- Architecture additions intentionally deferred because this slice remains local and uses the existing project model and serializer.
- Import validation includes size, type, schema, structure, identity, transform, duplicate-ID, and resource-limit checks.
- Asset management begins as a searchable approved catalog; storage, conversion, thumbnails, and upload remain a later contract.
