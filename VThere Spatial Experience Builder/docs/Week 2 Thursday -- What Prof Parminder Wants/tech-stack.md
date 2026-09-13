# VThere Spatial Experience Builder â€” Technology Stack

**Stage:** 2 of 5
**Reads:** `UNDATED--FOUNDATION--project-scope.md`, existing Vite/React/Three.js scaffold
**Status:** Resolved proposal for human approval

## 1. Technology Overview

The proposed stack is a browser-first TypeScript application using React for authoring UI, Vite for development/build orchestration, and Three.js for the custom spatial viewport and authoring mathematics.

- **REQUIRED â€” Browser client:** authoring editor and visitor runtime.
- **REQUIRED â€” Shared TypeScript domain package:** canonical project model, serialization types, validation, interaction definitions, and runtime/editor contracts.
- **REQUIRED â€” Backend services:** persistence, project retrieval, publishing, access control, asset metadata/storage, and analytics.
- **REQUIRED â€” Custom authoring systems:** selection, raycasting, transform manipulation, serialization, interaction dispatch, and undo/redo. A ready-made editor framework must not provide these core systems.
- **REQUIRED â€” Persistence as a build factor:** every phase must preserve command history correctness, canonical serialization, autosave truthfulness, backup recovery, revision safety, and immutable published versions.

## 2. Programming Languages

- **REQUIRED â€” TypeScript:** browser application, shared domain model, editor, runtime, and initial API boundary types.
- **OPTIONAL â€” SQL:** only if a relational persistence service is selected.
- **REQUIRED â€” Backend language:** Python 3.12 for the API. It is already used elsewhere in this repository family and has mature HTTP, validation, database, and test tooling.

## 3. Frameworks

- **REQUIRED â€” React:** editor and runtime UI composition. The current scaffold uses React.
- **REQUIRED â€” Vite:** browser development server and production bundling. The current scaffold uses Vite.
- **REQUIRED â€” Backend framework:** FastAPI 0.115.x for typed HTTP APIs and generated OpenAPI documentation.

## 4. Libraries

- **REQUIRED â€” Three.js:** browser 3D rendering, camera, geometry, materials, scene graph primitives, and raycaster utilities. Custom selection constraints, gizmo mathematics, transform commands, and serialization remain project-owned.
- **REQUIRED â€” React DOM:** browser mounting and UI rendering.
- **OPTIONAL â€” Schema validation library:** select only after the project document contract is designed; do not add one merely for convenience.
- **REQUIRED â€” Frontend test runner:** Vitest for shared TypeScript/domain unit tests.
- **REQUIRED â€” Browser automation:** Playwright for editor, preview, publish, and mobile viewport workflows.
- **REQUIRED â€” Backend test runner:** pytest with HTTPX test client for API tests.
- **FORBIDDEN â€” Ready-made spatial editor framework:** must not supply the project's gizmos, scene serialization, or interaction engine.

## 5. Runtime Environment

- **REQUIRED â€” Modern browser:** WebGL-capable browser for editor and visitor runtime.
- **REQUIRED â€” Node.js LTS:** local development, dependency installation, type checking, and Vite build.
- **REQUIRED â€” Production API runtime:** Uvicorn behind a managed HTTPS reverse proxy/load balancer.
- **REQUIRED â€” Browser storage for prototype only:** current scaffold uses `localStorage` for a local draft; this is not the final multi-user persistence solution.

## 6. Build System

- **REQUIRED â€” Vite:** development server and production client build.
- **REQUIRED â€” TypeScript compiler:** strict type checking through project references.
- **REQUIRED â€” npm scripts:** canonical local entry points are `npm install`, `npm run dev`, and `npm run build` in the VThere folder.
- **REQUIRED â€” Backend build:** `python -m pytest` for tests and `uvicorn app.main:app --reload` for local API development.

## 7. Package / Dependency Management

- **REQUIRED â€” npm:** dependency installation and script execution for the current scaffold.
- **REQUIRED â€” Lockfile:** `package-lock.json` must be committed once dependencies are installed and reviewed.
- **REQUIRED â€” Explicit versions:** replace `latest` dependency ranges before baseline approval; every production dependency needs a reviewed major/minor constraint.
- **FORBIDDEN â€” Unreviewed convenience dependencies:** no package is added without a responsibility, version constraint, and security/maintenance justification.

## 8. Frontend Stack

- **REQUIRED â€” React + TypeScript:** editor shell, panels, scene tree, inspector, interaction builder, and runtime presentation UI.
- **REQUIRED â€” Three.js:** viewport rendering, camera, scene objects, raycasting, and visual transform tooling.
- **REQUIRED â€” CSS:** responsive browser UI styling; current scaffold uses a local stylesheet rather than a UI framework.
- **REQUIRED â€” Shared project representation:** editor and runtime import the same typed project contract and serializer behavior.
- **REQUIRED â€” Draft persistence adapter:** browser drafts use a primary record plus a last-known-good backup during the technical spike; production synchronization uses versioned API writes.
- **OPTIONAL â€” UI component library:** not selected; avoid adding one until the authoring interaction language is agreed.

## 9. Backend Stack

- **REQUIRED â€” HTTP API:** project creation/open/save, asset metadata, publishing, access checks, and analytics ingestion.
- **REQUIRED â€” Authentication/access boundary:** Auth0 using OIDC Authorization Code + PKCE for browser login; FastAPI validates JWT access tokens and enforces organisation/project ownership.
- **REQUIRED â€” API framework:** FastAPI with Pydantic v2 request/response models.
- **REQUIRED â€” API deployment model:** containerized FastAPI service deployed behind HTTPS; Docker Compose provides local PostgreSQL and object storage.

## 10. Database / Storage

- **REQUIRED â€” Durable project storage:** published and editable project documents must survive browser/device changes.
- **REQUIRED â€” Asset storage:** media and approved asset references need a durable storage path or approved asset service.
- **REQUIRED â€” Analytics storage:** visit, time, hotspot, and scene-reached events require durable storage for the supported reporting workflow.
- **REQUIRED â€” Database technology:** PostgreSQL 16 for users, organisations, projects, project versions, publication metadata, and analytics summaries.
- **REQUIRED â€” Database access:** SQLAlchemy 2.x with Alembic migrations and explicit transaction boundaries.
- **REQUIRED â€” Object storage:** S3-compatible storage for GLB, image, audio, and video objects. MinIO is the local development implementation; Amazon S3 or Cloudflare R2 is the production-compatible choice.
- **UNDEFINED â€” Media limits and retention:** unresolved in scope and must be decided before storage selection.
- **OPTIONAL â€” `localStorage`:** valid for the local technical spike only; forbidden as the final shared persistence mechanism.

## 11. Networking / Communication

- **REQUIRED â€” HTTPS:** all deployed editor, API, asset, and published-runtime communication.
- **REQUIRED â€” JSON over HTTP:** project DTOs, API requests/responses, publishing metadata, and analytics event payloads.
- **REQUIRED â€” Versioned project schema:** the canonical project document must include a schema version and migration policy.
- **REQUIRED â€” REST route shape:** resource-oriented HTTPS JSON API documented by FastAPI OpenAPI; exact paths belong in `UNDATED--FOUNDATION--contracts.md` in this folder.
- **UNDEFINED â€” Real-time transport:** no current requirement for collaboration, so WebSocket/WebRTC is not part of baseline.
- **FORBIDDEN â€” Client trust of authorisation:** the browser must not be the authority for project ownership or access control.

## 12. Rendering / Engine / Graphics Stack

- **REQUIRED â€” WebGL through Three.js:** browser 3D rendering for the editor and visitor runtime.
- **REQUIRED â€” Custom transform interaction:** project-owned screen-space hit testing, axis/plane constraints, dragging, snapping policy, and local/world transform policy.
- **REQUIRED â€” Raycasting:** click selection and visitor interaction detection.
- **REQUIRED â€” Responsive camera/render sizing:** viewport and runtime must support desktop and phone layouts.
- **UNDEFINED â€” WebGL2/WebGPU policy:** choose based on target browser/device support; do not assume WebGPU for the MVP.
- **FORBIDDEN â€” VR/WebXR:** outside MVP.

## 13. Cloud / Infrastructure

- **REQUIRED â€” Hosting provider:** Google Cloud Run for the containerized API and Firebase Hosting for static browser bundles in the reference deployment.
- **REQUIRED â€” Static client hosting:** editor and visitor bundles need a stable HTTPS origin.
- **REQUIRED â€” API hosting:** project and publishing services need a reachable HTTPS endpoint.
- **REQUIRED â€” Durable asset/project storage:** data must not depend on a developer machine or browser cache.
- **REQUIRED â€” Environment configuration:** API URLs, storage endpoints, and authentication configuration must be injected per environment rather than hardcoded.
- **REQUIRED â€” CDN:** Google Cloud CDN in the reference deployment, with signed/private asset URLs where access is restricted.
- **REQUIRED â€” Production object storage:** Google Cloud Storage for assets and published immutable project documents; its S3-compatible local analogue is MinIO.
- **REQUIRED â€” Local infrastructure:** Docker Compose with PostgreSQL and MinIO.
- **REQUIRED â€” Secrets:** environment variables supplied by the deployment platform; never committed.

## 14. Testing Technologies

- **REQUIRED â€” TypeScript build/type check:** catches contract and module errors.
- **REQUIRED â€” Unit tests:** shared project model, serialization/migrations, validators, interaction dispatch, and transform mathematics.
- **REQUIRED â€” Persistence tests:** undo/redo timeline, canonical round trips, corrupt-draft recovery, autosave failure states, retry behavior, revision conflicts, and published snapshot immutability.
- **REQUIRED â€” Browser integration tests:** editor placement, selection, transform, save/load, and preview workflows.
- **REQUIRED â€” Runtime parity tests:** the same project fixture must be exercised by preview and published-runtime paths.
- **REQUIRED â€” Device/browser checks:** phone viewport and modest-hardware rendering scenario from the scope.
- **REQUIRED â€” Test runner and browser automation:** Vitest, Playwright, pytest, and HTTPX as described above.

## 15. Development Tools

- **REQUIRED â€” VS Code:** repository editing and team workflow.
- **REQUIRED â€” Git:** version control and review.
- **REQUIRED â€” npm:** dependency and script management.
- **REQUIRED â€” Browser developer tools:** WebGL, network, storage, and performance inspection.
- **REQUIRED â€” Jira and Scrum:** mandated project-management and grading evidence process.
- **OPTIONAL â€” Docker:** use only if the approved backend/deployment plan benefits from reproducible local services.

## 16. Platform Support

- **REQUIRED â€” Desktop browser authoring:** primary editor target.
- **REQUIRED â€” Mobile browser viewing:** published visitor target.
- **REQUIRED â€” Three-year-old school laptop scenario:** must be included in performance validation.
- **UNDEFINED â€” Exact browser/version matrix:** requires a product decision before compatibility claims are made.
- **FORBIDDEN â€” Native mobile application:** outside MVP.

## 17. Version Constraints

- **REQUIRED â€” Node.js:** LTS release selected and documented before baseline.
- **REQUIRED â€” TypeScript:** one repository-wide compiler major version.
- **REQUIRED â€” React/React DOM:** matching major versions.
- **REQUIRED â€” Vite and its React plugin:** compatible versions pinned together.
- **REQUIRED â€” Three.js and type declarations:** compatible versions pinned together.
- **REQUIRED â€” Lockfile:** exact resolved dependency graph committed.
- **BLOCKER â€” The environment has no Node/npm available, so the pinned versions and build cannot yet be verified.**

## 18. Dependency Constraints

- **REQUIRED â€” Shared domain code must not depend on React UI.**
- **REQUIRED â€” Runtime must not import editor-only controls or editing commands.**
- **REQUIRED â€” Backend must not own browser rendering or gizmo mathematics.**
- **REQUIRED â€” Three.js is a rendering dependency, not the project persistence contract.**
- **REQUIRED â€” Every dependency must be license-compatible with the project and recorded in the lockfile.**
- **FORBIDDEN â€” Dependency on a full editor framework that replaces the custom technical component.**

## 19. Integration Decisions

| Producer | Consumer | Protocol / API | Data format | Direction | Required dependency | Configuration requirement |
|---|---|---|---|---|---|---|
| Editor UI | Shared project model | In-process TypeScript API | Typed project objects | Editor â†’ shared core | Shared package | Import boundary prevents UI ownership of persistence |
| Editor / runtime | Three.js renderer | In-process library API | Scene objects, transforms, vectors, rays | Client â†’ renderer | Three.js | WebGL-capable browser |
| Editor client | Project API | HTTPS JSON API | Versioned project DTOs | Bidirectional | Backend decision | API base URL and auth configuration |
| Runtime client | Published project service | HTTPS JSON API/static asset fetch | Published project JSON and asset references | Service â†’ runtime | Hosting/storage decision | Public/unlisted/authenticated access policy |
| Runtime client | Analytics API | HTTPS JSON API | Versioned analytics events | Runtime â†’ service | Backend decision | Event endpoint and privacy policy |
| Asset service | Editor/runtime | HTTPS asset fetch | Curated asset metadata and media | Service â†’ client | Storage/hosting decision | Asset URL and cache policy |

## 20. Explicitly Forbidden Technologies or Approaches

- **FORBIDDEN â€” Ready-made editor frameworks** that provide gizmos, scene serialization, or the interaction engine.
- **FORBIDDEN â€” Separate editor and runtime project schemas.**
- **FORBIDDEN â€” Browser-only `localStorage` as final persistence.**
- **FORBIDDEN â€” Client-side-only authorization or project isolation.**
- **FORBIDDEN â€” WebSockets/WebRTC for MVP collaboration.**
- **FORBIDDEN â€” WebXR, native mobile, arbitrary model conversion, mesh editing, scripting, and billing infrastructure.**
- **FORBIDDEN â€” Unpinned `latest` dependencies at baseline release.**

## 21. Technology Risks

- **HIGH â€” Cloud deployment and identity configuration:** provider setup, token validation, and signed asset URLs must be tested before publication is trusted.
- **HIGH â€” Undefined browser/device matrix:** may change rendering API, asset budgets, and input strategy.
- **HIGH â€” Three.js custom gizmo mathematics:** camera-angle degeneracies, screen-space hit testing, and transform correctness are technically risky.
- **HIGH â€” Preview/published parity:** separate execution paths can diverge unless they consume the same project and interaction core.
- **MEDIUM â€” Unbounded media/assets:** large files can break load time and modest-hardware performance.
- **MEDIUM â€” Authentication and project isolation:** configuration and authorization tests are acceptance-critical even though the provider is selected.

## 22. Unresolved Technology Decisions

- **UNDEFINED â€” Exact CI provider and deployment pipeline implementation:** the production hosting targets are selected, but automation remains to be configured.
- **REQUIRED â€” Browser baseline:** Chromium-based desktop browsers current minus two major versions for authoring; Safari iOS 17+ and Chromium Android current minus two for visitor viewing. WebGL2 is the MVP target; WebGPU is not required.
- **UNDEFINED â€” Exact trigger/action vocabulary and visitor movement model.**
- **REQUIRED â€” Dependency lockfile generation:** run npm after Node.js installation and commit the resulting `package-lock.json`.

## 23. Build & Verification Command

### Frontend target

```text
Target:    frontend/editor and runtime client
Command:   npm install
Verified:  no â€” Node.js/npm is not installed or discoverable in the current Windows environment.

Target:    frontend/editor and runtime client
Command:   npm run build
Verified:  no â€” prerequisite installation could not run; the command remains the intended check, not a verified result.
```

The commands are recorded because they are the project scripts in the existing scaffold. Before Stage 4, install Node.js 22 LTS, generate `package-lock.json`, run both commands, and paste the actual output here.

Backend commands: `python -m pytest` and `uvicorn app.main:app --reload`; the backend does not exist yet, so these remain unverified until its baseline is generated.

## Closing

```text
TECH STACK STATUS: BLOCKED

Mechanisms flagged UNFAMILIAR:   browser rendering, raycasting, schema migration, authentication, durable object storage, and CDN cache invalidation require `/learn` review if the team cannot explain them
/learn runs completed:           0
Build command verified:          no â€” Node.js/npm unavailable
Unresolved decisions:            CI/deployment automation, trigger/action vocabulary, movement model, and lockfile verification
Recommended next step:            Human approval of this resolved stack direction, then Stage 3 architecture skeleton and installation verification
```
