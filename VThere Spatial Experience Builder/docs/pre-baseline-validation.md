# Pre-Baseline Validation

**Status:** IN PROGRESS pending human architecture approval.

| Check | Status | Evidence / blocker |
|---|---|---|
| Scope | PASS | `projectscope.md` defines required, optional, future, undefined, and forbidden scope. |
| Technology | PASS | `techstack.md` selects the browser, API, database, storage, auth, CDN, and test tools; Node.js, npm, and Python are now installed and verified. |
| Architecture | PASS WITH APPROVAL GATE | `architecture.md` defines Editor, Shared, Runtime, Infrastructure, persistence invariants, and standalone `AuthoringEngine`. |
| Repository | PASS | `repository.md` classifies fixed, extensible, generated, and optional boundaries. |
| Integrations | PASS | `contracts.md` and `architecture.md` define client/API, storage, CDN, auth, analytics, and project-data flow. |
| Contracts | PASS | Versioned project JSON, API resources, interaction events/actions, errors, and signed asset URLs are documented. |
| Dependencies | PASS | Direction is UI/apps -> shared packages; shared packages do not import UI/API/database concerns. |
| Build | PASS WITH WARNING | `npm install` and `npm run build` pass; Vite reports a large production chunk warning. |
| Testing | PASS WITH WARNING | Vitest and the API health pytest pass; browser, integration, and full backend suites remain pending. |
| Implementation | IN PROGRESS | Phase 0 has established the canonical project package, authoring-engine history seam, and API health route. |

## Required human decisions

- Approve the Stage 3 skeleton before baseline implementation.
- Confirm the exact MVP trigger/action vocabulary and visitor movement model.
- Confirm the target browser/device matrix and quantitative performance targets.
- Keep the verified Node.js/npm and Python toolchain available for development.
- Confirm the Google Cloud/Auth0 deployment direction or record an approved replacement.
- Approve the six-trigger/six-action vocabulary, visitor movement model, project lifecycle states, and supplied asset/environment inventory.
- Confirm roles, mentor schedule, pilot safeguards, NDA/IP terms, and final handoff requirements.

## Patterns flagged unfamiliar

Browser WebGL/raycasting, schema migration, OIDC/JWT validation, object-storage signed URLs, CDN cache invalidation, optimistic revision control, and IndexedDB/local draft recovery require `/learn` review if the team cannot explain their call flow. No `/learn` runs have been recorded.

## Pre-baseline answers

- Can the repository represent the architecture? **YES**, after the planned `apps/`, `packages/`, and `infrastructure/` move.
- Can selected technologies coexist? **YES**, subject to pinned dependency installation and API contract generation.
- Are dependency directions valid and acyclic? **YES**, by the documented boundary rules.
- Can the baseline build and run without future functionality? **YES; frontend build and focused tests verified.**
- Can each subsystem be implemented independently? **YES**, through the documented project, persistence, authoring-engine, and API contracts.
- Can a new agent understand one subsystem without reading the whole project? **YES**, especially the standalone authoring-engine subsystem document.
- Can the baseline be extended without restructuring? **YES IN DESIGN; HUMAN REVIEW REQUIRED.**

```text
# Pre-Baseline Validation

STATUS: IN PROGRESS

Skeleton reviewed by human:   pending
Scope            PASS
Technology       PASS
Architecture     PASS WITH APPROVAL GATE
Repository       PASS
Integrations     PASS
Contracts        PASS
Dependencies     PASS
Build            PASS         Command: npm install && npm run build     Verified: yes; large chunk warning
Testing          PASS         Vitest and pytest focused tests verified; broader suites pending
Implementation   IN PROGRESS Phase 0 baseline boundaries established

Patterns flagged UNFAMILIAR:  WebGL/raycasting, schema migration, OIDC/JWT, signed URLs, CDN invalidation, revision control, IndexedDB recovery
/learn runs completed:        0
Unresolved decisions:         MVP trigger/action vocabulary, visitor movement model, CI automation, performance targets
Architectural risks:          custom gizmo mathematics, preview/published parity, persistence recovery, access isolation
Required human decisions:     approve skeleton; confirm product movement/interaction decisions
Non-obvious tradeoffs:        FastAPI API with TypeScript client contracts; JSON project versions in PostgreSQL; binary media in object storage; local backup before server sync

BASELINE READINESS: PARTIAL; HUMAN APPROVAL AND BROADER TEST COVERAGE STILL REQUIRED
```
