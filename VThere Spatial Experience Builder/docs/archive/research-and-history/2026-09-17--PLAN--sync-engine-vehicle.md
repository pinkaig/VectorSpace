# Local→Cloud Sync Engine — the persistence vehicle

**Status:** Planned, not yet implemented. No blockers — can start immediately, in parallel
with the Asset Manager and WHEN→DO engine.
**Origin:** Extracted from `2026-09-17--PLAN--infrastructure-skeleton-extended.md` (Stage 4c +
Stage 8) into its own file per the 2026-09-17 frontend-business-logic-backlog split.

**Baseline phase:** Stage 4c (Sync Engine). See [8-stage baseline overview](../../code/baseline-phases.md).
**Tracking:** row 6 in `2026-09-17--PLAN--frontend-business-logic-backlog.md`.
**Subsystem index entry:** `docs/05-subsystems/sync-engine.md` (stub, links back here).

## What it is

The infrastructure that keeps local and server state in sync — not the data model, and not
the conflict-resolution policy. It answers "how does a locally-made edit eventually and
reliably reach the server, surviving being offline," independent of what a "conflict" means
for any particular resource type.

## Why this matters now

`src/serializer.ts` already autosaves to `localStorage` (Tier 1). There is no Tier 2 today —
if the browser storage is cleared or the user switches devices, that work is gone. This
vehicle is what makes Tier 1 durable rather than replacing it.

## [REAL] infrastructure — sync mechanics, not business logic

- `packages/sync/src/SyncQueue.ts` — queues local changes:
  ```ts
  interface QueuedChange {
    id: string
    op: string
    revision: number
    payload: unknown
    idempotencyKey: string
    retries: number
  }
  ```
- `packages/sync/src/SyncClient.ts` — manages sync state (`'idle' | 'pending' | 'conflict' |
  'failed'`), retry backoff, TTL/expiry for queued entries.
- `packages/sync/src/SyncResult.ts` — outcome per write:
  ```ts
  interface SyncResult {
    success: boolean
    conflictWith?: unknown
    retryable?: boolean
    newRevision?: number
  }
  ```
- Dual-write staging: every write goes to local storage *and* the sync queue; reads come from
  local until the server confirms — the editor never blocks on network round-trips.
- Conflict detection: every queued write carries the base revision it was built from; the
  server returns a conflict result if its current head revision is newer.
- Idempotency: every write carries a client-generated id; retrying the same write (e.g. after
  a dropped connection) must not double-apply on the server.
- Fallback chain: local autosave → queued sync → retry on reconnect → offline buffer. At no
  point does a network failure block or corrupt the local save.

## [SKELETON] domain logic — deferred

- `SyncService` — orchestrates the sync flow for a *specific* resource (project vs. asset vs.
  rule may have different sync cadence/priority). The queue/client/result types above are
  resource-agnostic; `SyncService` is where "which resource, what strategy" decisions live.
- Conflict resolution strategy per resource type (merge / overwrite / ask-user) — a decision
  tree, deferred until there's a concrete conflict scenario to design against.
- Server-side write deduplication and "who wins" policy — a Stage 3 (backend) concern once
  the API exists to enforce it.

## Integration points

- `src/serializer.ts`'s current `localStorage` autosave becomes Tier 1; this package is Tier
  2. No change to Tier 1's existing behavior — it's additive.
- `App.tsx`'s save callback becomes: local write (immediate, unchanged) + sync queue push
  (background, new).
- Asset upload path (once Asset Manager's `RemoteMediaResolver` is real): local preview URL →
  background presigned-URL upload → mark-uploaded on success, using this queue's retry
  mechanics rather than a bespoke upload retry loop.
- Network reconnect (`window.addEventListener('online', ...)`) retries queued writes in
  queue order.
- UI surfaces sync state as a status string: "Saving locally…" / "Syncing to server…" /
  "Synced" / "Sync failed, will retry" — a small, additive UI element, not a redesign of the
  existing save-status display.

## Files to create

```
packages/sync/
  package.json            ("exports": "./src/index.ts")
  src/
    index.ts
    SyncQueue.ts
    SyncClient.ts
    SyncResult.ts
    SyncQueue.test.ts       (persistence across reload, ordering)
    SyncClient.test.ts      (retry backoff, conflict detection, idempotency)
```

## Acceptance criteria

- `npm run test -- packages/sync` passes.
- A user can "edit offline": changes persist locally and queue correctly with the network
  simulated as unavailable.
- Changes sync to a (test-double) server once "online" again, in the order they were queued.
- A failed sync attempt queues and retries without losing or duplicating the local edit.
- Idempotency is directly tested: replaying the same queued write twice against a test-double
  server produces one applied change, not two.

## Dependencies

- Stage 8 (wiring this into `serializer.ts`'s autosave path) needs this package to exist
  first, but the package itself (queue/client/result types, retry/conflict/idempotency logic)
  has no dependency on the backend or on Stage 2's data model — it can be built and fully
  tested against fixtures and a test-double server today.

## Suggested model/effort tier

Sonnet 5, direct mode for the package itself (mechanical, well-specified contracts). Sonnet 5
+ Plan Mode for the Stage 8 wiring step, since it touches the existing autosave path that
users already depend on.
