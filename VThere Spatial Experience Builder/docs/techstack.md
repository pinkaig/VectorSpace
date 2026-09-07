# VThere Spatial Experience Builder — Technology Stack

**Stage:** 2 of 5
**Reads:** `projectscope.md`, existing Vite/React/Three.js scaffold
**Status:** Resolved proposal for human approval

## 1. Technology Overview

The proposed stack is a browser-first TypeScript application using React for authoring UI, Vite for development/build orchestration, and Three.js for the custom spatial viewport and authoring mathematics.

- **REQUIRED — Browser client:** authoring editor and visitor runtime.
- **REQUIRED — Shared TypeScript domain package:** canonical project model, serialization types, validation, interaction definitions, and runtime/editor contracts.
- **REQUIRED — Backend services:** persistence, project retrieval, publishing, access control, asset metadata/storage, and analytics.
- **REQUIRED — Custom authoring systems:** selection, raycasting, transform manipulation, serialization, interaction dispatch, and undo/redo. A ready-made editor framework must not provide these core systems.
- **REQUIRED — Persistence as a build factor:** every phase must preserve command history correctness, canonical serialization, autosave truthfulness, backup recovery, revision safety, and immutable published versions.

## 2. Programming Languages

- **REQUIRED — TypeScript:** browser application, shared domain model, editor, runtime, and initial API boundary types.
- **OPTIONAL — SQL:** only if a relational persistence service is selected.
- **REQUIRED — Backend language:** Python 3.12 for the API. It is already used elsewhere in this repository family and has mature HTTP, validation, database, and test tooling.

## 3. Frameworks

- **REQUIRED — React:** editor and runtime UI composition. The current scaffold uses React.
- **REQUIRED — Vite:** browser development server and production bundling. The current scaffold uses Vite.
- **REQUIRED — Backend framework:** FastAPI 0.115.x for typed HTTP APIs and generated OpenAPI documentation.

## 4. Libraries

- **REQUIRED — Three.js:** browser 3D rendering, camera, geometry, materials, scene graph primitives, and raycaster utilities. Custom selection constraints, gizmo mathematics, transform commands, and serialization remain project-owned.
- **REQUIRED — React DOM:** browser mounting and UI rendering.
- **OPTIONAL — Schema validation library:** select only after the project document contract is designed; do not add one merely for convenience.
- **REQUIRED — Frontend test runner:** Vitest for shared TypeScript/domain unit tests.
- **REQUIRED — Browser automation:** Playwright for editor, preview, publish, and mobile viewport workflows.
- **REQUIRED — Backend test runner:** pytest with HTTPX test client for API tests.
- **FORBIDDEN — Ready-made spatial editor framework:** must not supply the project's gizmos, scene serialization, or interaction engine.

## 5. Runtime Environment

- **REQUIRED — Modern browser:** WebGL-capable browser for editor and visitor runtime.
- **REQUIRED — Node.js LTS:** local development, dependency installation, type checking, and Vite build.
- **REQUIRED — Production API runtime:** Uvicorn behind a managed HTTPS reverse proxy/load balancer.
- **REQUIRED — Browser storage for prototype only:** current scaffold uses `localStorage` for a local draft; this is not the final multi-user persistence solution.

## 6. Build System

- **REQUIRED — Vite:** development server and production client build.
- **REQUIRED — TypeScript compiler:** strict type checking through project references.
- **REQUIRED — npm scripts:** canonical local entry points are `npm install`, `npm run dev`, and `npm run build` in the VThere folder.
- **REQUIRED — Backend build:** `python -m pytest` for tests and `uvicorn app.main:app --reload` for local API development.

## 7. Package / Dependency Management

- **REQUIRED — npm:** dependency installation and script execution for the current scaffold.
- **REQUIRED — Lockfile:** `package-lock.json` must be committed once dependencies are installed and reviewed.
- **REQUIRED — Explicit versions:** replace `latest` dependency ranges before baseline approval; every production dependency needs a reviewed major/minor constraint.
- **FORBIDDEN — Unreviewed convenience dependencies:** no package is added without a responsibility, version constraint, and security/maintenance justification.

## 8. Frontend Stack

- **REQUIRED — React + TypeScript:** editor shell, panels, scene tree, inspector, interaction builder, and runtime presentation UI.
- **REQUIRED — Three.js:** viewport rendering, camera, scene objects, raycasting, and visual transform tooling.
- **REQUIRED — CSS:** responsive browser UI styling; current scaffold uses a local stylesheet rather than a UI framework.
- **REQUIRED — Shared project representation:** editor and runtime import the same typed project contract and serializer behavior.
- **REQUIRED — Draft persistence adapter:** browser drafts use a primary record plus a last-known-good backup during the technical spike; production synchronization uses versioned API writes.
- **OPTIONAL — UI component library:** not selected; avoid adding one until the authoring interaction language is agreed.

## 9. Backend Stack

- **REQUIRED — HTTP API:** project creation/open/save, asset metadata, publishing, access checks, and analytics ingestion.
- **REQUIRED — Authentication/access boundary:** Auth0 using OIDC Authorization Code + PKCE for browser login; FastAPI validates JWT access tokens and enforces organisation/project ownership.
- **REQUIRED — API framework:** FastAPI with Pydantic v2 request/response models.
- **REQUIRED — API deployment model:** containerized FastAPI service deployed behind HTTPS; Docker Compose provides local PostgreSQL and object storage.

## 10. Database / Storage

- **REQUIRED — Durable project storage:** published and editable project documents must survive browser/device changes.
- **REQUIRED — Asset storage:** media and approved asset references need a durable storage path or approved asset service.
- **REQUIRED — Analytics storage:** visit, time, hotspot, and scene-reached events require durable storage for the supported reporting workflow.
- **REQUIRED — Database technology:** PostgreSQL 16 for users, organisations, projects, project versions, publication metadata, and analytics summaries.
- **REQUIRED — Database access:** SQLAlchemy 2.x with Alembic migrations and explicit transaction boundaries.
- **REQUIRED — Object storage:** S3-compatible storage for GLB, image, audio, and video objects. MinIO is the local development implementation; Amazon S3 or Cloudflare R2 is the production-compatible choice.
- **UNDEFINED — Media limits and retention:** unresolved in scope and must be decided before storage selection.
- **OPTIONAL — `localStorage`:** valid for the local technical spike only; forbidden as the final shared persistence mechanism.

## 11. Networking / Communication

- **REQUIRED — HTTPS:** all deployed editor, API, asset, and published-runtime communication.
- **REQUIRED — JSON over HTTP:** project DTOs, API requests/responses, publishing metadata, and analytics event payloads.
- **REQUIRED — Versioned project schema:** the canonical project document must include a schema version and migration policy.
- **REQUIRED — REST route shape:** resource-oriented HTTPS JSON API documented by FastAPI OpenAPI; exact paths belong in `docs/contracts.md`.
- **UNDEFINED — Real-time transport:** no current requirement for collaboration, so WebSocket/WebRTC is not part of baseline.
- **FORBIDDEN — Client trust of authorisation:** the browser must not be the authority for project ownership or access control.

## 12. Rendering / Engine / Graphics Stack

- **REQUIRED — WebGL through Three.js:** browser 3D rendering for the editor and visitor runtime.
- **REQUIRED — Custom transform interaction:** project-owned screen-space hit testing, axis/plane constraints, dragging, snapping policy, and local/world transform policy.
- **REQUIRED — Raycasting:** click selection and visitor interaction detection.
- **REQUIRED — Responsive camera/render sizing:** viewport and runtime must support desktop and phone layouts.
- **UNDEFINED — WebGL2/WebGPU policy:** choose based on target browser/device support; do not assume WebGPU for the MVP.
- **FORBIDDEN — VR/WebXR:** outside MVP.

## 13. Cloud / Infrastructure

- **REQUIRED — Hosting provider:** Google Cloud Run for the containerized API and Firebase Hosting for static browser bundles in the reference deployment.
- **REQUIRED — Static client hosting:** editor and visitor bundles need a stable HTTPS origin.
- **REQUIRED — API hosting:** project and publishing services need a reachable HTTPS endpoint.
- **REQUIRED — Durable asset/project storage:** data must not depend on a developer machine or browser cache.
- **REQUIRED — Environment configuration:** API URLs, storage endpoints, and authentication configuration must be injected per environment rather than hardcoded.
- **REQUIRED — CDN:** Google Cloud CDN in the reference deployment, with signed/private asset URLs where access is restricted.
- **REQUIRED — Production object storage:** Google Cloud Storage for assets and published immutable project documents; its S3-compatible local analogue is MinIO.
- **REQUIRED — Local infrastructure:** Docker Compose with PostgreSQL and MinIO.
- **REQUIRED — Secrets:** environment variables supplied by the deployment platform; never committed.

## 14. Testing Technologies

- **REQUIRED — TypeScript build/type check:** catches contract and module errors.
- **REQUIRED — Unit tests:** shared project model, serialization/migrations, validators, interaction dispatch, and transform mathematics.
- **REQUIRED — Persistence tests:** undo/redo timeline, canonical round trips, corrupt-draft recovery, autosave failure states, retry behavior, revision conflicts, and published snapshot immutability.
- **REQUIRED — Browser integration tests:** editor placement, selection, transform, save/load, and preview workflows.
- **REQUIRED — Runtime parity tests:** the same project fixture must be exercised by preview and published-runtime paths.
- **REQUIRED — Device/browser checks:** phone viewport and modest-hardware rendering scenario from the scope.
- **REQUIRED — Test runner and browser automation:** Vitest, Playwright, pytest, and HTTPX as described above.

## 15. Development Tools

- **REQUIRED — VS Code:** repository editing and team workflow.
- **REQUIRED — Git:** version control and review.
- **REQUIRED — npm:** dependency and script management.
- **REQUIRED — Browser developer tools:** WebGL, network, storage, and performance inspection.
- **REQUIRED — Jira and Scrum:** mandated project-management and grading evidence process.
- **OPTIONAL — Docker:** use only if the approved backend/deployment plan benefits from reproducible local services.

## 16. Platform Support

- **REQUIRED — Desktop browser authoring:** primary editor target.
- **REQUIRED — Mobile browser viewing:** published visitor target.
- **REQUIRED — Three-year-old school laptop scenario:** must be included in performance validation.
- **UNDEFINED — Exact browser/version matrix:** requires a product decision before compatibility claims are made.
- **FORBIDDEN — Native mobile application:** outside MVP.

## 17. Version Constraints

- **REQUIRED — Node.js:** LTS release selected and documented before baseline.
- **REQUIRED — TypeScript:** one repository-wide compiler major version.
- **REQUIRED — React/React DOM:** matching major versions.
- **REQUIRED — Vite and its React plugin:** compatible versions pinned together.
- **REQUIRED — Three.js and type declarations:** compatible versions pinned together.
- **REQUIRED — Lockfile:** exact resolved dependency graph committed.
- **BLOCKER — The environment has no Node/npm available, so the pinned versions and build cannot yet be verified.**

## 18. Dependency Constraints

- **REQUIRED — Shared domain code must not depend on React UI.**
- **REQUIRED — Runtime must not import editor-only controls or editing commands.**
- **REQUIRED — Backend must not own browser rendering or gizmo mathematics.**
- **REQUIRED — Three.js is a rendering dependency, not the project persistence contract.**
- **REQUIRED — Every dependency must be license-compatible with the project and recorded in the lockfile.**
- **FORBIDDEN — Dependency on a full editor framework that replaces the custom technical component.**

## 19. Integration Decisions

| Producer | Consumer | Protocol / API | Data format | Direction | Required dependency | Configuration requirement |
|---|---|---|---|---|---|---|
| Editor UI | Shared project model | In-process TypeScript API | Typed project objects | Editor → shared core | Shared package | Import boundary prevents UI ownership of persistence |
| Editor / runtime | Three.js renderer | In-process library API | Scene objects, transforms, vectors, rays | Client → renderer | Three.js | WebGL-capable browser |
| Editor client | Project API | HTTPS JSON API | Versioned project DTOs | Bidirectional | Backend decision | API base URL and auth configuration |
| Runtime client | Published project service | HTTPS JSON API/static asset fetch | Published project JSON and asset references | Service → runtime | Hosting/storage decision | Public/unlisted/authenticated access policy |
| Runtime client | Analytics API | HTTPS JSON API | Versioned analytics events | Runtime → service | Backend decision | Event endpoint and privacy policy |
| Asset service | Editor/runtime | HTTPS asset fetch | Curated asset metadata and media | Service → client | Storage/hosting decision | Asset URL and cache policy |

## 20. Explicitly Forbidden Technologies or Approaches

- **FORBIDDEN — Ready-made editor frameworks** that provide gizmos, scene serialization, or the interaction engine.
- **FORBIDDEN — Separate editor and runtime project schemas.**
- **FORBIDDEN — Browser-only `localStorage` as final persistence.**
- **FORBIDDEN — Client-side-only authorization or project isolation.**
- **FORBIDDEN — WebSockets/WebRTC for MVP collaboration.**
- **FORBIDDEN — WebXR, native mobile, arbitrary model conversion, mesh editing, scripting, and billing infrastructure.**
- **FORBIDDEN — Unpinned `latest` dependencies at baseline release.**

## 21. Technology Risks

- **HIGH — Cloud deployment and identity configuration:** provider setup, token validation, and signed asset URLs must be tested before publication is trusted.
- **HIGH — Undefined browser/device matrix:** may change rendering API, asset budgets, and input strategy.
- **HIGH — Three.js custom gizmo mathematics:** camera-angle degeneracies, screen-space hit testing, and transform correctness are technically risky.
- **HIGH — Preview/published parity:** separate execution paths can diverge unless they consume the same project and interaction core.
- **MEDIUM — Unbounded media/assets:** large files can break load time and modest-hardware performance.
- **MEDIUM — Authentication and project isolation:** configuration and authorization tests are acceptance-critical even though the provider is selected.

## 22. Unresolved Technology Decisions

- **UNDEFINED — Exact CI provider and deployment pipeline implementation:** the production hosting targets are selected, but automation remains to be configured.
- **REQUIRED — Browser baseline:** Chromium-based desktop browsers current minus two major versions for authoring; Safari iOS 17+ and Chromium Android current minus two for visitor viewing. WebGL2 is the MVP target; WebGPU is not required.
- **UNDEFINED — Exact trigger/action vocabulary and visitor movement model.**
- **REQUIRED — Dependency lockfile generation:** run npm after Node.js installation and commit the resulting `package-lock.json`.

## 23. Build & Verification Command

### Frontend target

```text
Target:    frontend/editor and runtime client
Command:   npm install
Verified:  no — Node.js/npm is not installed or discoverable in the current Windows environment.

Target:    frontend/editor and runtime client
Command:   npm run build
Verified:  no — prerequisite installation could not run; the command remains the intended check, not a verified result.
```

The commands are recorded because they are the project scripts in the existing scaffold. Before Stage 4, install Node.js 22 LTS, generate `package-lock.json`, run both commands, and paste the actual output here.

Backend commands: `python -m pytest` and `uvicorn app.main:app --reload`; the backend does not exist yet, so these remain unverified until its baseline is generated.

## Closing

```text
TECH STACK STATUS: BLOCKED

Mechanisms flagged UNFAMILIAR:   browser rendering, raycasting, schema migration, authentication, durable object storage, and CDN cache invalidation require `/learn` review if the team cannot explain them
/learn runs completed:           0
Build command verified:          no — Node.js/npm unavailable
Unresolved decisions:            CI/deployment automation, trigger/action vocabulary, movement model, and lockfile verification
Recommended next step:            Human approval of this resolved stack direction, then Stage 3 architecture skeleton and installation verification
```
