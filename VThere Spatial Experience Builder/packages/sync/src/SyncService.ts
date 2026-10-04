/**
 * @file        SyncService.ts
 * @brief       Skeleton orchestrator for the sync flow per resource type.
 *
 * @responsibility
 * Ties a SyncClient's mechanics (queue, transport, retry) to a specific
 * resource type (project/asset/rule) and drives it to completion: keep
 * calling syncNext() until idle, failed, or conflict. Deliberately does NOT
 * decide what to do on conflict — merge vs. overwrite vs. ask-the-user is a
 * product decision out of scope for this stage. `resolveConflict()` exists
 * as the seam that decision will plug into and throws until it's made.
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
import type { SyncClient } from './SyncClient'
import type { SyncResult } from './SyncResult'

export type ResourceKind = 'project' | 'asset' | 'rule'

export class SyncService<TPayload = unknown> {
  constructor(
    private readonly resourceKind: ResourceKind,
    private readonly client: SyncClient<TPayload>,
  ) {}

  /**
   * Drains the queue: calls syncNext() repeatedly until it's empty (idle),
   * hits a conflict, or exhausts retries (failed). Does not implement
   * backoff sleeping itself — a caller wanting real backoff timing should
   * drive syncNext() directly using SyncClient.backoffFor().
   */
  async drain(): Promise<SyncResult[]> {
    const results: SyncResult[] = []
    while (true) {
      const before = this.client.status
      const result = await this.client.syncNext()
      if (!result) break
      results.push(result)
      if (this.client.status === 'conflict' || this.client.status === 'failed') break
      if (this.client.status === before && this.client.status === 'pending' && !result.success) break
    }
    return results
  }

  /**
   * Not implemented: deciding how to resolve a conflict (merge, overwrite,
   * ask the user) for this.resourceKind is a separate product decision, not
   * a sync-mechanics one. This method is the reserved seam for that policy.
   */
  resolveConflict(): never {
    throw new Error(
      `SyncService.resolveConflict() is not implemented for resource kind "${this.resourceKind}" — ` +
        'conflict resolution strategy (merge/overwrite/ask-user) is a product decision not yet made.',
    )
  }
}
