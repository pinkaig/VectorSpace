# Frontend business-logic backlog

**Baseline phase:** Stage 4a/4b/4c (frontend tracks). See [8-stage baseline overview](../../code/baseline-phases.md).

**Purpose:** persist the reassessed 12-step order from `SESSION.md`'s "2026-09-17 Phase/Stage
reassessment" section as a tracked file, so it survives context compaction instead of living
only in conversation history (open question raised in that section). Split into a frontend
track (client-side packages and editor/runtime wiring — no backend dependency) and a backend
track (Docker/Postgres/API), since the current direction is to prioritize frontend business
logic.

Source plans this reassesses: `TECH_LEAD_INFRASTRUCTURE_PLAN.md` (old Phase 0–6) and
`2026-09-17--PLAN--infrastructure-skeleton-extended.md` (new Stage 1–8, superseding numbering
for anything it covers).

## Status as of 2026-09-17 (end of day)

| # | Step | Track | Status | Blocked by |
|---|---|---|---|---|
| 1 | Phase 2 — command-path service (`TransformCommand`, move/rotate/scale) | Frontend | **Done** — `573def4`, `c027666` | — |
| 2 | Hierarchy UI — parent-child slice 4 (scene-tree indentation, indent/outdent, Parent dropdown) | Frontend | **Done** — `316c3f8` | — |
| 3 | Transform inheritance — parent-child slice 5 (local-space transforms, reparent preserves world position) | Frontend | **Done** — `7cbb708` | — |
| 4 | Stage 1 — local dev environment (Docker/Postgres/MinIO/config/Alembic scaffold) | Backend | **Not started** (deprioritized — see pivot below) | — |
| 5 | Stage 4a — Asset Manager package (`packages/assets`: `AssetRef`, `AssetDescriptor`, `AssetResolver`, 3 resolvers, cache/TTL) | Frontend | Not started | — |
| 6 | Stage 4c — Sync Engine package (`packages/sync`: `SyncQueue`, `SyncClient`, `SyncResult`, dual-write, conflict detection) | Frontend | Not started | — |
| 7 | Stage 2 — data model + migration (Organisation/Actor/Project/.../InteractionRule tables) | Backend | Not started | Stage 1 |
| 8 | Stage 3 — backend HTTP surface (routers, Auth0 JWT, presigned URLs, all handlers `501`) | Backend | Not started | Stage 2 |
| 9 | Stage 6 — wire Asset Manager into frontend (`SceneObject.assetId` → resolver, viewport raycasting) | Frontend | Not started | Stage 4a (#5) |
| 10 | Stage 4b + Stage 7 — WHEN→DO engine (`packages/interaction`: `RuntimeEvent`/`RuntimeState`/`DispatchResult`, pure `dispatch()`) + wiring into runtime (gizmo/pointer → dispatcher → action executors) | Frontend | Not started — **now unblocked**, Phase 2 (#1) merged | — (was: Phase 2) |
| 11 | Stage 8 — wire Sync into autosave (`serializer.ts` dual-write, reconnect retry) | Frontend | Not started | Stage 4c (#6) |
| 12 | Stage 5 — production deploy (Dockerfiles, Caddy, GitHub Actions SSH deploy) | Backend | Not started | Stage 3 (#8) |

## 2026-09-17 pivot: frontend business logic first

Step 4 (Stage 1, local dev environment) was started — the plan section was read — then the
session was redirected to frontend business logic before any files were written. No
`docker-compose.yml`, `.env.example`, or `apps/api/*` files exist yet; Stage 1 is genuinely
untouched on disk. Backend track (steps 4, 7, 8, 12) is deprioritized, not cancelled.

**Immediately actionable frontend work, in dependency order:**

1. **Step 10 (WHEN→DO engine + wiring)** — full spec in
   [`2026-09-17--PLAN--when-do-dispatch-engine.md`](2026-09-17--PLAN--when-do-dispatch-engine.md).
   The biggest unlock: it was the one frontend step still gated on Phase 2, which is now
   merged. Per `2026-09-17--HANDOFF--when-do-runtime-logic-considerations.md`, only the
   *types and dispatch design* were pre-approved to start before Phase 2; the real
   `packages/interaction` code was explicitly told to wait. That wait condition is satisfied.
2. **Step 5 (Asset Manager)** — full spec in
   [`2026-09-17--PLAN--asset-manager-vehicle.md`](2026-09-17--PLAN--asset-manager-vehicle.md) —
   and **step 6 (Sync Engine)** — full spec in
   [`2026-09-17--PLAN--sync-engine-vehicle.md`](2026-09-17--PLAN--sync-engine-vehicle.md) —
   have no blockers and can run in parallel with step 10 or with each other; they touch
   different packages (`packages/assets`, `packages/sync`) with no shared files.
3. **Step 9 (wire Asset Manager into frontend)** follows step 5.
4. **Step 11 (wire Sync into autosave)** follows step 6.

## Per-step scope reference

Each frontend package now has its own fully self-contained spec (scope, `[REAL]` vs
`[SKELETON]` boundary, data shapes, file list, integration points, acceptance criteria),
split out of the shared `2026-09-17--PLAN--infrastructure-skeleton-extended.md` doc so each
feature reads as one complete document instead of a subsection of a larger one:

- Step 5 (Asset Manager): [`2026-09-17--PLAN--asset-manager-vehicle.md`](2026-09-17--PLAN--asset-manager-vehicle.md)
- Step 10 (WHEN→DO Engine): [`2026-09-17--PLAN--when-do-dispatch-engine.md`](2026-09-17--PLAN--when-do-dispatch-engine.md)
- Step 6 (Sync Engine): [`2026-09-17--PLAN--sync-engine-vehicle.md`](2026-09-17--PLAN--sync-engine-vehicle.md)

Each of those is also pointed to from a short stub in `docs/05-subsystems/` (the subsystem
index), marked "planned, not yet implemented," so the summary-of-systems view surfaces planned
work alongside built subsystems without pretending it's already built.

Steps 4, 7, 8, 12 (the backend track: Stage 1 local dev env, Stage 2 data model, Stage 3 HTTP
surface, Stage 5 deploy) remain documented only in the shared
`2026-09-17--PLAN--infrastructure-skeleton-extended.md` for now, since the backend track is
deprioritized per the 2026-09-17 pivot below — split those into their own files too if/when
backend work resumes.

The original twelve per-step agent prompts referenced in SESSION.md's "2026-09-17 Phase/Stage
reassessment" section were written out in that conversation but were never saved verbatim to a
file before that conversation ended — only the one-line-per-step summary above survived into
SESSION.md. Re-derive a step's exact prompt from the linked plan doc's section + this table's
row rather than assuming a verbatim prompt still exists somewhere.

## Model/effort guidance carried over from the reassessment

- Sonnet 5, direct mode: mechanical scaffolding (config, packages, tests, docs) — steps 4, 5, 6.
- Sonnet 5 + Plan Mode: anything touching shared history/undo/transform semantics, or wiring
  one package into another — steps 9, 11.
- Opus 5 + Plan Mode: architecturally load-bearing steps where a wrong first draft is expensive
  to unwind — step 10 (WHEN→DO wiring into the render loop) is the remaining one in this
  category; Phase 2 (step 1, the other one) is done.

## Next recommended step

Start step 10 (WHEN→DO engine) in its own session, Opus 5 + Plan Mode, since it's now unblocked
and is the architecturally riskiest remaining frontend piece. Steps 5 and 6 can run in parallel
background sessions without waiting on step 10.
