# VThere Deliverables, Ownership, and Milestones
**THIS DOCUMENT IS ALL WRONG, we are not that stacked to have these roles**


**Status:** Initial engineering baseline  
**Jira project:** To be confirmed  
**Owner assignment rule:** replace role owners with named team members and Jira account IDs before implementation work is accepted

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

- **M1:** foundation and one demonstrable vertical slice.
- **M2:** integrated author -> save -> preview/publish -> visitor MVP.
- **M3:** hardened, tested, documented, cross-platform demonstration release.

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
| M1 | Minimal scene serializes and deserializes without losing identity, ordering, or transforms. |
| M2 | Full MVP project including content, zones, interactions, and navigation round-trips through the same model in editor and runtime. |
| M3 | Migration fixtures, compatibility policy, and contract test report are published. |

### VTH-02 Authoring engine

**Stories/tasks:**

- Implement selection state and viewport hit-test adapters.
- Implement constrained move, rotate, and scale sessions.
- Implement command grouping so one drag produces one history entry.
- Implement undo/redo, delete restoration, and redo-branch invalidation.
- Keep the engine framework-agnostic and testable without React, Three.js, HTTP, or a database.

| Milestone | Acceptance evidence |
|---|---|
| M1 | A fixture object can be selected, transformed, deleted, undone, and redone through unit-tested commands. |
| M2 | Editor interactions use the engine for all supported transforms and preserve project serialization behavior. |
| M3 | Browser smoke tests, precision/constraint tests, and performance evidence cover the agreed device matrix. |

### VTH-03 Editor application

**Stories/tasks:**

- Implement editor application lifecycle and mode state.
- Integrate viewport, scene tree, asset browser, and inspector.
- Add object naming, hierarchy operations, content attachment, and scene management.
- Add interaction-builder forms backed by shared validation.
- Add save status, recovery status, and accessible keyboard/pointer states.

| Milestone | Acceptance evidence |
|---|---|
| M1 | Editor loads with viewport, scene tree, curated asset placement, inspector, and local save/load. |
| M2 | Author can build the MVP exhibition workflow and launch preview without bypassing shared domain commands. |
| M3 | UX/accessibility review passes and responsive editor behavior is documented for supported browsers. |

### VTH-04 Runtime and interaction

**Stories/tasks:**

- Define supported trigger and action vocabulary.
- Implement deterministic interaction dispatch and rule ordering.
- Implement zone-entry edge detection and loop protection.
- Reconstruct runtime scenes from the shared project document.
- Add preview/published parity fixtures and multi-scene navigation.

| Milestone | Acceptance evidence |
|---|---|
| M1 | One trigger/action path executes from a fixture project without React-specific domain logic. |
| M2 | Click, zone-entry, scene-start, content presentation, audio, and navigation paths work in preview and runtime. |
| M3 | Parity tests prove equivalent outcomes and regression coverage includes ordering, repeated zone presence, and navigation loops. |

### VTH-05 Backend platform

**Stories/tasks:**

- Implement authenticated project and version endpoints.
- Implement repository transactions and optimistic revision checks.
- Implement server-side project validation and access control.
- Implement signed asset upload/read references and object-storage adapter.
- Implement immutable publication records and published URL resolution.

| Milestone | Acceptance evidence |
|---|---|
| M1 | API health route, contract skeleton, local persistence adapter, and error format run in the documented environment. |
| M2 | Save/load, version listing, access isolation, asset references, and publish flow work end to end. |
| M3 | Authorization, revision-conflict, publication immutability, and Ubuntu 24.04 deployment tests pass. |

### VTH-06 Visitor and analytics

**Stories/tasks:**

- Implement visitor route with editing controls absent.
- Implement responsive scene loading and visitor input.
- Implement analytics events for visits, time spent, hotspot clicks, and scenes reached.
- Add event validation, privacy-safe payload rules, and failure handling.
- Verify published URL loading on a separate device/browser profile.

| Milestone | Acceptance evidence |
|---|---|
| M1 | Minimal published-like fixture opens in visitor mode at desktop and phone viewport sizes. |
| M2 | Published URL loads an MVP exhibition and records the agreed basic events. |
| M3 | Mobile/browser matrix, analytics verification, and runtime performance report are attached to the release. |

### VTH-07 Engineering quality

**Stories/tasks:**

- Pin dependencies and document clean-clone setup commands.
- Add CI for install, format/lint, type checks, unit tests, integration tests, and builds.
- Add Playwright/browser smoke coverage and API contract checks.
- Add environment diagnostics and safe `.env.example` configuration.
- Add Ubuntu 24.04 server deployment verification and release checklist.

| Milestone | Acceptance evidence |
|---|---|
| M1 | A clean checkout installs, builds, starts editor/runtime/API, and passes focused tests in CI. |
| M2 | Integrated editor/API/runtime tests run automatically on pull requests. |
| M3 | Ubuntu 24.04 deployment and applicable Ubuntu 24.04, macOS Tahoe, and Windows 11 development checks are recorded. |

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
