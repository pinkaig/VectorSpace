# Full-Stack Infrastructure Skeleton — Extended with Asset Manager, WHEN→DO Engine, Local→Cloud Sync

**Revision:** Extended 2026-09-17 to include three critical subsystems (Asset Manager, WHEN→DO
engine, sync vehicle) alongside the original [REAL] infrastructure and [SKELETON] domain logic.

**Core principle unchanged:** Infrastructure (Docker/DB/routes/storage/rendering/event-dispatch) is

**Baseline phase:** All 8 stages (planning doc). See [8-stage baseline overview](../../code/baseline-phases.md).
[REAL] and working. Domain logic (repositories/services/business rules) is [SKELETON].

---

## Three new subsystems this plan adds

### 1. Asset Manager — the unified asset reference layer

**What it is:** A pluggable resolver system so any part of the architecture (editor, runtime,
backend) can reference an asset the same way, independent of where it lives.

**[REAL] infrastructure (no domain decisions):**
- `packages/assets/src/AssetRef.ts` — the opaque reference type: `{ assetId: string, kind: AssetKind }`
- `packages/assets/src/AssetDescriptor.ts` — the resolved form: metadata, content-type, URL/blob,
  loading state (`idle|loading|ready|error`)
- `packages/assets/src/AssetResolver.ts` — the pluggable interface: `resolve(ref) → Promise<descriptor>`
- Three concrete resolver implementations:
  - `PrimitiveResolver` — hardcoded cube/sphere/cylinder
  - `LocalCatalogResolver` — dev-time GLB catalog (satisfies `asset-library-contract.md`)
  - `RemoteMediaResolver` — calls backend `/projects/{id}/media` + signed URLs (active once MediaRepository exists)
- Cache management: in-memory cache with TTL tied to signed-URL expiry
- Degraded state handling: visible placeholder + retry affordance for missing/failed assets (no silent blanks)

**Integration points:**
- `SceneObject.assetId` stays a string; `SceneObject.assetKind` determines resolver path
- `Component.assetId` (media attachments) uses the same resolver for consistency
- Viewport raycasting can filter by asset status (skip loading/failed)
- Runtime and editor both call the same resolver, no duplication

**Acceptance:** One resolver can serve multiple asset origins; swapping origin (local → S3) requires
no caller changes.

### 2. WHEN→DO Engine — the event dispatch vehicle

**What it is:** The infrastructure that runs interaction rules (not the rule vocabulary itself, just
the engine that can run any vocabulary).

**[REAL] infrastructure (no domain decisions about *which* triggers/actions):**
- `packages/interaction/src/RuntimeEvent.ts` — the event shape: `{ kind: string, objectId?: string, zoneId?: string, payload?: Record<string, unknown> }`
- `packages/interaction/src/RuntimeState.ts` — the state shape: `{ visitedZones: Set<id>, currentSceneId, runtimeData?: object }`
- `packages/interaction/src/DispatchResult.ts` — the outcome: `{ eventsMatched: Event[], actionsExecuted: Action[], nextState: State }`
- `packages/interaction/src/dispatcher.ts` — pure function `dispatch(event, rules, project, state) → DispatchResult`
  - No I/O, no rendering; fully testable against fixtures
  - Rule matching by object id / zone id / trigger kind (deterministic order: rule authoring order)
  - Action execution framework (not implementations; those are separate concerns)
  - Ordering guarantee: multiple rules on one object fire in a defined, tested order
  - Side-effect isolation: dispatch returns what *should* happen; rendering/persistence apply the result

**[SKELETON] domain logic:**
- `InteractionRule` — the rule data structure: `{ id, objectId, zoneId, triggers: [kind, ...], actions: [kind, ...], priority? }`
- Rule validation: no orphaned object/zone refs, rule ID uniqueness, acyclic dependencies
- Action executors (pluggable per kind): `executeAction(action, assets, state) → Promise<nextState>`
  - `showPanel(componentId)` → render function
  - `playAudio(assetId)` → player control
  - `navigateScene(sceneId)` → navigation function
  - New actions are added without touching the dispatcher

**Integration points:**
- Gizmo/interaction sends `RuntimeEvent` to the dispatcher (e.g., click → `{ kind: 'click', objectId }`)
- Dispatcher returns actions to execute (no rendering side-effect)
- Runtime/editor executor applies actions (show UI, play sound, etc.) — separate from dispatch logic
- Rules are persisted as `ProjectData.rules: InteractionRule[]`, versioned like everything else
- Undo/redo works automatically (CommandTimeline stores full project snapshots including rules)

**Acceptance:** New event kinds or action kinds can be added without changing the dispatcher or
breaking existing rules.

### 3. Local→Cloud Sync Engine — the persistence vehicle

**What it is:** The infrastructure that keeps local and server state in sync, not the data model.

**[REAL] infrastructure (sync mechanics, not business logic):**
- `packages/sync/src/SyncQueue.ts` — queues local changes: `{ id, op, revision, payload, idempotencyKey, retries }`
- `packages/sync/src/SyncClient.ts` — manages sync state: `idle|pending|conflict|failed`, retry backoff,
  TTL and expiry
- `packages/sync/src/SyncResult.ts` — outcome per write: `{ success, conflictWith?, retryable?, newRevision? }`
- Dual-write staging: writes to local (localStorage/IndexedDB) + sync queue; reads from local until
  server confirms
- Conflict detection: every write carries the base revision it was built on; server returns conflict
  if head is newer
- Idempotency: every write has a client-generated id; server deduplicates on retry
- Fallback chain: local autosave → queued sync → retry on reconnect → offline buffer

**[SKELETON] domain logic:**
- `SyncService` — orchestrates the sync flow for a specific resource (project, asset, rule)
- Conflict resolution strategy (merge/overwrite/ask user) — decision tree for each resource type
- Server-side write deduplication and conflict handling — who wins on conflict

**Integration points:**
- `serializer.ts` (current autosave to localStorage) becomes Tier 1, sync is Tier 2
- `App.tsx` save callback → local write (immediate) + sync queue (background)
- Asset upload: local preview URL → background presigned-URL upload → mark_uploaded on success
- Network reconnect → retry queued writes in order
- UI shows sync status: "Saving locally…" / "Syncing to server…" / "Synced" / "Sync failed, will retry"

**Acceptance:** A user can edit offline; changes persist locally and sync to server when online. A
failed sync queues and retries without losing local edits.

---

## Revised full-stack sequencing (7 stages, 3 parallel tracks)

### Track A: Infrastructure plumbing (no project-schema dependency)

**Stage 1: Local dev environment** [REAL, 1–2 days]
- `docker-compose.yml`: `postgres:16`, `minio`, health checks, named volumes
- `.env.example`: every variable the stack reads
- `apps/api/app/config.py`: pydantic-settings `Settings` class
- `apps/api/app/db.py`: SQLAlchemy 2.x engine + session factory
- `apps/api/alembic.ini` + init migration scaffold
- Verification: `docker compose up`, health-checks pass, `alembic upgrade head`

**Stage 2: Data model** [REAL structure + SKELETON bodies, 1–2 days]
- `apps/api/app/models.py`: Organisation, Actor, Project, ProjectVersion, MediaAsset,
  ContentSnapshot, AnalyticsEvent, InteractionRule (with full column shapes, no bodies)
- Real Alembic migration
- Verification: Tables created, constraints enforced, valid migrations

**Stage 3: Backend HTTP surface** [REAL routing + SKELETON handlers, 2–3 days]
- `apps/api/app/routers`: projects, media, publish, analytics, rules (all routes defined,
  all handlers return 501 NotImplementedError)
- `apps/api/app/auth.py`: Auth0 JWKS + JWT validation [REAL]
- `apps/api/app/storage.py`: boto3 presigned URLs [REAL]
- Verification: All routes register, curl a route → 501 NotImplementedError

**Stage 5: Production deploy** [REAL files, 1 day after Stage 3]
- `apps/api/Dockerfile`, frontend `Dockerfile`, `docker-compose.prod.yml` with Caddy
- `.github/workflows/deploy.yml`: GitHub Actions SSH deploy to VM
- `deploy/README.md`: concrete VM provisioning steps
- Verification: `docker build` succeeds, compose config validates

### Track B: Client-side asset/event/sync infrastructure (no backend dependency; runs now)

**Stage 4a: Asset Manager** [REAL infrastructure, SKELETON domain logic, 2 days, parallel to Stage 2–3]
- `packages/assets/` package: AssetRef, AssetDescriptor, AssetResolver interface
- Three resolvers: PrimitiveResolver (hardcoded), LocalCatalogResolver (dev catalog), RemoteMediaResolver
  (skeleton, calls backend once it exists)
- Cache + TTL management
- Placeholder/error state handling
- Tests: resolver contract, cache invalidation, placeholder rendering
- Verification: `npm run test -- packages/assets` passes; resolver can serve multiple sources;
  swapping sources requires no caller changes

**Stage 4b: WHEN→DO Engine** [REAL infrastructure, SKELETON domain logic, 2 days, parallel to Stage 2–3]
- `packages/interaction/` package: RuntimeEvent, RuntimeState, DispatchResult shapes
- `dispatch()` pure function: event matching, rule ordering, action execution framework
- Pluggable action executors (implementations are skeleton: showPanel/playAudio/navigateScene)
- Tests: rule ordering, event matching, action framework, no duplicates, idempotency
- Verification: `npm run test -- packages/interaction` passes; new action kinds can be added without
  touching dispatcher

**Stage 4c: Sync Engine** [REAL infrastructure, SKELETON domain logic, 2 days, parallel to Stage 2–3]
- `packages/sync/` package: SyncQueue, SyncClient, SyncResult shapes
- Dual-write staging (local + queue)
- Retry backoff, idempotency keys, conflict detection (revision-based)
- Tests: queue persistence, retry logic, conflict detection, idempotency
- Verification: `npm run test -- packages/sync` passes; offline changes persist and sync on reconnect

### Track C: Integration (after Stages 1–4 exist)

**Stage 6: Wire Asset Manager into frontend** [1 day]
- `SceneObject.assetId` → Asset Manager resolver
- Viewport raycasting uses resolver results
- Gizmo integration: asset status (loading/error) affects picking
- Tests: asset resolution in viewport context

**Stage 7: Wire WHEN→DO into runtime** [2 days]
- `ProjectData.rules: InteractionRule[]` (added to schema)
- Gizmo/pointer sends events to dispatcher
- Dispatcher output → action executors (render, play, navigate)
- Tests: end-to-end: click → event → rule match → action → UI/audio/nav

**Stage 8: Wire Sync into autosave** [1 day]
- `serializer.ts` → local tier + sync queue
- App save callback → dual write
- Network reconnect → retry
- Tests: offline save, sync on reconnect, conflict detection

---

## Verification per stage

Each stage must pass before the next starts:

| Stage | Check | How to verify |
|---|---|---|
| 1 | Compose starts, health-checks pass | `docker compose up -d && docker compose ps` |
| 2 | Tables created, migrations safe | `alembic upgrade head && psql -c \\dt` |
| 3 | All routes registered, 501 responses | `curl http://localhost:8000/projects/{id}` |
| 4a | Resolvers pass contract tests | `npm run test -- packages/assets` |
| 4b | Dispatcher is pure, rule order is deterministic | `npm run test -- packages/interaction` |
| 4c | Sync queue persists, conflicts detected | `npm run test -- packages/sync` |
| 5 | Deploy files are real, VM provisioning works | `docker build`, `compose -f docker-compose.prod.yml config` |
| 6 | Assets resolve in viewport | `npm run dev`, select object, asset loads/fails predictably |
| 7 | Gizmo click → event → rule → action → effect | `npm run dev`, click object, rule fires, effect occurs |
| 8 | Offline saves, syncs on reconnect | `npm run dev`, disconnect network, save, reconnect, verify sync |

---

## Current state

- **Stage 0 complete:** repo, build, health endpoint, Phase 0–1 (serialization, validation, persistence)
- **Phase 2 in progress:** command-path service (move/rotate/scale) — **blocker for Stage 7**
- **Gizmo ready:** move/rotate/scale handles, drag sessions, commit callbacks (in [interactionController.ts](../../src/viewport/interactionController.ts))
- **Object manager ready:** `SceneObject.id`, `parentId`, `visible`, `enabled`, lifecycle operations
  (in [packages/project](../../packages/project/src/index.ts))

---

## Blockers and dependencies

| Stage | Blocked by | Reason |
|---|---|---|
| 1–3, 5 | Nothing | Pure infrastructure, no project-schema dependency |
| 4a–4c | Nothing | Pure client infrastructure, runs now |
| 6 | Asset Manager (4a) | Needs resolver contract |
| 7 | Phase 2 + WHEN→DO (4b) + InteractionRule schema | Needs command path stable + rule data structure |
| 8 | Sync (4c) + schema migration | Needs sync queue + sync-aware project versioning |

---

## Explicitly out of scope

- Gizmo/transform interaction — team-owned, complete, ready to wire
- Editor UI for rule authoring (Inspector panels for WHEN/DO selection) — team-owned
- Runtime UI for action presentation (panel renderer, audio player, navigation UI) — team-owned
- Full ECS or parent-child UI — deferred to slices 3–5 per existing plan
- Transformer inheritance / local-space math — deferred

**What IS in scope:**
- Asset resolution vehicle (not asset catalog vocabulary)
- WHEN→DO dispatch engine (not trigger/action vocabulary)
- Sync queue vehicle (not conflict-resolution policy)
- All three are [REAL] infrastructure + [SKELETON] domain logic, fully testable in isolation

---

## How this extends the original plan

| Original | Revision | Rationale |
|---|---|---|
| 5 stages (infra → model → services → packages → deploy) | 8 stages (split packages, add sync wiring) | Asset Manager, WHEN→DO, Sync are now explicit first-class stages; wiring comes after infrastructure exists |
| Packages are scaffolded, then integrated | Packages are scaffolded in parallel (Track B), then wired after verification (Track C) | Faster; infrastructure and client code don't block each other |
| Publishing/interaction are backend services | Publishing/interaction are split: backend API is skeleton, client dispatch engine is infrastructure | Dispatch engine runs offline and locally; backend just persists rules |
| Sync is mentioned in passing | Sync is a complete stage with queue/retry/idempotency/conflict | Offline editing and resilience are first-class requirements |

---

## Next steps

**This week:**
1. Finish Stage 1 (Compose, env, config, DB)
2. Start Stages 4a–4c in parallel (Asset Manager, WHEN→DO, Sync packages)
3. Document all three in `docs/05-subsystems/` alongside architecture

**Next week (after Phase 2 merges):**
4. Stage 2 (data model with InteractionRule + sync-aware versioning)
5. Stage 3 (backend HTTP surface)
6. Stages 6–8 (wire everything together)
7. Stage 5 (deploy files)

---

## Deliverables per stage (documentation included)

| Stage | Subsystem docs | Code docs | Build/verify command |
|---|---|---|---|
| 1 | — | `.env.example`, `config.py` headers | `docker compose up` |
| 2 | `backend-persistence.md` | `models.py` headers | `alembic upgrade head` |
| 3 | `backend-api-surface.md` | Router headers, `auth.py` | `curl /projects/{id}` |
| 4a | `asset-manager.md` | `AssetResolver`, `AssetDescriptor` headers | `npm run test -- packages/assets` |
| 4b | `when-do-dispatch-engine.md` | `dispatch()`, `RuntimeEvent`, `RuntimeState` headers | `npm run test -- packages/interaction` |
| 4c | `sync-engine.md` | `SyncQueue`, `SyncClient` headers | `npm run test -- packages/sync` |
| 5 | `deployment.md` | Dockerfile, Actions workflow comments | `docker build`, `compose config` |
| 6–8 | Integration notes in existing docs | Updated headers + integration tests | `npm run dev` + end-to-end checks |
