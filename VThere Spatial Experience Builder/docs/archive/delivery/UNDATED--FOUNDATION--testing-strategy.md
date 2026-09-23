# Testing Strategy

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

## Test layers

- **Shared unit tests:** project schema, serialization/migrations, validation, spatial math, interaction ordering, and authoring-engine command history.
- **Persistence contract tests:** primary/backup recovery, autosave debounce contract, failed writes, retry policy, revision conflicts, and immutable publication snapshots.
- **API tests:** FastAPI route authorization, project isolation, version writes, publication reads, signed asset URLs, and analytics ingestion using pytest and HTTPX.
- **Browser integration tests:** editor placement, selection, transform, inspector, undo/redo, autosave status, recovery notice, and export fallback using Playwright.
- **Parity tests:** identical project fixtures drive editor preview and visitor runtime; observable scene, content, interaction, and navigation results must match.
- **Performance checks:** target browser/device matrix, initial load, frame stability, asset budget, and scene/object limits.

## Required scenarios

1. Place three artefacts, attach panels, preview, publish, and open on a phone.
2. Enter a zone and confirm its audio rule fires once.
3. Navigate between two scenes in both directions.
4. Delete an exhibit, undo, and verify components/interactions return.
5. Move an object behind a wall and select it from the scene tree.
6. Close without an explicit save and recover from autosave or receive a truthful failure state.
7. Verify two projects cannot read or mutate each other.
8. Run two rules on one object and verify documented order.
9. Compare preview and published behaviour on another browser/device.

## Release gates

A phase cannot advance when its focused unit tests fail. Persistence and authoring-engine tests are release-blocking because they protect the canonical project state. Playwright and API isolation tests are required before publication is treated as an MVP capability.
