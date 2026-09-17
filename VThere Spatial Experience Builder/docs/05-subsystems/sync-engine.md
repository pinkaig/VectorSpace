# Sync Engine

## Purpose

Give local edits a place to land immediately and a reliable path to the server later, without
the rest of the app knowing whether it's online, mid-retry, or conflicted. Callers stage a
change once; the sync engine handles dual-write, retry with backoff, and conflict
*detection*. It deliberately does not decide conflict *resolution* — that's a product decision
left for a later stage.

## Boundary

```text
Caller (e.g. App.tsx save callback)
          |
          | stage(QueuedChange)
          v
packages/sync
  SyncClient
    .stage()      -> LocalStore.write() (immediate)  +  SyncQueue.enqueue() (background)
    .syncNext()   -> SyncTransport.send(change) -> SyncResult
                       success        -> dequeue, state 'idle'/'pending'
                       conflictWith   -> state 'conflict', change stays queued
                       retryable      -> incrementRetries, state 'pending' or 'failed'
          |
          v
  SyncService.drain()  -- repeatedly calls syncNext() until idle/conflict/failed
  SyncService.resolveConflict()  -- NOT IMPLEMENTED (product decision, not sync mechanics)
```

Stage 4c (current) builds the queue/client/service vehicle only. Nothing calls `stage()` from
the real editor yet, there is no real `SyncTransport` (HTTP client), and no persistence
adapter beyond the injectable `QueueStorage`/`LocalStore` interfaces. Wiring `App.tsx`'s save
path and a real localStorage/IndexedDB adapter is future work per
[`2026-09-17--PLAN--infrastructure-skeleton-extended.md`](../07-research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md).

## Where to find things

| Concern | Current owner |
|---|---|
| Queued change shape, FIFO queue, retry counter | [`packages/sync/src/SyncQueue.ts`](../../packages/sync/src/SyncQueue.ts) |
| Queue persistence contract + in-memory test double | [`packages/sync/src/SyncQueue.ts`](../../packages/sync/src/SyncQueue.ts) (`QueueStorage`, `InMemoryQueueStorage`) |
| Sync outcome shape (success/conflict/retryable) | [`packages/sync/src/SyncResult.ts`](../../packages/sync/src/SyncResult.ts) |
| State machine (idle/pending/conflict/failed), dual-write, backoff, retry limit | [`packages/sync/src/SyncClient.ts`](../../packages/sync/src/SyncClient.ts) |
| Transport contract every backend implements | [`packages/sync/src/SyncClient.ts`](../../packages/sync/src/SyncClient.ts) (`SyncTransport`) |
| Local dual-write store contract + in-memory test double | [`packages/sync/src/SyncClient.ts`](../../packages/sync/src/SyncClient.ts) (`LocalStore`, `InMemoryLocalStore`) |
| Per-resource orchestration (drain the queue) | [`packages/sync/src/SyncService.ts`](../../packages/sync/src/SyncService.ts) |
| Conflict-resolution seam (throws — not yet a decision) | [`packages/sync/src/SyncService.ts`](../../packages/sync/src/SyncService.ts) (`resolveConflict`) |

### Dual-write staging

`SyncClient.stage(change)` writes to `LocalStore` synchronously and enqueues the same change
onto `SyncQueue` in the same call. Reads always come from `LocalStore` — nothing in this
package reads from the server, so a caller sees its own write immediately regardless of
network state. `LocalStore`/`QueueStorage` are interfaces so a real localStorage/IndexedDB
adapter can be substituted with no change to `SyncClient`.

### Conflict detection

Every `QueuedChange` carries the `revision` it was built on. A `SyncTransport` returns
`SyncResult.conflictWith` (a newer server revision) when the write's base revision is stale.
`SyncClient.syncNext()` treats any `conflictWith` as terminal for that change: it stops
retrying, sets state to `'conflict'`, and **leaves the change in the queue** — nothing is lost,
nothing is silently overwritten. `packages/sync/src/SyncClient.test.ts` verifies this directly
with a scripted transport that returns a conflicting revision.

### Idempotency, retry, and backoff

Each `QueuedChange` carries a client-generated `idempotencyKey`, stable across retries, so a
transport/server can deduplicate a change that was retried after actually succeeding (e.g. the
response was lost, not the write). `SyncClient.backoffFor(retries)` returns an exponentially
doubling delay (`baseBackoffMs * 2^retries`); `SyncClient` itself does not sleep or schedule —
it only tracks `retries` per change and reports `isExhausted()` once `maxRetries` is hit, at
which point `syncNext()` sets state to `'failed'`. Callers (a background loop, a "retry now"
button) decide when to call `syncNext()` again.

### SyncService: orchestration, not policy

`SyncService.drain()` repeatedly calls `SyncClient.syncNext()` until the queue is empty or a
conflict/failure stops it — that's the only orchestration this stage builds. Deciding *what to
do* about a conflict (merge, overwrite, ask the user) is explicitly out of scope: `SyncService
.resolveConflict()` always throws, naming the resource kind, so the seam exists without a
policy decision baked into it prematurely.

## Owns

- The `QueuedChange` / `SyncResult` / `SyncTransport` / `LocalStore` contracts
- Dual-write staging (local write + queue enqueue happen together)
- Sync state machine: `idle | pending | conflict | failed`
- Retry counting, exponential backoff calculation, and a configurable retry ceiling
- Conflict *detection* via revision mismatch, and leaving conflicted changes queued rather
  than dropping them
- Queue persistence through an injectable `QueueStorage`, so the queue can survive a reload

## Does not own

- Conflict *resolution* policy (merge/overwrite/ask-user) — reserved for `SyncService
  .resolveConflict()`, not yet implemented; a separate product decision per resource type
- The real HTTP transport, server-side deduplication, or which side wins on conflict — that's
  backend work (`apps/api`), not yet built
- A real browser persistence adapter (localStorage/IndexedDB) — only the `QueueStorage` /
  `LocalStore` interfaces and in-memory test doubles exist today
- Scheduling/looping retries with real backoff delays (`setTimeout`, reconnect listeners) — a
  caller (background loop, UI) decides when to call `syncNext()` again
- Wiring into `App.tsx`'s save callback or `serializer.ts` — not yet integrated

## Considerations and limits

**No real transport exists.** `SyncTransport` is an interface; every test drives it with a
scripted in-memory stub. There is no HTTP implementation yet and no corresponding backend
endpoint — both depend on backend work not yet built (project/asset/rule persistence APIs).

**No real persistence adapter.** `QueueStorage` and `LocalStore` are interfaces with only
`InMemoryQueueStorage`/`InMemoryLocalStore` test doubles. Nothing in this package touches
`window.localStorage` or IndexedDB yet — "queue persists across simulated restarts" is
verified by constructing a fresh `SyncQueue`/`SyncClient` against the *same storage instance*,
not an actual browser reload.

**Conflict resolution is unimplemented on purpose.** `SyncService.resolveConflict()` always
throws. A conflicted change sits in `'conflict'` state indefinitely until something calls
`resolveConflict()` — which doesn't exist yet — or a caller manually removes/re-stages the
change. There is no default "last write wins" or auto-merge behavior; building one without a
product decision would bake in a policy nobody signed off on.

**Retry/backoff timing is computed, not scheduled.** `backoffFor()` returns a number of
milliseconds; nothing in this package calls `setTimeout` or listens for a network-reconnect
event. A caller must build the actual retry loop (or a reconnect-triggered one) on top of
`syncNext()`, `backoffFor()`, and `isExhausted()`.

**`SyncService.drain()` is a straight-line loop, not a scheduler.** It calls `syncNext()`
back-to-back with no delay between attempts, which is correct for tests (everything resolves
synchronously against a stub) but not what should run against a real network — a caller
driving real syncs should insert `backoffFor()`-based delays between `syncNext()` calls
instead of using `drain()` directly, or `drain()` should grow that behavior once real timing
is decided.

**No de-duplication of identical concurrent stages.** Calling `stage()` twice for the same
`id` enqueues two entries rather than merging them; `SyncQueue` treats `id` as an entry
identifier, not a dedupe key. `idempotencyKey` protects against a *retried* send being applied
twice server-side, but two independent `stage()` calls for the same logical resource both
queue and both send.

**Payload/serialization is caller's responsibility.** `SyncQueue` persists via
`JSON.stringify`/`JSON.parse`, so a `payload` that isn't JSON-safe (e.g. containing a `Blob`
or a class instance with methods) will not round-trip correctly through `QueueStorage`. This
matches the primitive-only assumption used throughout the current test doubles, not yet a
documented payload contract.

## Build sequence

### Stage 4c: sync vehicle (this stage)

- Define `QueuedChange`, `SyncResult`, `SyncTransport`, `LocalStore`, `QueueStorage`.
- Implement `SyncQueue` (FIFO, persisted via injectable storage) and `SyncClient` (dual-write,
  state machine, conflict detection, retry/backoff accounting).
- Implement `SyncService` as a thin per-resource orchestrator; leave `resolveConflict()`
  unimplemented on purpose.
- Acceptance: `npm run test -- packages/sync` passes; queue persists across a simulated
  restart (`SyncQueue.test.ts`, `SyncClient.test.ts`); retry/backoff logic is tested
  (`SyncClient.test.ts`); conflict is detected via revision mismatch in a test
  (`SyncClient.test.ts`, `SyncService.test.ts`).

### Planned (not yet scoped to a stage): real transport + persistence

- A real `SyncTransport` backed by backend project/asset/rule write endpoints.
- A real `QueueStorage`/`LocalStore` backed by `localStorage` or IndexedDB.
- Wiring `App.tsx`'s save callback and `serializer.ts` (current Tier 1 autosave) to call
  `SyncClient.stage()` as Tier 2.
- A real retry loop with actual backoff timing and network-reconnect triggering.

### Planned (not yet scoped to a stage): conflict resolution policy

- Decide merge/overwrite/ask-user strategy per resource type (project, asset, rule).
- Implement `SyncService.resolveConflict()` against that decision.
- Server-side write deduplication and "who wins" policy on the backend.
