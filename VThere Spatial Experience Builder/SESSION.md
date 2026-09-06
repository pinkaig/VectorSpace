# VThere Spatial Experience Builder — Session Handoff

## Objective / topic

Design and prepare the VThere Spatial Experience Builder for Stage 4 baseline implementation using the DigiPen project brief, the five-stage Agent Skills workflow, and the existing browser editor prototype.

## Decisions made and why

- Browser editor/runtime: React + TypeScript + Vite + Three.js, because the brief requires a browser-based 3D authoring tool and visitor runtime.
- Backend: Python 3.12 + FastAPI + Pydantic v2, reusing the repository family's Python direction and providing typed HTTP/OpenAPI contracts.
- Persistence: PostgreSQL 16 with SQLAlchemy 2/Alembic for structured project/version metadata; Google Cloud Storage for production media/project assets; MinIO locally.
- Delivery: Google Cloud Run, Firebase Hosting, and Google Cloud CDN as the reference deployment; exact CI provider remains open.
- Access: Auth0 OIDC Authorization Code + PKCE for browser login; API-side JWT validation and server-side organisation/project authorization.
- Testing: Vitest, Playwright, pytest, and HTTPX.
- Custom technical component: standalone framework-agnostic `packages/authoring-engine/` owning gizmo hit testing, transform constraints, selection sessions, command grouping, undo/redo, and persistence checkpoints. It must not own React, rendering, HTTP, storage, or runtime behavior.
- Persistence is release-blocking: canonical versioned serialization, undo/redo continuity, debounced autosave, last-known-good backup recovery, truthful failure states, revision conflict protection, and immutable published snapshots.

## Current skeleton / plan state

- Stage 1 scope document exists at `projectscope.md`.
- Stage 2 stack document exists at `techstack.md` with pinned frontend dependency versions and resolved backend/storage/auth/testing direction.
- Stage 3 architecture package exists:
  - `docs/PROJECT_CONTEXT.md`
  - `docs/architecture.md`
  - `docs/repository.md`
  - `docs/contracts.md`
  - `docs/build-system.md`
  - `docs/testing-strategy.md`
  - `docs/implementation-plan.md`
  - `docs/pre-baseline-validation.md`
  - `docs/subsystems/authoring-engine.md`
  - `docs/asset-library-contract.md`
  - `docs/roles-and-delivery.md`
  - `docs/pilot-and-conduct.md`
  - `docs/source-brief-audit.md`
- Existing prototype has a React/Three.js editor with scene tree, primitive asset placement, viewport selection/dragging, inspector, undo/redo, JSON export, local draft persistence, debounced autosave, backup recovery, and truthful storage failure status.
- Architecture is aligned with the DOCX core plan. Stage 4 Phase 0 has started: the canonical project package, standalone authoring-engine command timeline, API health route, and first isolated tests now exist. The current `src/` editor remains the temporary UI surface until a verified package-aware build allows the app move.

## Build / verify command and status

From `VThere Spatial Experience Builder/`:

```text
npm install
npm run build
npm run dev
python -m pytest
uvicorn app.main:app --reload
```

Current status: **partially implemented, verified locally**. Node.js 24.19.0, npm 11.17.0, and Python 3.12.10 are available. `npm install`, `npm run build`, the isolated authoring-engine test, API dependency installation, and the API health test pass. Browser tests, full backend integration tests, and the planned app move remain outstanding.

## Files touched in the DOCX audit session

- `docs/source-brief-audit.md`
- `docs/asset-library-contract.md`
- `docs/roles-and-delivery.md`
- `docs/pilot-and-conduct.md`
- `docs/contracts.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/pre-baseline-validation.md`
- `SESSION.md`

Earlier implementation/design files remain in the folder as described above.

## Failed approaches already tried

- Attempted `npm install` and build verification; failed because `npm`/Node.js was not installed or discoverable on Windows.
- Initial broad Stage 3 review omitted the formal validation block, per-phase verification commands, and testing-strategy document; these were added before this handoff.
- Temporary DOCX extraction was used for audit search and then removed; no extracted review artifact remains in the topic folder.

## Open questions

- Human approval of the Stage 3 skeleton and scope/stack documents.
- Exact approved MVP six-trigger/six-action vocabulary.
- Visitor movement model: free first-person, camera-point navigation, or both.
- Approved two-to-four environments and approximately 20–30 GLB asset inventory, licensing, scale, pivots, and budgets.
- Exact browser/device performance targets, including iPad/tablet editing feasibility.
- Official DigiPen Milestone 3 date and complete calendar.
- Final team roster, Jira ownership, mentor slot, and 80% team / 20% individual evidence process.
- Pilot consent/safeguarding requirements, NDA, IP/reuse/publication terms, analytics privacy, and final handoff terms.
- CI/deployment automation provider.

## Next recommended step

Obtain human approval of the Stage 3 skeleton and resolve the product/brief decisions above. Next, move the verified editor into `apps/editor/`, preserve the shared project and authoring-engine imports, then add persistence round-trip tests before implementing further runtime/API phases.
