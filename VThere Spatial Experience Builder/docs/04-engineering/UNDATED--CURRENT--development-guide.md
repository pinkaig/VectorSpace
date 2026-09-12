# VThere Development Guide

This is the practical map for navigating the VThere Spatial Experience Builder and starting business-logic work without breaking persistence, editing history, or editor/runtime parity.

## Current reality

The architecture is documented, but it is not completely implemented or linked yet.

Implemented and currently usable:

- The root Vite/React editor in [`src/`](../src/).
- The canonical project model in [`packages/project/src/index.ts`](../packages/project/src/index.ts).
- Local serialization, autosave, backup recovery, and JSON export in [`src/serializer.ts`](../src/serializer.ts).
- The standalone command timeline in [`packages/authoring-engine/src/index.ts`](../packages/authoring-engine/src/index.ts).
- The API health route in [`apps/api/app/main.py`](../apps/api/app/main.py).
- Focused frontend and API tests.

Still planned or incomplete:

- The editor has not moved into the documented [`apps/editor/`](../apps/editor/) boundary.
- The runtime boundary exists only as a placeholder in [`apps/runtime/`](../apps/runtime/).
- Shared packages for spatial math, commands, serialization, validation, interaction, and assets are not all implemented.
- API project persistence, authentication, publishing, database migrations, and object storage are not implemented.
- Browser end-to-end tests, runtime parity tests, and full integration tests are not complete.

Therefore, it is not safe to assume that the full project structure, architecture, or module linking is finished. Treat the architecture documents as the target contract and the actual source tree as the current implementation state.

## Start the project

From the VThere directory:

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd install
npm.cmd run dev
```

Before starting, run the environment check if you are setting up a new machine:

```powershell
.\scripts\check-environment.ps1
```

The check reports missing Node.js, npm, or dependencies and exits with a non-zero code so setup problems are visible in scripts and CI. On macOS/Linux use `bash scripts/check-environment.sh`. Once Node.js is available, `npm.cmd run dev` automatically runs the Node-based preflight check before Vite starts.

Open the Vite URL, normally `http://localhost:5173`.

Run the API separately when working on API code:

```powershell
cd "VThere Spatial Experience Builder"
python -m uvicorn apps.api.app.main:app --reload --port 8000
```

The API health check is `http://localhost:8000/health`.

PowerShell may block `npm.ps1`; use `npm.cmd` as shown above.

## Where to edit

| Goal | Start here | Then inspect |
|---|---|---|
| Add or change project data | [`packages/project/src/index.ts`](../packages/project/src/index.ts) | [`src/model.ts`](../src/model.ts), [`src/serializer.ts`](../src/serializer.ts) |
| Add an editor action | [`src/App.tsx`](../src/App.tsx) | [`packages/authoring-engine/src/index.ts`](../packages/authoring-engine/src/index.ts) |
| Change viewport behavior | [`src/Viewport.tsx`](../src/Viewport.tsx) | [`architecture`](../02-architecture/UNDATED--FOUNDATION--architecture.md) |
| Change save, recovery, or export | [`src/serializer.ts`](../src/serializer.ts) | [`contracts`](../02-architecture/UNDATED--FOUNDATION--contracts.md), [`implementation plan`](../03-delivery/UNDATED--FOUNDATION--implementation-plan.md) |
| Add undo/redo behavior | [`packages/authoring-engine/src/index.ts`](../packages/authoring-engine/src/index.ts) | [`packages/authoring-engine/src/index.test.ts`](../packages/authoring-engine/src/index.test.ts) |
| Add API behavior | [`apps/api/app/main.py`](../apps/api/app/main.py) | [`apps/api/tests/test_health.py`](../apps/api/tests/test_health.py), [`contracts`](../02-architecture/UNDATED--FOUNDATION--contracts.md) |
| Change visual layout | [`src/styles.css`](../src/styles.css) | [`src/App.tsx`](../src/App.tsx) |
| Add diagnostic logging | [`packages/debugging/src/index.ts`](../packages/debugging/src/index.ts) | [`debugging`](UNDATED--CURRENT--debugging.md) |
| Understand intended ownership | [`architecture`](../02-architecture/UNDATED--FOUNDATION--architecture.md) | [`repository boundaries`](../02-architecture/UNDATED--FOUNDATION--repository.md) |
| Check phase order | [`implementation plan`](../03-delivery/UNDATED--FOUNDATION--implementation-plan.md) | [`pre-baseline validation`](../03-delivery/UNDATED--CURRENT--pre-baseline-validation.md) |

## Business-logic implementation order

Implement domain behavior in this order. Keep React and Three.js at the edges.

### 1. Define the canonical data

Add types and defaults in [`packages/project/src/index.ts`](../packages/project/src/index.ts). Preserve stable IDs, ordering, transforms, scene relationships, and `schemaVersion`.

Do not create a second project model in the editor, runtime, or API. UI state such as selection, open panels, and camera position is not project data.

### 2. Add pure logic and tests

Create a focused package under `packages/` for the behavior. Prefer pure functions and framework-free TypeScript. Add a neighboring `.test.ts` file before connecting the logic to React.

Examples:

- Validation: reject missing scene references and invalid transforms.
- Spatial: calculate ray, plane, axis, and transform constraints.
- Interaction: match a trigger to ordered actions deterministically.
- Serialization: validate, serialize, deserialize, and migrate project documents.

The package must not import React, Three.js UI adapters, FastAPI, browser storage, or database code unless the architecture explicitly assigns that dependency.

### 3. Route changes through commands

Every user-visible edit must be one command or compound command. A drag operation must create one history entry when the drag is committed, not one entry per pointer event.

The command should:

1. Receive a project snapshot or immutable project input.
2. Return the next project state.
3. Preserve IDs and unrelated data.
4. Have an inverse or an equivalent previous snapshot for undo.
5. Clear the redo branch after a new edit.

The current prototype uses snapshot history in [`src/App.tsx`](../src/App.tsx). The long-term owner is [`packages/authoring-engine/`](../packages/authoring-engine/), as specified in [`authoring-engine.md`](../05-subsystems/authoring-engine.md).

### 4. Connect persistence through one adapter

Autosave and explicit save must use the same persistence path. Keep these states truthful:

- `saving`: a write is in progress.
- `saved`: the primary write completed.
- `recovered`: a fallback source was loaded.
- `failed`: no reliable primary or backup write completed.

Recovery order is current draft, backup, server revision, then a clean project. Export JSON remains the emergency fallback. Never silently overwrite a newer server revision.

The current local implementation is in [`src/serializer.ts`](../src/serializer.ts). When server persistence is added, preserve the same contract rather than letting API calls spread through UI components.

### 5. Connect the UI last

The UI should collect input, call a command or domain service, render the result, and display persistence status. It should not directly mutate arbitrary project objects or contain validation rules that the runtime cannot share.

For the editor, the intended flow is:

```text
pointer/form input -> authoring engine or command -> project state
project state -> serializer/persistence adapter -> draft or server revision
project state -> viewport renderer
```

## Editing safety checklist

Before changing a shared model or public contract:

- Read [`project context`](../01-product/UNDATED--CURRENT--project-context.md).
- Check the ownership table in [`architecture`](../02-architecture/UNDATED--FOUNDATION--architecture.md).
- Search for all references to the type or function being changed.
- Add or update a focused test first when the behavior is persistence, history, serialization, validation, or interaction related.
- Run the build and the narrowest relevant test.
- Update the contract or implementation plan if the change alters a boundary.

Do not silently move fixed directories, add a new top-level subsystem, change the project schema without a migration decision, or make the runtime depend on editor-only state.

## Verification commands

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd run build
npm.cmd test
python -m pytest apps/api/tests
```

The current focused tests cover the authoring-engine timeline and API health route. Broader persistence, browser, integration, runtime parity, and performance tests are still required.

## Architecture readiness

Current answer: **partially ready, not complete**.

- The intended architecture and ownership boundaries are documented.
- The project builds and focused tests pass locally.
- The current editor still runs from the temporary root `src/` surface.
- Several documented packages and the runtime/API persistence layers remain unimplemented.
- Human approval is still required for unresolved product decisions before expanding the baseline.

The next structurally important work is to add serialization/validation tests, then move the editor into `apps/editor/` without creating a duplicate domain model. After that, implement the standalone authoring-engine transform sessions and persistence checkpoint adapter before adding richer runtime behavior.

## Reference documents

- [Project context and drift rules](../01-product/UNDATED--CURRENT--project-context.md)
- [Architecture ownership and interfaces](../02-architecture/UNDATED--FOUNDATION--architecture.md)
- [Repository boundaries](../02-architecture/UNDATED--FOUNDATION--repository.md)
- [Data and API contracts](../02-architecture/UNDATED--FOUNDATION--contracts.md)
- [Build and test commands](../02-architecture/UNDATED--FOUNDATION--build-system.md)
- [Implementation phases](../03-delivery/UNDATED--FOUNDATION--implementation-plan.md)
- [Testing strategy](../03-delivery/UNDATED--FOUNDATION--testing-strategy.md)
- [Debugging and logging](UNDATED--CURRENT--debugging.md)
- [Engineering practices](UNDATED--FOUNDATION--engineering-practices.md)
- [Pre-baseline validation](../03-delivery/UNDATED--CURRENT--pre-baseline-validation.md)
- [Authoring-engine design](../05-subsystems/authoring-engine.md)
- [Session handoff](../../SESSION.md)