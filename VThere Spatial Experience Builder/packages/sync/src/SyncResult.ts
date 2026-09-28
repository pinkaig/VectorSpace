/**
 * @file        SyncResult.ts
 * @brief       The outcome of attempting to sync one queued change.
 *
 * @responsibility
 * A single shape callers switch on after a sync attempt: succeeded outright,
 * failed but worth retrying, failed permanently, or hit a conflict (server
 * revision moved past the change's base revision). Conflict resolution
 * itself is out of scope here — see SyncService in @vthere/sync's Considerations.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/sync-engine.md
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
