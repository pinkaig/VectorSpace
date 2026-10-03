# Asset Manager, WHEN→DO Sequencing, and Local→Cloud Sync — Planning Guidelines

**Baseline phase:** Stage 4a/4b/4c (frontend tracks — asset manager, WHEN→DO engine, sync). See [8-stage baseline overview](../../code/baseline-phases.md).

## Purpose

This is a planning-stage note — **nothing described here is built**. It extends
[2026-09-17--PLAN--full-stack-infrastructure-skeleton.md](2026-09-17--PLAN--full-stack-infrastructure-skeleton.md)
with three sets of best-practice guidelines requested ahead of implementation:

1. A unifying **asset manager** concept, so any part of the architecture (editor,
   runtime, backend) can reference an asset the same way.
2. Correct build **sequencing** for the WHEN→DO interaction engine, so pieces link up in
   the right direction as they're built.
3. Best practices for the eventual move from **local-only storage to cloud-synced
   storage** — stability, correctness, and fallback — including how media attachments
   fit into hosting/cloud integration.

A [ponytail second opinion](#ponytail-second-opinion) follows, checking these guidelines
and the existing infrastructure plan against what's actually true in the repo right now.

## Ground truth this note assumes

- No asset loader exists. [Viewport.tsx](../../src/Viewport.tsx) builds three hardcoded
  Three.js primitives directly; `SceneObject.assetId` is an unresolvable bare string.
  Real GLB/media loading is speced but not implemented — see
  [CURRENT--asset-library-contract.md](../05-subsystems/CURRENT--asset-library-contract.md).
- Local persistence is [serializer.ts](../../src/serializer.ts): `localStorage` primary
  + backup key, debounced autosave, manual export. No IndexedDB, no server save yet — see
  [project-serialization.md](../05-subsystems/project-serialization.md).
- `packages/interaction` and `packages/components` don't exist yet. No WHEN/DO, trigger,
  dispatch, or zone code exists anywhere in `src/`.
- Per [TECH_LEAD_INFRASTRUCTURE_PLAN.md](../../TECH_LEAD_INFRASTRUCTURE_PLAN.md), Phase 2
  (the move/rotate/scale command-path service) is **incomplete**, and Phase 3 onward
  (interactions, runtime, API) is explicitly **blocked** until Phase 2 is stable.

## 1. Asset Manager guidelines

1. **Indirection is the whole point.** No code anywhere should hold a raw path or URL to
   an asset — only an opaque `AssetRef`/id. Storage location (bundled primitive, dev-
   catalog GLB, S3/MinIO key, future CDN) stays behind one resolver.
2. **One registry, many backends, one interface.** Resolvers for different asset origins
   (primitive / local-catalog / remote-media) implement the same contract
   (`resolve → descriptor`, same loading/error/ready states) so callers never branch on
   asset origin.
3. **Assets are versioned, not mutable.** Once an asset is referenced from a published
   snapshot (the plan's `ContentSnapshot`), its bytes never change under that id —
   replacing content means a new asset id, not an overwrite.
4. **Every resolution path has a degraded state.** A missing/failed/slow asset renders a
   visible placeholder, never a silent blank or a crash — decide the placeholder contract
   as part of the type, not as an afterthought.
5. **Caching has an explicit invalidation rule.** Any client-side cache of a resolved
   URL/blob is tied to the signed-URL TTL — a stale cached URL failing silently is worse
   than no cache at all.

## 2. WHEN→DO sequencing guidelines

1. **Design outward from the stored schema, not from the event loop.** The WHEN/DO rule
   data is the durable artifact that gets authored, saved, and versioned — decide its
   shape first, independent of how any particular trigger gets detected today.
2. **Dispatch stays a pure function.** `(event, project, state) → result`, no I/O, no
   rendering — this is what makes ordering and "fires once" guarantees provable by a unit
   test instead of by eyeballing runtime behavior.
3. **Event sources and action executors are pluggable, separately.** New trigger types
   (zone-enter, timer) or action types (navigate, transition) get added without touching
   the dispatcher's core matching/ordering logic.
4. **Determinism is a first-class requirement.** Multiple rules on one object need a
   documented, tested resolution order — "whatever order happens to run" is a latent bug.
5. **The vocabulary is versioned from day one.** WHEN/DO rules get saved inside project
   documents that outlive today's code; adding a new trigger/action kind later must not
   invalidate previously-saved rules.

Recommended dependency order once this is actually built: schema (`InteractionRule[]` on
`ProjectData`) → content types (`packages/components`) → pure `dispatch()` → event
sources wired into the runtime (click → sceneStart → zoneEnter, in that order of
difficulty) → action executors (need the Asset Manager resolved first).

## 3. Local → cloud sync guidelines

1. **Offline-first, not offline-fallback.** The local write path is the fast,
   always-succeeds tier the UI depends on directly; cloud sync is a background layer on
   top, never something a save blocks on.
2. **Optimistic concurrency, never silent overwrite.** Every write to a shared/cloud
   resource carries the revision it was based on; a mismatch is a conflict to resolve
   explicitly, never a last-write-wins clobber.
3. **Retries must be idempotent.** Any client-generated write (save, upload) carries a
   client-side idempotency key so a dropped response plus automatic retry can't double-
   apply.
4. **Sync failure degrades gracefully, loudly to logs, quietly to the user.** A failed
   background sync queues and retries with backoff, and is visible in debug logging
   (`packages/debugging` already exists for this) without interrupting editing.
5. **The local cache is a permanent tier, not scaffolding to delete later.** Once cloud
   sync exists, `localStorage` keeps serving as the offline/failed-sync buffer —
   `project-serialization.md`'s "will be replaced" framing should become "will be
   extended."
6. **Correctness is checkable.** Checksums/hashes on synced documents let drift between
   local and server state be caught by a check, not by a user report.
7. **Migration is staged, not a flag-day cutover.** Local-only → local+cloud goes through
   a dual-write phase (write both, read local, verify parity) before read authority moves
   to the server.
8. **Attachments (media) follow the identical shape.** Local object-URL preview
   immediately on attach, background upload via a presigned URL, `mark_uploaded()` only
   on confirmed success, retry queue on failure — an attachment mid-upload never corrupts
   the project document, it just points at an asset still syncing.

## Ponytail second opinion

### Review position

The guidelines above are sound as *guidelines* — they cost nothing to write down and
nothing here contradicts the existing plan. The risk isn't in the content, it's in what
gets built from it this week. [TECH_LEAD_INFRASTRUCTURE_PLAN.md](../../TECH_LEAD_INFRASTRUCTURE_PLAN.md)
is dated the same day as the infrastructure-skeleton plan this note extends, and it says
plainly: Phase 2's command-path service is unfinished, and Phase 3+ (interactions,
runtime, API) is *blocked* until it's stable. The infrastructure-skeleton plan's
[REAL]/[SKELETON] split is a reasonable defense against scope creep, but it doesn't
change one fact: backend/cloud skeleton work does not unblock Phase 3 for the rest of the
team. Only finishing the command path does. Time spent standing up Postgres/MinIO/Auth0
skeletons this week is time not spent on the actual blocker.

There's a second, more specific risk for the two new systems here. The 2026-09-15 ponytail
review already flagged that content/hierarchy work should wait behind "a stable entity-ID
render map." Both media attachments (`Component.assetId` on a `SceneObject`) and WHEN→DO
rules (targeting `objectId`/`zoneId`) reference object identity directly — and
`TECH_LEAD_INFRASTRUCTURE_PLAN.md`'s own open questions list still hasn't resolved when
lifecycle fields (`visible`, `enabled`, `parentId`) or the hierarchy layer land. Designing
a concrete `MediaAsset`/`Component`/`InteractionRule` schema now means designing against an
object-identity model that's explicitly still in flux one layer up.

### Revised recommendation

1. **Keep the infra-only work moving in parallel.** `docker-compose.yml`, Postgres,
   MinIO, Auth0 wiring, deploy files — none of this depends on `ProjectData`'s shape.
   Proceed exactly as the existing plan sequences it.
2. **Sketch the Asset Manager's resolver interface now, on paper.** The
   `resolve(ref) → descriptor` contract and its three backends are genuinely decoupled
   from `SceneObject`/`ProjectData` shape — safe to design, unsafe to wire in yet.
3. **Hold off wiring `AssetRef` into `SceneObject`/`Component`, and hold off scaffolding
   `packages/interaction`/`packages/components` as buildable code**, until two things
   land: the Phase 2 command-path slice, and an answer to the entity-ID/render-map
   question. Both attachments and WHEN→DO rules need a stable id to point at.
4. **Draft the WHEN→DO event/action vocabulary as a design doc, not code.** Cheap to do
   now; the pure-`dispatch()` shape doesn't need to be typed against real code to be
   reviewed.

### Three questions for the team

1. Does finishing the Phase 2 command-path slice this week take priority over continuing
   backend/cloud skeleton work, given that infra work alone doesn't unblock Phase 3?
2. Should the entity-ID/render-map question be resolved before or alongside the
   `MediaAsset`/`Component` schema, since attachments reference object ids directly?
3. Is the [REAL] infra track (Compose, Postgres, MinIO, deploy) explicitly authorized to
   keep moving in parallel this week regardless of who finishes the command path, since it
   has no dependency on `ProjectData`'s shape?

### Decision

**Approve:**
- `docker-compose.yml` / `.env.example` / `config.py` / `db.py` / Alembic init (Stage 1 of
  the existing plan) — no dependency on Phase 2.
- Paper-only design of the Asset Manager's resolver interface.
- Paper-only design of the WHEN→DO event/action vocabulary.
- This guidelines doc, as the standing guardrail for both once building starts.

**Postpone:**
- Wiring `AssetRef` into `SceneObject` or `Component` types.
- Scaffolding `packages/interaction` or `packages/components` as buildable skeleton code.
- Finalizing the `MediaAsset`/`ContentSnapshot`/`InteractionRule` column shape beyond
  storage-key bookkeeping.

Until: the Phase 2 command-path slice merges, **and** the entity-ID/render-map question
from the 2026-09-15 review has an answer.
