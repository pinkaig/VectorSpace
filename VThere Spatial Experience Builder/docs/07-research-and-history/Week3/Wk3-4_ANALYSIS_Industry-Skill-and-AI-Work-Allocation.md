# Project Skill & Team Allocation Analysis

Source-verified against the actual codebase at commit `b216993` ("Add Stage 5
production deploy infrastructure"), not against the project's own planning
docs. This matters here specifically: `CODEBASE_GUIDE.md` (the repo's own
architecture map) is dated 2026-09-09 and states routers, models, and four
packages are "absent." `git log` shows eight further stages shipped after
that date, including the entire backend schema, all routers, and three new
packages. The guide is stale and was not used as a source below.

Status key used throughout:

- **REAL** — working, tested, wired end-to-end
- **SKELETON** — real signature/schema, no logic (`NotImplementedError` / 501)
- **PLANNED** — spec document only, no code
- **ABSENT** — not present, not specified

---

## 1. What's actually in this codebase

### Programming / application development

| Skill | Status | Detail |
|---|---|---|
| TypeScript, strict app architecture | REAL | React 19 + Vite 6, strict typing across 6 packages and the editor |
| React 19 | REAL | Editor UI, scene tree, inspector panels, overlay components |
| Python / FastAPI | SKELETON | Real app boot, routing, Pydantic contracts across 5 routers |
| Test-driven development | REAL | 29+ Vitest suites across every package; Playwright e2e smoke test |

### 3D / graphics / interactive systems

| Skill | Status | Detail |
|---|---|---|
| Three.js scene management | REAL | Object3D hierarchy nesting by `parentId`, disposal-safe rebuilds |
| Custom gizmo mathematics | REAL | Hand-written vector math — ray/axis intersection, atan2 angle-around-axis, world/local TRS composition (no library, ~1,600 lines across 12 files) |
| Raycasting & picking | REAL | Pointer-to-3D-space projection, drag sessions, floor-plane intersection |
| Transform inheritance | REAL | Local-space TRS recompute on reparent, preserving world position — framework-free quaternion math |
| Camera & navigation systems | REAL | Orbit mode (OrbitControls), WASD walk mode, orthographic/perspective sync, view-snap presets |
| GPU resource lifecycle | REAL | Geometry/material/texture disposal discipline to prevent leaks across editor/runtime transitions |
| Environment content | SKELETON | `environments.ts` only populates placeholder procedural boxes today; the GLTF loading path exists but no real environment models are loaded yet |

### Backend / data

| Skill | Status | Detail |
|---|---|---|
| Relational schema design | REAL | 7 tables, FKs, check constraints, composite unique constraints (`models.py`, 233 lines) |
| Alembic migrations | REAL | Init migration wired to the schema above |
| REST API surface | SKELETON | 5 routers, full Pydantic request/response models — every handler raises 501 |
| JWT / JWKS authentication | REAL | Real Auth0 JWKS fetch, RS256 verification, FastAPI dependency injection — not yet required by any route |
| Repository / persistence layer | ABSENT | No code queries the database yet — the biggest open backend gap |

### Cloud / infrastructure

| Skill | Status | Detail |
|---|---|---|
| Containerization | REAL | Multi-stage Dockerfiles for API (Python) and frontend (Node build → nginx) |
| Local dev orchestration | REAL | `docker-compose.yml`: Postgres 16 + MinIO with healthchecks |
| Production deploy topology | REAL | Compose stack behind Caddy (auto-TLS), required-env-var gating, VM provisioning runbook |
| S3-compatible object storage | REAL | boto3 presigned PUT/GET URL generation against MinIO — correct pattern, not yet called by a route |
| CI pipeline | REAL | GitHub Actions (repo root): install → typecheck → unit test → build → e2e, required status check |
| CD / automated deploy | SKELETON | `workflow_dispatch`-only, gated on an unfilled GitHub Environment — deliberately not automatic |

### Software engineering

| Skill | Status | Detail |
|---|---|---|
| Command pattern / undo-redo | REAL | Snapshot-based `CommandTimeline`, redo-branch invalidation, reversible transform commands |
| Domain/schema validation | REAL | Serializer rejects malformed JSON, cycles, orphaned parents, oversized projects — with tests per rejection case |
| Monorepo / workspace architecture | REAL | npm workspaces, 6 framework-free packages with explicit dependency direction |
| Pure functional core / effects-at-edge | REAL | WHEN→DO dispatcher takes state in, returns state out — zero DOM/Three.js/IO inside the matching logic |
| Offline-first sync design | REAL | Idempotency-keyed queue, revision-based conflict detection, retry counters |

---

## 2. Value classification key

| Tag | Meaning | Example from this codebase |
|---|---|---|
| **A** | High-value, broad résumé skill | Command-pattern undo/redo; pure-function dispatch core |
| **B** | Good supporting skill, shouldn't dominate a trimester | Alembic migrations; Docker Compose orchestration |
| **C** | Niche / specialist — smaller job market, real differentiation | Browser-based 3D gizmo math — niche next to general web dev, high signal for graphics/XR/digital-twin roles |
| **D** | Low learning value, necessary implementation | Wiring a fifth near-identical CRUD router once the pattern exists |
| **E** | Tedious, AI-suitable | Repository boilerplate; DTO mirrors of the SQLAlchemy models |

---

## 3. Technology used ≠ skill gained

| Technology | → | Actual engineering skill |
|---|---|---|
| Three.js + hand-rolled interaction math | → | Browser-based 3D scene authoring: raycasting, drag sessions, gizmo mathematics from first principles, not a plugin |
| `packages/authoring-engine` | → | Designing a reversible command system — the same pattern behind editor undo stacks and event-sourced systems generally |
| `packages/interaction` (WHEN→DO) | → | Building a deterministic, side-effect-free rule engine — ordering, priority, state-immutability guarantees that must hold under test |
| SQLAlchemy + Alembic | → | Relational data modelling: choosing constraints, cascade rules, and revision semantics before any endpoint uses them |
| FastAPI routers (current state) | → | API contract design — but NOT backend engineering yet, since no handler touches the database. Finishing one router end-to-end is the actual skill gap |
| boto3 + MinIO presigned URLs | → | The direct-to-storage upload pattern real production apps use to avoid proxying large files through the API |
| Docker Compose + Caddy + GitHub Actions | → | Operating a production-like deploy: reverse proxy, automatic TLS, environment-gated CD — not just "wrote a Dockerfile" |

---

## 4. What AI should do

Verified against the actual gaps in this codebase, not a generic list:

- **Repository/service layer for the five skeleton routers.** The Pydantic contracts and SQLAlchemy models already exist and match; wiring `create_project` to an `INSERT` is mechanical once the pattern is set once by a human.
- **DTO/response-model mirrors.** Every router's `*Response` model is a near-1:1 shadow of a table in `models.py` — pure translation work.
- **Test scaffolding for repetitive validation cases.** The serializer's per-rejection-reason tests (malformed JSON, oversized file, duplicate ID…) follow one template with the input swapped.
- **Boilerplate resolver/adapter implementations** once one resolver in `packages/assets/src/resolvers/` sets the shape, additional catalog sources follow the same interface.
- **Documentation and subsystem-guide drafts** — this repo already leans on AI for this (see `docs/ai-declaration.md`) — with a human doing final review, which is the existing convention here.
- **Config and CI wiring** for new services (env var plumbing, Dockerfile stages) once the target shape is decided by a person.

## 5. What students must own

- **The command-path service** (`packages/authoring-engine/src/commands/`) — this repo's own history shows it was treated as the single highest-risk piece of the whole project, explicitly reserved for the most senior available reasoning, because a wrong first draft here corrupts undo/redo silently rather than loudly.
- **WHEN→DO dispatch ordering and state semantics** — priority/authoring-order tie-breaks and immutability guarantees are exactly the kind of subtle rule an AI-generated first draft gets almost right and wrong in a way tests may not catch without a human who understands why the order matters.
- **Transform inheritance / parent-child math** — recomputing a child's local transform to preserve world position on reparent is a correctness-critical quaternion/matrix decision, not boilerplate.
- **Database schema and migration decisions** — cascade rules, what's nullable, what's a composite unique constraint — these are permanent decisions a later migration can't cheaply undo.
- **Auth/security boundaries** — which routes require the JWT dependency, what an actor is allowed to touch across organisations — a wrong default here is a real vulnerability, not a style choice.
- **Performance and resource-lifecycle investigation** — GPU disposal correctness, frame-time budgets — bugs here are silent memory leaks that only show up after prolonged use.
- **The actual moment a resolver, dispatcher, or repository test fails** — reading why, not just re-running until it's green.

The line the project's own planning docs already draw, independently arrived at: *AI can help write the code; the team must understand the system and own the decisions that are expensive to reverse.*

---

## 6. Singapore market, September 2026

Current search results, not general knowledge.

| Category | Signal | Where this project sits |
|---|---|---|
| Broad industry skill | Cloud/DevOps (AWS/Azure/GCP, CI/CD) and backend/full-stack engineering are named the two hottest categories; IMDA projects a sustained ~55,000-role tech shortage | Docker + Compose + CI pipeline + Postgres/SQLAlchemy directly match. FastAPI/Node/Java are functionally interchangeable at junior level — the *backend engineering pattern* transfers, the specific framework doesn't need to |
| Specialist / niche | Unity/Unreal named explicitly in-demand, increasingly by non-game companies (XR, digital twin, simulation); studios value engineers who understand real-time rendering constraints | This project's browser-3D work is the same underlying skill (scene graphs, transforms, raycasting) in a different engine — a legitimate, if narrower, portfolio angle for 3D/graphics/XR roles specifically |
| Graduate relevance | ~80% of vacancies reportedly don't require a specific degree; new-role share is high; demonstrated project work is explicitly said to outperform credentials | A working, tested, deployed system with a real PR history is closer to what's being screened for than coursework is |
| Portfolio value | None of the sources reward technology-name-dropping — they reward shipped, explainable systems | Matches this analysis's core "technology ≠ skill" distinction directly |

Sources: [Singapore 2026 Job Market Report](https://hiredeveloper.sg/employer-blog/singapore-software-developers-most-in-demand-2026-report), [Singapore game studio portfolio expectations, 2026](https://mages.edu.sg/blog/what-singapore-game-studios-want-in-portfolios-2026/)

---

## 7. Team profiles

### Person 1 — Rendering / generalist

Strongest technical growth: finish the gizmo/interaction layer's remaining edges and take ownership of the render-host extraction the project's own docs already call out as the next step.

- **Build:** The planned `RenderHost`/`createViewportRuntime` extraction from `Viewport.tsx`; instancing/LOD once a scene-size budget is defined
- **Understand:** Object3D hierarchy composition, disposal ownership, raycasting cost
- **AI helps:** Repetitive stage-module scaffolding once the stage contract is fixed
- **Resume line:** "Designed a disposal-safe rendering host managing camera, gizmo, and artefact lifecycles in a multi-scene Three.js editor"

### Person 2 — Games / full-stack

Best fit: the WHEN→DO interaction engine plus wiring it to real content actions — genuine game-logic-system experience (trigger/condition/action dispatch) sitting on top of a real HTTP+DB stack.

- **Build:** New action executors (`showPanel`, `playAudio`) and their zone/trigger authoring UI; one finished CRUD router end-to-end (schema → repository → route → test)
- **Understand:** Deterministic dispatch ordering, edit-mode/play-mode gating, why `resetRuntime()` exists
- **AI helps:** Additional router boilerplate once the first is hand-built
- **Resume line:** "Built a rule-based interaction/dispatch engine and its backend persistence path, from authored trigger to database row"

### Person 3 — Modelling / art / design

Bridge, not backend: own the asset pipeline's content side — this project has a genuine technical-art seam (`packages/assets`) rather than forcing a choice between "art" and "software."

- **Build:** Real GLB environments through the already-real `GLTFLoader` path in `environments.ts` (currently only placeholder procedural boxes); authored models through `LocalCatalogResolver`; thumbnails, scale/pivot metadata contracts
- **Understand:** Why the resolver is an interface (swap catalog for remote storage without touching the viewport), asset budget tradeoffs
- **AI helps:** Metadata/manifest generation, repetitive resolver-backend boilerplate
- **Resume line:** "Owned the asset pipeline connecting authored 3D content to a resolver architecture consumed by both editor and runtime"

### Person 4 — Prefers following, concrete scope

Not "the least valuable work" — the sync engine and media-upload completion are exactly what the profile asks for: interface already specified, success is testable, boundary is one package.

- **Build:** Finish `apps/api/app/routers/media.py`'s `request_media_upload`/`get_media` against the already-real `storage.py` boto3 boundary; wire `SyncClient` retry/backoff edge cases
- **Understand:** Idempotency keys, why retries need them, presigned URL expiry
- **AI helps:** Boilerplate around the one real decision (the upload flow itself)
- **Resume line:** "Implemented a presigned-URL media upload path and integrated it with an offline-first sync queue"

### Person 5 — Team lead / integration

Complements rather than duplicates: owns the seam nobody else does — persistence + auth + publishing, the layer that turns four independent subsystems into one coherent app.

- **Build:** The repository layer under the skeleton routers; the auth dependency wired into real routes; the publish/versioning flow (`ContentSnapshot` immutability, revision safety)
- **Understand:** The full data flow end to end; where each teammate's package plugs in; the isolation invariant ("two actors cannot see each other's media")
- **AI helps:** Cross-cutting mechanical work (migrations for new fields, response-model updates) once the lead has decided the shape
- **Resume line:** "Led integration of five subsystems into one persisted, authenticated, publishable application"

---

## 8. Recommended allocation

| Person | Primary skill | Secondary skill | Main project area | Industry relevance | Niche/Broad | AI assistance |
|---|---|---|---|---|---|---|
| 1 — Rendering | Render-host / scene lifecycle architecture | Camera & interaction systems | `src/viewport/`, gizmo | Niche → graphics/XR | C | Stage-module scaffolding |
| 2 — Games/full-stack | WHEN→DO dispatch + one router end-to-end | Content action executors | `packages/interaction`, one router | Broad + niche mix | A / C | Router boilerplate |
| 3 — Modelling/art | Asset resolver pipeline | Environment/material authoring | `packages/assets` | Niche technical-art | C | Manifests, thumbnails |
| 4 — Follower profile | Media upload completion | Sync retry/backoff | `media.py`, `packages/sync` | Broad backend | B | Surrounding plumbing |
| 5 — Team lead | Repository layer + auth wiring | Publishing/versioning | `apps/api` integration | Broad backend | A | Migrations, DTOs |

---

## 9. The project as a skill portfolio

```text
Broad industry skills
├── Full-stack TypeScript + Python
├── Relational data modelling
├── REST API design
├── Docker / container orchestration
├── CI pipelines
└── Automated testing (unit + e2e)

Specialist / niche
├── Browser-based 3D authoring
├── Custom gizmo mathematics
├── Scene graph / transform composition
├── Deterministic rule-dispatch engines
└── Offline-first sync design

Supporting skills
├── Git / PR workflow discipline
├── Source-file documentation standard
├── Validation & error-boundary design
└── Debugging across a real stack

AI-suitable work
├── Repository/service boilerplate
├── DTO ↔ model mirrors
├── Repetitive validation tests
└── Config & docs drafts
```

---

## Final answer

> If we have 5 students, one trimester, an already-integrated baseline, and access to AI, what technical skills should each person deliberately develop through this project so that we gain meaningful engineering experience without wasting time manually implementing low-value work?

Each person should own one subsystem where the interface already exists but
the logic doesn't — that boundary is what makes the work both learnable and
finishable in a trimester.

Concretely: **rendering owns the render-host extraction**, **games/full-stack
owns WHEN→DO plus one finished CRUD vertical**, **art/modelling owns the
asset resolver pipeline**, **the follower profile owns media upload + sync**,
and **the lead owns the repository/auth layer that wires everyone else's
work into one persisted app**. Nobody rebuilds the baseline — the schema,
contracts, dispatch core, and deploy path already exist and are tested. AI
absorbs the boilerplate each of these gaps still has (a second router, a
second resolver, a second test case); the person absorbs the one decision in
each gap that would be expensive to get wrong. That's a credible,
individually explainable interview story for all five, from one integrated
system, without anyone spending the trimester re-deriving infrastructure the
baseline already earned.
