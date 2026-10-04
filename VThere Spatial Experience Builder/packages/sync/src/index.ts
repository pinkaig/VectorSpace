/**
 * @file        index.ts
 * @brief       Public entry point for the sync package.
 *
 * @responsibility
 * Re-exports the queue, client, result, and service types. This file is the
 * package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports do
 * not resolve. Anything consumers need must be re-exported here.
 *
 * @status
 * NOT PART OF M1. Cloud sync is deferred to a later milestone. The queue,
 * retry, and conflict-detection logic here is implemented and unit-tested,
 * but no server exists to sync against: the editor wires this package to a
 * StubSyncTransport (src/sync/projectSync.ts) that reports success without
 * sending anything. Durable save for M1 is localStorage, via src/serializer.ts.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Sync-Engine
 * Links point at the project wiki; migration is still in progress.
 */
export type { SyncOp, QueuedChange, QueueStorage } from './SyncQueue'
export { SyncQueue, InMemoryQueueStorage } from './SyncQueue'

export type { SyncResult } from './SyncResult'
export { syncSuccess, syncConflict, syncRetryableFailure, syncPermanentFailure } from './SyncResult'

export type { SyncState, SyncTransport, LocalStore, SyncClientOptions } from './SyncClient'
export { SyncClient, InMemoryLocalStore } from './SyncClient'

export type { ResourceKind } from './SyncService'
export { SyncService } from './SyncService'
