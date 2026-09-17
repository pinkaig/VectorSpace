# VThere Spatial Experience Builder — Session Handoff

## Objective / topic

Two parallel workstreams (Week 3):
- **Phase 2 command-path slice:** Team owns custom gizmo build; this thread stays open for when the gizmo integration needs the move/rotate/scale command history wired up.
- **Full-stack infrastructure skeleton:** Tech lead effort to scaffold the complete architecture (frontend → backend → persistence → storage → deployment) with real plumbing and skeleton business logic, so the team can build on top of working infrastructure instead of hitting missing pieces at each phase.

## Decisions made and why

- Browser editor/runtime: React + TypeScript + Vite + Three.js, because the brief requires a browser-based 3D authoring tool and visitor runtime.
- Backend: Python 3.12 + FastAPI + Pydantic v2, reusing the repository family's Python direction and providing typed HTTP/OpenAPI contracts.
- Persistence: PostgreSQL 16 with SQLAlchemy 2/Alembic for structured project/version metadata; Google Cloud Storage for production media/project assets; MinIO locally.
- Delivery: Google Cloud Run, Firebase Hosting, and Google Cloud CDN as the reference deployment; exact CI provider remains open.
- Access: Auth0 OIDC Authorization Code + PKCE for browser login; API-side JWT validation and server-side organisation/project authorization.
- Testing: Vitest, Playwright, pytest, and HTTPX.
- Custom technical component: standalone framework-agnostic `packages/authoring-engine/` owning gizmo hit testing, transform constraints, selection sessions, command grouping, undo/redo, and persistence checkpoints. It must not own React, rendering, HTTP, storage, or runtime behavior.
- Persistence is release-blocking: canonical versioned serialization, undo/redo continuity, debounced autosave, last-known-good backup recovery, truthful failure states, revision conflict protection, and immutable published snapshots.
- Debugging uses a framework-agnostic TypeScript logger with levels, redaction, child namespaces, and injectable test sinks; the FastAPI API logs request IDs, duration, status, and exception traces.
- Environment setup uses PowerShell, Bash, and Node preflight checks instead of CMake because the stack is Vite/React/TypeScript plus Python/FastAPI, not native C/C++.

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
- Engineering guidance exists in `docs/DEVELOPMENT_GUIDE.md`, `docs/ENGINEERING_PRACTICES.md`, `docs/DEBUGGING.md`, and `docs/ENVIRONMENT_SETUP.md`.
- The root `package.json` has Node/npm engine requirements, `check:environment`, `predev`, and `prebuild` scripts. The root `package-lock.json` exists after dependency installation.

## Build / verify command and status

From `VThere Spatial Experience Builder/`:

```text
npm.cmd install
npm.cmd run check:environment
npm.cmd test
npm.cmd run build
python -m pytest apps/api/tests -q
python -m uvicorn apps.api.app.main:app --reload --port 8000
```

Current status: **partially implemented, verified locally**. Node.js 24.19.0, npm 11.17.0, and Python 3.12.10 are available. The environment check, frontend tests, production build, and API health test pass. The build still reports a Vite chunk-size warning and the API test reports a Starlette deprecation warning. Browser tests, full backend integration tests, and the planned app move remain outstanding.

## Files touched in the DOCX audit session

- `docs/source-brief-audit.md`
- `docs/asset-library-contract.md`
- `docs/roles-and-delivery.md`
- `docs/pilot-and-conduct.md`
- `docs/contracts.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/pre-baseline-validation.md`
- `SESSION.md`

## Files touched for baseline, debugging, and setup

- `package.json`
- `package-lock.json`
- `scripts/check-environment.mjs`
- `scripts/check-environment.ps1`
- `scripts/check-environment.sh`
- `packages/project/package.json`
- `packages/project/src/index.ts`
- `packages/authoring-engine/package.json`
- `packages/authoring-engine/src/index.ts`
- `packages/authoring-engine/src/index.test.ts`
- `packages/debugging/package.json`
- `packages/debugging/src/index.ts`
- `packages/debugging/src/index.test.ts`
- `src/model.ts`
- `src/serializer.ts`
- `apps/api/app/main.py`
- `apps/api/requirements.txt`
- `apps/api/tests/test_health.py`
- `apps/runtime/README.md`
- `docs/DEVELOPMENT_GUIDE.md`
- `docs/DEBUGGING.md`
- `docs/ENGINEERING_PRACTICES.md`
- `docs/ENVIRONMENT_SETUP.md`
- `docs/architecture.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/pre-baseline-validation.md`
- `README.md`

Earlier implementation/design files remain in the folder as described above.

## Failed approaches already tried

- Attempted `npm install` and build verification; failed because `npm`/Node.js was not installed or discoverable on Windows.
- Installing Node.js through winget initially required an administrator prompt; the first installation attempt was cancelled, then the runtime was installed successfully.
- PowerShell's `npm.ps1` execution policy blocked plain `npm`; project commands should use `npm.cmd` on Windows.
- The first Node preflight implementation attempted to execute `npm`/`npm.cmd` as a child process and failed on Windows path/shim behavior. It now invokes npm's CLI JavaScript through the active Node executable and passes.
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
- Whether to add Playwright and broader API/integration tests in the next baseline slice.

## Week 3 Parallel Efforts

### Workstream 1: Phase 2 command-path slice (Team gizmo owner)

**Current:** Custom gizmo implementation in progress (move/rotate/scale interactions, handles, visual feedback).  
**Status:** Open and independent until gizmo is ready to wire into the backend command service.  
**Next:** After infrastructure skeleton Stage 1–2 complete, the gizmo will receive the command service endpoint definition and can wire drag sessions into move/rotate/scale commands.

### Workstream 2: Full-stack infrastructure skeleton (Tech lead)

**Plan:** Committed to `docs/07-research-and-history/2026-09-17--PLAN--full-stack-infrastructure-skeleton.md` (expanded 2026-09-17 to include full content/component/media architecture).

**Decisions made:**
- Scope expanded after reading project-scope.md to include content attachment requirements (text/image/audio/video components).
- Content architecture: `SceneObject.components[]`, `MediaAsset` table, `ContentSnapshot` for immutable publishing, signed URLs.
- Interaction engine includes content actions: `showPanel`, `playAudio`.
- MediaRepository service enforces access control (two actors cannot see each other's media).
- Editor UI for content attachment and runtime presentation UI are NOT in skeleton (team-owned work).

**Principle:** Infrastructure (Docker, DB, routes, storage) is real and working. Domain logic (repos, services, dispatch) is skeleton (signature + NotImplementedError).

**Subsystems covered in skeleton:**
- Backend persistence (ProjectRepository, ProjectVersion, revision safety)
- Backend API surface (routers, Pydantic models, auth boundary)
- Content components (text/image/audio/video types, SceneObject.components)
- Media storage & signing (MediaAsset, presigned URLs, S3/MinIO, versioning)
- Publishing & access (PublishingService, ContentSnapshot, immutability invariant, isolation)
- Interaction engine (WHEN→DO dispatch, content actions, zone-entry-once, ordering)
- Deployment (Docker/Compose/Caddy/Actions, VM provisioning)

**Stages (each verified before next):**
1. Local infra: Docker Compose, `.env`, config, DB setup, Alembic init, MinIO for media storage
2. Data model: `models.py` with Organisation, Actor, Project, ProjectVersion, MediaAsset, ContentSnapshot, AnalyticsEvent + migration
3. Backend HTTP + services: routers (projects, media, publish, analytics) + repositories + services + docs
4. `packages/interaction` + `packages/components`: types and skeleton dispatch + docs
5. Production deploy: Dockerfiles, Caddy, Actions, `deployment.md`

**Log:** Progress recorded in `docs/07-research-and-history/2026-09-17--SKELETON--full-stack-infrastructure-log.md` after each stage completes.

**Next:** Tech lead begins Stage 1 (local infrastructure).
