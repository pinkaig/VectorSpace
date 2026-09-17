# Sync Engine

## Purpose

Give local edits a place to land immediately and a reliable path to the server later, without
the rest of the app knowing whether it's online, mid-retry, or conflicted. Callers stage a
change once; the sync engine handles dual-write, retry with backoff, and conflict
*detection*. It deliberately does not decide conflict *resolution* — that's a product decision
left for a later stage.

## Boundary

```text
App.tsx persist()  -- Tier 1: serializer.ts saveProject() (synchronous, localStorage)
          |
          | stageProjectSync(project)  -- Tier 2, only after Tier 1 succeeds
          v
src/sync/projectSync.ts (ProjectSync)
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
  ProjectSync's own drive loop -- steps syncNext() directly (not SyncService.drain(),
  which collapses the intermediate 'pending' state a UI needs to observe), scheduling a
  backoff retry via SyncClient.backoffFor() on transient failure and re-driving on
  the browser's 'online' event
  SyncService.resolveConflict()  -- still NOT IMPLEMENTED (product decision, not sync mechanics)
```

Stage 4c built the queue/client/service vehicle. Stage 8 wired it into the editor:
`src/sync/projectSync.ts` (`createProjectSync`) adapts `SyncClient` with a
`localStorage`-backed `QueueStorage` (so the queue survives a reload) and a stub
`SyncTransport` that always succeeds (no backend write endpoint exists yet — Stage 3's routes
are still 501). `App.tsx`'s `persist()` dual-writes: Tier 1 (`serializer.ts`'s synchronous
`saveProject`) happens first and is authoritative for reads, then Tier 2
(`stageProjectSync`) enqueues the same project for background sync. The rail-footer sync
status line (`Synced` / `Syncing to server…` / `Sync conflict; local edits kept` / `Sync
failed, will retry`) subscribes to `ProjectSync.subscribe()`. Swapping the stub transport for
a real HTTP client requires no change to `App.tsx` or `projectSync.ts`'s public surface — only
`ProjectSyncOptions.transport`.

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
conflict/failure stops it. `src/sync/projectSync.ts` does not use `drain()` — it steps
`syncNext()` directly so it can observe the transient `'pending'` state `drain()` discards (see
Considerations below) — but `SyncService` remains the package's per-resource orchestration
seam for a caller that doesn't need that. Deciding *what to do* about a conflict (merge,
overwrite, ask the user) is explicitly out of scope: `SyncService.resolveConflict()` always
throws, naming the resource kind, so the seam exists without a policy decision baked into it
prematurely.

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
  backend work (`apps/api`), not yet built. `src/sync/projectSync.ts`'s `StubSyncTransport`
  always succeeds so the client-side path can be exercised end-to-end
- IndexedDB persistence — `src/sync/projectSync.ts`'s `LocalStorageQueueStorage` uses
  `localStorage`, matching Tier 1's storage; swapping to IndexedDB needs no change to
  `packages/sync`

## Considerations and limits

**No real transport exists.** `SyncTransport` is an interface; `packages/sync`'s own tests
drive it with a scripted in-memory stub, and `src/sync/projectSync.ts`'s `StubSyncTransport`
always reports success — there is no HTTP implementation yet and no corresponding backend
endpoint (Stage 3's routes are still 501). Swapping in a real transport is a matter of passing
a different `ProjectSyncOptions.transport`; no other code changes.

**Queue persistence now uses real `localStorage`.** `src/sync/projectSync.ts`'s
`LocalStorageQueueStorage` writes the serialized queue to
`localStorage['vthere-sync-queue-v1']`, so an offline edit staged before a reload is still
queued after one. `packages/sync`'s own tests still use `InMemoryQueueStorage`/
`InMemoryLocalStore`, which remains the right choice there — that package has no browser
dependency and shouldn't gain one just for its own tests.

**Conflict resolution is unimplemented on purpose.** `SyncService.resolveConflict()` always
throws. A conflicted change sits in `'conflict'` state indefinitely until something calls
`resolveConflict()` — which doesn't exist yet — or a caller manually removes/re-stages the
change. There is no default "last write wins" or auto-merge behavior; building one without a
product decision would bake in a policy nobody signed off on.

**Retry/backoff timing is computed by `packages/sync`, scheduled by `projectSync.ts`.**
`backoffFor()` returns a number of milliseconds; `packages/sync` itself calls no `setTimeout`
and listens for no reconnect event. `src/sync/projectSync.ts` is the caller that does: on a
retryable failure it calls `scheduleTimeout(retryCallback, client.backoffFor(retries))`
(default `setTimeout`, injectable for tests), and re-drives the queue immediately on the
browser's `online` event.

**`ProjectSync`'s drive loop calls `SyncClient.syncNext()` directly, not
`SyncService.drain()`.** `SyncService.drain()` only reports the *final* state after its
internal loop finishes, which collapses the transient `'pending'` state the sync-status UI
needs to show while a change is in flight. `projectSync.ts` steps `syncNext()` itself in a
loop, reading `client.status` immediately after each call (before awaiting it) to catch that
transient state — see the code comment on `drain()` in `src/sync/projectSync.ts` for why the
status must be read before, not after, awaiting `syncNext()`.

**`stage()` needs a per-change queue id distinct from the resource id.** `SyncQueue` treats
`QueuedChange.id` as the entry identifier that `remove()`/`incrementRetries()` key off, not a
resource identifier — two changes to the same project sharing that id would collide (a second
edit would silently vanish instead of queuing behind the first). `projectSync.ts`'s `stage()`
uses `` `${project.id}-${revision}` `` per call; `idempotencyKey` is a separate concept that
still protects a *retried* send of the same change from being applied twice server-side.

**Payload/serialization is caller's responsibility.** `SyncQueue` persists via
`JSON.stringify`/`JSON.parse`, so a `payload` that isn't JSON-safe (e.g. containing a `Blob`
or a class instance with methods) will not round-trip correctly through `QueueStorage`. This
matches the primitive-only assumption used throughout the current test doubles, not yet a
documented payload contract.

## Build sequence

### Stage 4c: sync vehicle

- Define `QueuedChange`, `SyncResult`, `SyncTransport`, `LocalStore`, `QueueStorage`.
- Implement `SyncQueue` (FIFO, persisted via injectable storage) and `SyncClient` (dual-write,
  state machine, conflict detection, retry/backoff accounting).
- Implement `SyncService` as a thin per-resource orchestrator; leave `resolveConflict()`
  unimplemented on purpose.
- Acceptance: `npm run test -- packages/sync` passes; queue persists across a simulated
  restart (`SyncQueue.test.ts`, `SyncClient.test.ts`); retry/backoff logic is tested
  (`SyncClient.test.ts`); conflict is detected via revision mismatch in a test
  (`SyncClient.test.ts`, `SyncService.test.ts`).

### Stage 8: wire sync into autosave (done)

- `src/sync/projectSync.ts`: `createProjectSync()` adapts `SyncClient` with a
  `localStorage`-backed `QueueStorage` and a stub `SyncTransport`; drives `syncNext()` directly
  in a loop (not `SyncService.drain()`) so the transient `'pending'` state is observable;
  schedules backoff retries via an injectable `scheduleTimeout` and re-drives on the browser's
  `online` event.
- `App.tsx`'s `persist()` dual-writes: Tier 1 (`serializer.ts`'s synchronous `saveProject`)
  first, then Tier 2 (`stageProjectSync`) only if Tier 1 didn't fail.
- Sync status surfaced via the existing rail-footer status-dot pattern, subscribed through
  `subscribeProjectSync`.
- Acceptance: `npm run test`, `npm run typecheck`, `npm run build` all pass;
  `src/sync/projectSync.test.ts` covers staging, status transitions, retry-on-failure, queue
  persistence across a simulated reload (same storage instance), and in-order delivery of
  multiple queued offline edits.

### Planned (not yet scoped to a stage): real transport

- A real `SyncTransport` backed by backend project/asset/rule write endpoints, swapped in via
  `ProjectSyncOptions.transport` — no change needed to `App.tsx` or the rest of
  `projectSync.ts`.

### Planned (not yet scoped to a stage): conflict resolution policy

- Decide merge/overwrite/ask-user strategy per resource type (project, asset, rule).
- Implement `SyncService.resolveConflict()` against that decision.
- Server-side write deduplication and "who wins" policy on the backend.
