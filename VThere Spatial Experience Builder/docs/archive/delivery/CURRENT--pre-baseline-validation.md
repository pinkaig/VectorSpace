# Pre-Baseline Validation

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

**Status:** All 8 baseline stages are now complete (see `docs/code/baseline-phases.md`, commits `0ad9c20`..`8831960`). This document originally gated the *start* of baseline implementation; it is kept here as the pre-implementation checklist that was passed, with the "Implementation" row updated to reflect where things actually landed. It is not a post-baseline audit — see `2026-09-10--CURRENT--deliverables.md` for current per-epic status.

| Check | Status | Evidence / blocker |
|---|---|---|
| Scope | PASS | `../product/FOUNDATION--project-scope.md` defines required, optional, future, undefined, and forbidden scope. |
| Technology | PASS | `../../code/architecture/FOUNDATION--tech-stack.md` selects the browser, API, database, storage, auth, CDN, and test tools; Node.js, npm, and Python are now installed and verified. |
| Architecture | PASS WITH APPROVAL GATE | `../../code/architecture/FOUNDATION--architecture.md` defines Editor, Shared, Runtime, Infrastructure, persistence invariants, and standalone `AuthoringEngine`. |
| Repository | PASS | `../../code/architecture/FOUNDATION--repository.md` classifies fixed, extensible, generated, and optional boundaries. |
| Integrations | PASS | `../../code/architecture/FOUNDATION--contracts.md` and `../../code/architecture/FOUNDATION--architecture.md` define client/API, storage, CDN, auth, analytics, and project-data flow. |
| Contracts | PASS | Versioned project JSON, API resources, interaction events/actions, errors, and signed asset URLs are documented. |
| Dependencies | PASS | Direction is UI/apps -> shared packages; shared packages do not import UI/API/database concerns. Verified still true post-baseline: `packages/assets`, `packages/interaction`, and `packages/sync` remain framework-free and are consumed by `src/` and `apps/*`, not the reverse. |
| Build | PASS WITH WARNING | `npm install` and `npm run build` pass; Vite reports a large production chunk warning. |
| Testing | PASS WITH WARNING | Vitest and the API health pytest pass; browser coverage is now one Playwright smoke spec (`tests/e2e/smoke.spec.ts`); full backend integration suites (beyond `/health`) still remain pending because the API's business-logic handlers are unimplemented. |
| Implementation | BASELINE COMPLETE | All 8 stages landed: local dev environment, data model + migrations, backend HTTP surface (real auth/storage, but handler bodies are still `501` skeletons), `packages/assets`, `packages/interaction`, `packages/sync`, production deploy scaffolding, and all three wired into the editor/runtime (`src/viewport/assetResolution.ts`, `src/viewport/interactionController.ts`, `src/sync/projectSync.ts`). Project persistence beyond localStorage, real runtime/editor app separation, and full backend business logic are the next slice, not part of this baseline. |

## Required human decisions

The Stage 3 skeleton was approved and the baseline was implemented on top of it (Stages 1-8 complete). These decisions were open going into the baseline; most remain open going into the *next* slice (real backend business logic, full editor/runtime app separation):

- ~~Approve the Stage 3 skeleton before baseline implementation.~~ Approved; Stage 3 landed real routing/auth/storage with `501` placeholder handler bodies, by design, per `docs/code/baseline-phases.md`.
- Confirm the exact MVP trigger/action vocabulary and visitor movement model. `packages/interaction` now implements dispatch/actions/zone-tracking, but this was an engineering judgment call, not a confirmed product decision.
- Confirm the target browser/device matrix and quantitative performance targets. Still open — only one Playwright smoke spec exists.
- Keep the verified Node.js/npm and Python toolchain available for development.
- Confirm the Google Cloud/Auth0 deployment direction or record an approved replacement. Auth0/JWT auth is implemented in `apps/api/app/auth.py`; Google Cloud Storage/CDN direction for production is still unverified against a live deployment.
- Approve the six-trigger/six-action vocabulary, visitor movement model, project lifecycle states, and supplied asset/environment inventory.
- Confirm roles, mentor schedule, pilot safeguards, NDA/IP terms, and final handoff requirements.

## Patterns flagged unfamiliar

Browser WebGL/raycasting, schema migration, OIDC/JWT validation, object-storage signed URLs, CDN cache invalidation, optimistic revision control, and IndexedDB/local draft recovery require `/learn` review if the team cannot explain their call flow. No `/learn` runs have been recorded.

## Pre-baseline answers

- Can the repository represent the architecture? **YES, CONFIRMED.** `apps/api`, `apps/editor`, `apps/runtime`, and `packages/{project,authoring-engine,assets,interaction,sync,debugging}` all now exist on disk, not just in plan.
- Can selected technologies coexist? **YES**, subject to pinned dependency installation and API contract generation.
- Are dependency directions valid and acyclic? **YES**, by the documented boundary rules, and still true post-baseline (shared packages remain framework-free).
- Can the baseline build and run without future functionality? **YES; frontend build and focused tests verified**, and the API now boots with `/health` plus five real-but-`501` routers.
- Can each subsystem be implemented independently? **YES, CONFIRMED.** `packages/assets`, `packages/interaction`, and `packages/sync` were each built and unit-tested as standalone packages before being wired into `src/`.
- Can a new agent understand one subsystem without reading the whole project? **YES**, via the standalone subsystem docs in `docs/code/subsystems/` (`asset-manager.md`, `when-do-dispatch-engine.md`, `sync-engine.md`, `authoring-engine.md`, `viewport.md`).
- Can the baseline be extended without restructuring? **YES, CONFIRMED BY THE BASELINE ITSELF** — Stages 6-8 wired three independently-built packages into the existing editor/runtime without restructuring `src/`. The next slice (real API business logic) is expected to follow the same pattern.

```text
# Pre-Baseline Validation

STATUS: BASELINE COMPLETE (all 8 stages; see docs/code/baseline-phases.md)

Skeleton reviewed by human:   approved
Scope            PASS
Technology       PASS
Architecture     PASS WITH APPROVAL GATE
Repository       PASS
Integrations     PASS
Contracts        PASS
Dependencies     PASS
Build            PASS         Command: npm install && npm run build     Verified: yes; large chunk warning
Testing          PASS         Vitest, pytest health test, and one Playwright smoke spec verified; broader API/integration suites still pending
Implementation   BASELINE COMPLETE   All 8 stages landed: data model, backend HTTP surface (real auth/storage, 501 business-logic handlers), assets/interaction/sync packages, production deploy scaffold, and all three wired into editor/runtime

Patterns flagged UNFAMILIAR:  WebGL/raycasting, schema migration, OIDC/JWT, signed URLs, CDN invalidation, revision control, IndexedDB recovery
/learn runs completed:        0
Unresolved decisions:         CI automation, quantitative performance targets, backend business-logic implementation, production Google Cloud/CDN verification
Architectural risks:          custom gizmo mathematics, preview/published parity, persistence recovery, access isolation
Required human decisions:     confirm remaining product movement/interaction decisions; approve moving API handlers from 501 skeletons to real persistence
Non-obvious tradeoffs:        FastAPI API with TypeScript client contracts; JSON project versions in PostgreSQL; binary media in object storage; local backup before server sync (still true: client-side sync uses a stub transport pending real API persistence)

BASELINE READINESS: BASELINE COMPLETE; NEXT SLICE IS REAL API PERSISTENCE (routers are still 501) AND BROADER TEST COVERAGE
```
