# Engineering Practices

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

These practices are deliberately practical for the current VThere stack: React, TypeScript, Three.js, FastAPI, PostgreSQL, local draft storage, and a shared project document.

## Priority order

Adopt these in order. The first group protects the project from expensive structural mistakes.

### 1. Keep business logic pure

Put rules in framework-free packages under [`packages/`](../../../packages/). A domain function should receive data and return data without reading React state, browser storage, current time, randomness, or global variables.

This makes a feature cheap to test and keeps editor preview and visitor runtime behavior aligned.

Good boundary:

```text
UI input -> command/domain function -> new ProjectDocument -> persistence/rendering
```

Avoid:

```text
button handler -> mutate object -> localStorage -> Three.js object -> hidden side effect
```

### 2. Use one canonical project document

The project document is the shared contract between editor, persistence, preview, API, and runtime. Add project data in [`packages/project/src/index.ts`](../../../packages/project/src/index.ts), not in a component-local interface.

Every schema change must include:

- A schema version decision.
- Serialization and deserialization coverage.
- Invalid-input behavior.
- Migration or rejection behavior.
- A fixture showing the intended document shape.

Never silently drop unknown or invalid data during a save.

### 3. Make every edit a command

User-visible changes should be represented as commands or compound commands. This gives us one place to implement:

- Execute.
- Undo.
- Redo.
- History labels.
- Autosave boundaries.
- Future audit or collaboration metadata.

Drag operations should commit once on pointer release. Pointer-move previews must not flood history or persistence.

The history seam is [`packages/authoring-engine/src/index.ts`](../../../packages/authoring-engine/src/index.ts), wired into the editor through [`src/App.tsx`](../../../src/App.tsx) and [`src/editor/`](../../../src/editor/).

### 4. Make time and randomness injectable

Do not use `Date.now()` or `Math.random()` directly in business logic that tests must reproduce. Pass an ID generator or clock into the service, or keep those calls at the application boundary.

Tests should be able to say:

```ts
const ids = fixedIdGenerator(['object-1', 'object-2'])
const clock = fixedClock('2026-09-07T12:00:00.000Z')
```

This prevents flaky snapshots, autosave tests, and history tests.

### 5. Test behavior at the owning boundary

Write the smallest test that can prove the behavior:

| Feature | First test | Later test |
|---|---|---|
| Project model | Pure unit test | Serialization fixture |
| Transform/gizmo | Spatial unit test | Playwright editor flow |
| Undo/redo | Command timeline test | Browser history flow |
| Autosave/recovery | Persistence adapter test | Browser reload/recovery flow |
| API endpoint | HTTPX/pytest contract test | Auth/isolation integration test |
| Preview/runtime | Shared fixture parity test | Cross-browser E2E test |

Do not use a browser test to prove a pure calculation. Do not use a unit test to claim that React wiring or API authorization works.

### 6. Treat failures as typed outcomes

Prefer explicit result types or domain errors over generic strings. At minimum, distinguish:

- Invalid project data.
- Unsupported schema version.
- Missing referenced object or scene.
- Persistence unavailable.
- Revision conflict.
- Unauthorized or forbidden access.
- Asset unavailable.

The UI can then show a truthful recovery path, and tests can assert the exact failure rather than matching fragile message text.

### 7. Instrument boundaries, not every line

Use the shared logger in [`packages/debugging/src/index.ts`](../../../packages/debugging/src/index.ts) when an operation starts, completes, recovers, or fails. Include stable IDs, operation names, durations, and request IDs.

Do not log full project documents, credentials, access tokens, or binary assets. See [`CURRENT--debugging.md`](CURRENT--debugging.md) for the redaction and investigation rules.

### 8. Keep adapters at the edges

Browser storage, Three.js, HTTP, PostgreSQL, object storage, and authentication are adapters. Domain packages should depend on interfaces, not concrete providers.

This lets tests use:

- An in-memory persistence adapter.
- A fake asset repository.
- A deterministic clock.
- A memory logger sink.
- A fixed project fixture.

It also prevents a future API or storage change from forcing a rewrite of authoring logic.

## Feature development recipe

For each new feature:

1. Write the user-visible behavior and failure behavior in one short note.
2. Identify the owning boundary in [`architecture`](../architecture/FOUNDATION--architecture.md).
3. Extend the canonical model only if the feature needs persistent data.
4. Implement pure domain logic and its focused tests.
5. Wrap it in a command if it changes authored state.
6. Add serialization/validation coverage if the project document changes.
7. Connect persistence through the existing adapter.
8. Connect the UI or API last.
9. Add structured logs at recovery and failure boundaries.
10. Run the narrow test, then the full build and test commands.

## Fixtures and test data

Use small named fixtures instead of constructing large anonymous objects in every test. A fixture should represent one behavior, not the entire product.

Recommended fixture names:

- `emptyProject`.
- `projectWithTwoScenes`.
- `projectWithSelectedObject`.
- `projectWithInvalidSceneReference`.
- `projectWithInteractionRule`.
- `publishedProjectSnapshot`.

Keep fixtures versioned with the schema and make them readable in code review. Never use production user data as a test fixture.

## Persistence and recovery checks

Every persistence feature should test:

- Successful primary save.
- Backup creation from the previous valid draft.
- Corrupt current draft recovery.
- Corrupt backup fallback.
- Unsupported schema rejection.
- Primary and backup write failure.
- Revision conflict without overwrite.
- Published snapshot remaining unchanged after draft edits.

The save result must not say `saved` until the write has completed successfully.

## Review checklist

Before merging a feature, confirm:

- [ ] The behavior has a focused automated test.
- [ ] The test is deterministic and does not depend on real time or random IDs.
- [ ] Persistent state changes use the canonical project model.
- [ ] Undo/redo behavior is defined for editor changes.
- [ ] Save, recovery, and revision behavior are defined where relevant.
- [ ] Errors are typed or otherwise distinguishable.
- [ ] Logs include useful context and no secrets.
- [ ] No new dependency cycle or duplicate model was introduced.
- [ ] Documentation and contracts match the implementation.
- [ ] `npm.cmd run build`, `npm.cmd test`, and relevant pytest commands pass.

## Recommended next improvements

These are the highest-value follow-ups for the current repository:

1. Move project serialization into `packages/serialization/` and add fixture tests.
2. Add `packages/validation/` with typed validation errors.
3. Replace UI snapshot history with the authoring-engine timeline.
4. Add deterministic ID and clock providers to the authoring engine.
5. Add Playwright coverage for placement, undo/redo, autosave, and recovery.
6. Add API revision-conflict and project-isolation tests before server persistence.
7. Add CI gates for build, unit tests, API tests, and dependency audit.

## Related documents

- [Development guide](CURRENT--development-guide.md)
- [Debugging and logging](CURRENT--debugging.md)
- [Testing strategy](../../archive/delivery/FOUNDATION--testing-strategy.md)
- [Architecture boundaries](../architecture/FOUNDATION--architecture.md)
- [Baseline stage overview](../FOUNDATION--baseline-phases.md)