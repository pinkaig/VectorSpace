/**
 * @file        SyncResult.ts
 * @brief       The outcome of attempting to sync one queued change.
 *
 * @responsibility
 * A single shape callers switch on after a sync attempt: succeeded outright,
 * failed but worth retrying, failed permanently, or hit a conflict (server
 * revision moved past the change's base revision). Conflict resolution
 * itself is out of scope here — see SyncService in @vectorspace/sync's Considerations.
 *
 *
 * @status
 * NOT PART OF M1. Cloud sync is deferred to a later milestone. This logic is
 * implemented and unit-tested, but no server exists to sync against: the editor
 * wires the package to a StubSyncTransport (src/sync/projectSync.ts) that reports
 * success without sending anything. Durable save for M1 is localStorage, via
 * src/serializer.ts.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Sync-Engine
 * Links point at the project wiki; migration is still in progress.
 */

export interface SyncResult {
  success: boolean
  /** Set when the server's current revision is newer than the change's base revision. */
  conflictWith?: number
  /** True if this failure is transient and the change should stay queued for retry. */
  retryable?: boolean
  /** The new head revision after a successful write. */
  newRevision?: number
}

export const syncSuccess = (newRevision: number): SyncResult => ({ success: true, newRevision })

export const syncConflict = (conflictWith: number): SyncResult => ({
  success: false,
  conflictWith,
  retryable: false,
})

export const syncRetryableFailure = (): SyncResult => ({ success: false, retryable: true })

export const syncPermanentFailure = (): SyncResult => ({ success: false, retryable: false })
