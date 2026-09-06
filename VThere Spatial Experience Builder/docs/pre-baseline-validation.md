# Pre-Baseline Validation

**Status:** BLOCKED pending human architecture approval and toolchain verification.

| Check | Status | Evidence / blocker |
|---|---|---|
| Scope | PASS | `projectscope.md` defines required, optional, future, undefined, and forbidden scope. |
| Technology | PASS WITH BLOCKER | `techstack.md` selects the browser, API, database, storage, auth, CDN, and test tools; npm verification is unavailable because Node.js is not installed. |
| Architecture | PASS WITH APPROVAL GATE | `architecture.md` defines Editor, Shared, Runtime, Infrastructure, persistence invariants, and standalone `AuthoringEngine`. |
| Repository | PASS | `repository.md` classifies fixed, extensible, generated, and optional boundaries. |
| Integrations | PASS | `contracts.md` and `architecture.md` define client/API, storage, CDN, auth, analytics, and project-data flow. |
| Contracts | PASS | Versioned project JSON, API resources, interaction events/actions, errors, and signed asset URLs are documented. |
| Dependencies | PASS | Direction is UI/apps -> shared packages; shared packages do not import UI/API/database concerns. |
| Build | BLOCKED | `npm install` and `npm run build` are recorded but not executable in the current environment; backend does not yet exist. |
| Testing | PASS WITH IMPLEMENTATION PENDING | `testing-strategy.md` defines unit, persistence, API, browser, parity, and performance layers. |
| Implementation | PASS WITH IMPLEMENTATION PENDING | `implementation-plan.md` orders baseline, shared core, editor, experience, runtime, API, and verification phases. |

## Required human decisions

- Approve the Stage 3 skeleton before baseline implementation.
- Confirm the exact MVP trigger/action vocabulary and visitor movement model.
- Confirm the target browser/device matrix and quantitative performance targets.
- Install Node.js 22 LTS and verify the pinned frontend dependency graph.
- Confirm the Google Cloud/Auth0 deployment direction or record an approved replacement.
- Approve the six-trigger/six-action vocabulary, visitor movement model, project lifecycle states, and supplied asset/environment inventory.
- Confirm roles, mentor schedule, pilot safeguards, NDA/IP terms, and final handoff requirements.

## Patterns flagged unfamiliar

Browser WebGL/raycasting, schema migration, OIDC/JWT validation, object-storage signed URLs, CDN cache invalidation, optimistic revision control, and IndexedDB/local draft recovery require `/learn` review if the team cannot explain their call flow. No `/learn` runs have been recorded.

## Pre-baseline answers

- Can the repository represent the architecture? **YES**, after the planned `apps/`, `packages/`, and `infrastructure/` move.
- Can selected technologies coexist? **YES**, subject to pinned dependency installation and API contract generation.
- Are dependency directions valid and acyclic? **YES**, by the documented boundary rules.
- Can the baseline build and run without future functionality? **YES IN DESIGN; NOT VERIFIED.**
- Can each subsystem be implemented independently? **YES**, through the documented project, persistence, authoring-engine, and API contracts.
- Can a new agent understand one subsystem without reading the whole project? **YES**, especially the standalone authoring-engine subsystem document.
- Can the baseline be extended without restructuring? **YES IN DESIGN; HUMAN REVIEW REQUIRED.**

```text
# Pre-Baseline Validation

STATUS: BLOCKED

Skeleton reviewed by human:   no
Scope            PASS
Technology       PASS WITH BLOCKER
Architecture     PASS WITH APPROVAL GATE
Repository       PASS
Integrations     PASS
Contracts        PASS
Dependencies     PASS
Build            BLOCKED     Command: npm install && npm run build     Verified: no
Testing          PASS WITH IMPLEMENTATION PENDING
Implementation   PASS WITH IMPLEMENTATION PENDING

Patterns flagged UNFAMILIAR:  WebGL/raycasting, schema migration, OIDC/JWT, signed URLs, CDN invalidation, revision control, IndexedDB recovery
/learn runs completed:        0
Unresolved decisions:         MVP trigger/action vocabulary, visitor movement model, CI automation, performance targets
Architectural risks:          custom gizmo mathematics, preview/published parity, persistence recovery, access isolation
Required human decisions:     approve skeleton; confirm product movement/interaction decisions; install and verify toolchains
Non-obvious tradeoffs:        FastAPI API with TypeScript client contracts; JSON project versions in PostgreSQL; binary media in object storage; local backup before server sync

BASELINE READINESS: NOT READY
```
