# VThere Deliverables, Ownership, and Milestones
**THIS DOCUMENT IS ALL WRONG, we are not that stacked to have these roles**

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.


**Status:** All 8 baseline stages complete (verified against `docs/code/baseline-phases.md` and commits `0ad9c20`..`8831960`). The role/Jira structure below is still aspirational — replace it before treating this as a real tracker.
**Jira project:** To be confirmed  
**Owner assignment rule:** replace role owners with named team members and Jira account IDs before implementation work is accepted

## What exists today

The repository areas referenced below are no longer placeholders. As of the baseline:

- `apps/api/` is a real FastAPI service: Auth0/JWT auth (`auth.py`), boto3-backed object storage (`storage.py`), SQLAlchemy models + Alembic migrations for Organisation/Actor/Project/ProjectVersion/MediaAsset/ContentSnapshot/AnalyticsEvent/InteractionRule, and routers for `projects`, `rules`, `media`, `publish`, `analytics`. The routes are real (auth-checked, correctly shaped request/response models) but every handler body still returns `501 Not Implemented` — persistence/business logic is the next slice, not this baseline.
- `packages/project`, `packages/authoring-engine`, `packages/assets`, `packages/interaction`, `packages/sync`, and `packages/debugging` all exist, are implemented, and are unit-tested.
- `apps/editor/` and `apps/runtime/` exist as thin app shells; the substantial editor/runtime logic still lives in the root `src/` prototype (`App.tsx`, `Viewport.tsx`, `src/viewport/*`, `src/sync/*`), which is now wired to the shared packages above rather than standing alone.
- Concretely, today an author can: place primitive/curated objects in the viewport (asset resolution via `packages/assets` through `src/viewport/assetResolution.ts`), define WHEN→DO interaction rules that dispatch through `packages/interaction` (`src/viewport/interactionController.ts` / `src/Viewport.tsx`) and fire in the runtime viewport, and have project edits staged through `src/sync/projectSync.ts` (`packages/sync`'s `SyncClient`/`SyncQueue`, with localStorage-backed queue persistence and reconnect retry). That sync path currently talks to a stub transport, because the backend write endpoints it would call are the same `501` skeleton routes above — the client-side dual-write/retry machinery is real and tested, but nothing durable happens server-side yet.

## Ownership model

Each deliverable has one directly responsible owner. The owner is accountable for implementation, tests, documentation, CI evidence, and integration handoff. A reviewer checks the contract and acceptance evidence before merge.

| ID | Jira Epic | Technical deliverable | Primary owner | Reviewer | Repository area |
|---|---|---|---|---|---|
| VTH-01 | VTH-01 Shared project model | Versioned project model, schema, serialization, migrations, validation | Domain Engineer | API Engineer | `packages/project/`, `packages/serialization/`, `packages/validation/` |
| VTH-02 | VTH-02 Authoring engine | Selection, raycasting, transform math, gizmos, command grouping, undo/redo | Editor Systems Engineer | Domain Engineer | `packages/authoring-engine/`, `packages/spatial/`, `packages/commands/` |
| VTH-03 | VTH-03 Editor application | React editor shell, viewport, scene tree, asset panel, inspector, interaction builder | Frontend Engineer | UX Engineer | `apps/editor/` |
| VTH-04 | VTH-04 Runtime and interaction | Interaction dispatch, runtime scene reconstruction, preview/runtime parity, navigation | Runtime Engineer | Domain Engineer | `packages/interaction/`, `apps/runtime/` |
| VTH-05 | VTH-05 Backend platform | FastAPI API, persistence, access control, asset storage, publishing | Backend Engineer | Security/Integration Engineer | `apps/api/`, `infrastructure/storage/` |
| VTH-06 | VTH-06 Visitor and analytics | Responsive visitor experience, analytics events, published URL flow | Runtime Engineer | QA Engineer | `apps/runtime/`, `apps/api/` |
| VTH-07 | VTH-07 Engineering quality | CI/CD, environment setup, test harness, browser matrix, release evidence | DevOps/QA Engineer | Technical Lead | `.github/workflows/`, `docs/`, `tests/` |
| VTH-08 | VTH-08 Product design and accessibility | User flows, wireframes, interaction language, responsive/accessibility review | UX/Product Designer | Product Owner | `docs/design/`, `apps/editor/`, `apps/runtime/` |

## Milestone definition

- **M1:** foundation and one demonstrable vertical slice. **Achieved** — the 8-stage baseline gives a working local dev environment, data model, HTTP route skeleton, and three shared packages (assets, interaction, sync) wired into the editor/runtime prototype.
- **M2:** integrated author -> save -> preview/publish -> visitor MVP. **Not yet achieved** — author -> local save -> preview/runtime works end to end; "save" only durably round-trips through client-side localStorage + a stub sync transport, because the API's project/rules/media/publish handlers are still `501` skeletons with no persistence logic behind them.
- **M3:** hardened, tested, documented, cross-platform demonstration release. **Not started** — no browser/API integration suite, no deployment verification beyond the Stage 5 Docker/compose scaffold.

## Epic breakdown

### VTH-01 Shared project model

**Stories/tasks:**

- Define typed project, scene, object, component, zone, interaction, and navigation contracts.
- Implement canonical versioned JSON serialization and deserialization.
- Add schema migration and unsupported-version rejection.
- Add structural validation for IDs, references, transforms, and interaction targets.
- Add round-trip and invalid-document fixture tests.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **DONE.** `packages/project` (`ProjectData`/`SceneData`/`SceneObject`/`TransformData`) round-trips through `src/serializer.ts`'s JSON draft/backup/autosave/export path. |
| M2 | **PARTIAL.** Objects now carry `assetId` (resolved via `packages/assets`) and interaction rules dispatch via `packages/interaction`, but the model still has no first-class zone/navigation schema or a schema-migration mechanism beyond a version check. |
| M3 | Not started. Migration fixtures and a published compatibility policy do not exist yet. |

### VTH-02 Authoring engine

**Stories/tasks:**

- Implement selection state and viewport hit-test adapters.
- Implement constrained move, rotate, and scale sessions.
- Implement command grouping so one drag produces one history entry.
- Implement undo/redo, delete restoration, and redo-branch invalidation.
- Keep the engine framework-agnostic and testable without React, Three.js, HTTP, or a database.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **DONE.** `packages/authoring-engine` implements and tests a snapshot command timeline (commit/undo/redo, redo-branch invalidation, history limits, defensive cloning), used by `src/App.tsx`. |
| M2 | **PARTIAL.** Editor transforms route through the engine and gizmo/drag interaction lives in `src/viewport/` (`createGizmoSet.ts`, `syncGizmo.ts`, `interactionMath.ts`, `interactionController.ts`), but constrained move/rotate/scale sessions and true command grouping are still basic-drag rather than the fully compound-command design the plan describes. |
| M3 | Not started. No browser/precision/performance test suite exists yet (`tests/e2e/smoke.spec.ts` is the only Playwright coverage). |

### VTH-03 Editor application

**Stories/tasks:**

- Implement editor application lifecycle and mode state.
- Integrate viewport, scene tree, asset browser, and inspector.
- Add object naming, hierarchy operations, content attachment, and scene management.
- Add interaction-builder forms backed by shared validation.
- Add save status, recovery status, and accessible keyboard/pointer states.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **DONE.** The editor (root `src/`, plus the `apps/editor/` shell) loads with viewport, scene tree, asset placement (now resolver-backed via `packages/assets`), inspector, and local save/load. |
| M2 | **PARTIAL.** An author can place objects, wire WHEN→DO rules, and preview them live; the `apps/editor/` application boundary itself is still a thin 18-line shell wrapping the root `src/` prototype rather than the fully migrated planned structure. |
| M3 | Not started. No formal UX/accessibility review or documented browser matrix. |

### VTH-04 Runtime and interaction

**Stories/tasks:**

- Define supported trigger and action vocabulary.
- Implement deterministic interaction dispatch and rule ordering.
- Implement zone-entry edge detection and loop protection.
- Reconstruct runtime scenes from the shared project document.
- Add preview/published parity fixtures and multi-scene navigation.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **DONE.** `packages/interaction` (`RuntimeEvent`/`RuntimeState`, `dispatch()`, `ActionSequencer`, `zoneTracker`, action executors) is framework-free and unit-tested independent of React. |
| M2 | **PARTIAL.** Click/gizmo-driven triggers dispatch through `packages/interaction` from `src/viewport/interactionController.ts` and `src/Viewport.tsx`, and `apps/runtime/` exists as an app boundary — but it is currently an 18-line shell, and the full click/zone-entry/scene-start/audio/navigation trigger-action matrix is not yet proven end to end in a separate runtime app. |
| M3 | Not started. No preview/published parity test suite exists. |

### VTH-05 Backend platform

**Stories/tasks:**

- Implement authenticated project and version endpoints.
- Implement repository transactions and optimistic revision checks.
- Implement server-side project validation and access control.
- Implement signed asset upload/read references and object-storage adapter.
- Implement immutable publication records and published URL resolution.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **DONE.** `apps/api` now has a real FastAPI app with `x-request-id` correlation, Auth0/JWT auth (`auth.py`), boto3 object storage (`storage.py`), SQLAlchemy models + Alembic migrations for all core entities, and routers (`projects`, `rules`, `media`, `publish`, `analytics`) with correctly-shaped request/response contracts. |
| M2 | **NOT DONE.** Every route handler in those routers currently raises `HTTPException(501)` via the shared `not_implemented()` helper in `apps/api/app/routers/_skeleton.py` — there is no persistence, revision-check, or publish business logic behind the contracts yet. Save/load only works client-side (`src/serializer.ts` localStorage) with `src/sync/projectSync.ts` staging changes against a stub transport that never reaches a real endpoint. |
| M3 | Not started, pending M2. Stage 5 did add production deploy scaffolding (Dockerfiles, `docker-compose.prod.yml`, `deploy.yml`, `deploy/README.md`), but no authorization/revision-conflict/publication-immutability tests exist. |

### VTH-06 Visitor and analytics

**Stories/tasks:**

- Implement visitor route with editing controls absent.
- Implement responsive scene loading and visitor input.
- Implement analytics events for visits, time spent, hotspot clicks, and scenes reached.
- Add event validation, privacy-safe payload rules, and failure handling.
- Verify published URL loading on a separate device/browser profile.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **PARTIAL.** `apps/runtime/` exists as an application boundary and the interaction engine fires WHEN→DO rules in the viewport, but there is no dedicated non-editing visitor route yet — the runtime app is an 18-line shell, not a fixture-validated visitor mode. |
| M2 | Not done. No published-URL flow exists (the API's `publish` router is 501), and `apps/api/app/routers/analytics.py` handlers are unimplemented, so no events are actually recorded. |
| M3 | Not started. |

### VTH-07 Engineering quality

**Stories/tasks:**

- Pin dependencies and document clean-clone setup commands.
- Add CI for install, format/lint, type checks, unit tests, integration tests, and builds.
- Add Playwright/browser smoke coverage and API contract checks.
- Add environment diagnostics and safe `.env.example` configuration.
- Add Ubuntu 24.04 server deployment verification and release checklist.

| Milestone | Acceptance evidence |
|---|---|
| M1 | **PARTIAL.** A clean checkout installs and builds; `docker-compose.yml`/`.env.example` give a documented local dev environment (Stage 1); package-level Vitest/pytest tests exist (29+ `.test.ts` files plus `apps/api/tests/`) and `tests/e2e/smoke.spec.ts` gives one Playwright smoke test. No `.github/workflows/` CI pipeline exists yet, so none of this runs automatically. |
| M2 | Not done — no CI to run integrated tests on pull requests. |
| M3 | Not started, though Stage 5 added production deploy scaffolding (`Dockerfile`s, `docker-compose.prod.yml`, `deploy/README.md`, Caddy/nginx config) that M3's deployment verification would build on. |

### VTH-08 Product design and accessibility

**Stories/tasks:**

- Document author and visitor user flows.
- Produce wireframes for editor, preview, publish, and runtime states.
- Define content, interaction, error, saving, and recovery language.
- Review keyboard access, focus order, contrast, responsive layout, and non-pointer alternatives.
- Attach design decisions and usability findings to Jira and PRs.

| Milestone | Acceptance evidence |
|---|---|
| M1 | Primary author flow and minimum visitor flow are approved. |
| M2 | Integrated MVP screens have UX and accessibility review evidence. |
| M3 | Release candidate passes the agreed accessibility checklist with known limitations documented. |

## Jira and GitHub traceability

For every Story/Task, record:

- Epic ID and milestone.
- Named owner and reviewer.
- Acceptance criteria.
- Repository path.
- Dependencies and risks.
- Pull request URL.
- CI run and test evidence.
- Demo or screenshot evidence when behavior is visual.

Recommended branch and PR naming:

```text
VTH-02/transform-command-history
VTH-02: implement transform command history
```

A Story/Task is complete only when its code, focused tests, documentation, CI result, and reviewer approval are linked in Jira. Integration branches should merge vertical slices, not unrelated unfinished components.

## Assignment checklist

Before the first implementation sprint, the team lead should:

- Replace each role in the ownership table with a named member and Jira account.
- Create the eight Jira Epics and copy the Story/Task breakdown into them.
- Confirm the technical lead, product owner, UX reviewer, and release approver.
- Confirm the Jira project key, branch protection, required checks, and deployment target.
- Store approved wireframes in `docs/design/ui-ux/` and link them from VTH-08.
