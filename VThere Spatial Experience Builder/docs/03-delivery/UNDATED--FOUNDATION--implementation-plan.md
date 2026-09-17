# Implementation Plan

## Phase 0 — Baseline skeleton

- **Purpose:** create the agreed app/package boundaries and make a trivial editor, runtime, and API start.
- **Prerequisites:** human approval of scope, stack, and architecture.
- **Systems:** repository, build, shared project types, health endpoint.
- **Outputs:** monorepo layout, pinned lockfiles, FastAPI health route, TypeScript package imports.
- **Acceptance:** fresh checkout installs, builds, runs tests, starts editor/runtime/API.
- **Verification:** `npm ci`; `npm run build`; `python -m pytest`; `docker compose config`.

## Phase 1 — Shared project foundation

- **Purpose:** prove the canonical project document and persistence round trip.
- **Dependencies:** Phase 0.
- **Systems:** project, serialization, validation, spatial.
- **Outputs:** versioned schema, migration rejection path, transform types, canonical serializer, draft/backup persistence adapter, fixture tests.
- **Acceptance:** serialize -> deserialize reconstructs an equivalent project; invalid references fail validation; a corrupt current draft recovers from a valid backup; an unsupported schema is rejected without overwriting the draft.
- **Verification:** `npm run test -- packages/project packages/serialization packages/validation`; persistence adapter contract tests.

## Phase 2 — Editor foundation

- **Purpose:** complete the authoring loop around the current prototype.
- **Dependencies:** Phase 1.
- **Systems:** editor UI, viewport, selection, gizmos, scene tree, asset browser, inspector, commands.
- **Outputs:** standalone `packages/authoring-engine/`, custom move/rotate/scale handles, command history, debounced autosave, explicit-save path, recovery status.
- **Acceptance:** author places, selects, transforms, deletes, undoes, redoes, saves, reloads, and recovers objects; a transform drag creates one history entry on release, not one per pointer event.
- **Verification:** `npm run test -- packages/authoring-engine`; Playwright editor smoke scenario.

## Phase 3 — Experience system

- **Purpose:** add authored content and deterministic visitor behaviour.
- **Dependencies:** Phases 1–2.
- **Systems:** components, interaction builder, interaction engine, zones, navigation.
- **Outputs:** click/zone/scene-start triggers and show/play/navigate actions.
- **Acceptance:** zone entry fires once, ordered rules execute predictably, two scenes navigate both directions.
- **Verification:** `npm run test -- packages/interaction`; Playwright interaction scenario.

## Phase 4 — Runtime and preview parity

- **Purpose:** make visitor playback consume the same project and interaction core.
- **Dependencies:** Phase 3.
- **Systems:** runtime app, runtime scene, camera, presentation, analytics.
- **Outputs:** visitor route with no editor controls, preview fixture tests, analytics events.
- **Acceptance:** preview and published fixture produce identical scene/content/action outcomes.
- **Verification:** `npm run test -- parity`; `npm run test:e2e -- runtime-parity`.

## Phase 5 — API, persistence, and publishing

- **Purpose:** replace local draft storage with secure shared services.
- **Dependencies:** Phases 1–4 and infrastructure decision.
- **Systems:** FastAPI, auth/access, PostgreSQL, object storage, publishing, CDN.
- **Outputs:** project/version endpoints, optimistic revision checks, signed asset URLs, immutable publication records, server-side autosave queue and retry policy.
- **Acceptance:** two actors are isolated, a published URL loads from another device, saved versions survive browser changes, conflicting revisions are rejected rather than silently overwritten, and failed autosaves surface a truthful recovery state.
- **Verification:** `python -m pytest apps/api/tests`; API authorization, revision-conflict, publication, and signed-URL tests.

## Phase 6 — Verification and performance

- **Purpose:** demonstrate stability on target browsers/devices.
- **Dependencies:** Phases 1–5.
- **Systems:** Vitest, pytest, Playwright, performance checks.
- **Outputs:** scenario suite, browser matrix, asset budgets, defect report.
- **Acceptance:** defined Project 5 scenarios pass on the agreed device/browser matrix.
- **Verification:** `npm run test:e2e`; `python -m pytest`; recorded browser/device performance run.

## Persistence build factor

Persistence is a release-blocking cross-cutting concern, not a finishing feature. Every phase must preserve these guarantees:

- **Command durability:** committed edits can be serialized without losing ordering, IDs, dependencies, or transform precision.
- **Autosave truthfulness:** the UI reports `saving`, `saved`, `recovered`, or `failed`; it never displays success before the write completes.
- **Fallback recovery:** current draft, last-known-good backup, server revision, and export fallback have a defined order and tests.
- **Revision safety:** server writes include the base revision; stale clients receive a conflict instead of overwriting newer work.
- **Published immutability:** a published version is never changed by later draft edits or autosave.
- **Undo/redo continuity:** save, reload, autosave, and recovery preserve the resulting project state even if the in-memory command timeline itself is reset.
