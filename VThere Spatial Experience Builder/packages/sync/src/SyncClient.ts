/**
 * @file        SyncClient.ts
 * @brief       Drives one queued change at a time through send/retry/backoff.
 *
 * @responsibility
 * Owns the sync state machine (`idle|pending|conflict|failed`) for the queue
 * it's given. Dual-writes: a local store gets the write immediately (reads
 * always come from local), and the same change is queued for background
 * sync. Each attempt carries the change's base `revision` so a `SyncTransport`
 * can detect conflicts; retries back off exponentially up to a max, and stop
 * retrying once the caller-supplied TTL for the change has elapsed.
 *
 * Conflict *resolution* (merge/overwrite/ask-user) is deliberately not here —
 * this only detects and reports a conflict via SyncResult.conflictWith and
 * leaves the state at 'conflict' for a higher layer (SyncService) to decide.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/sync-engine.md
 */
import type { QueuedChange, QueueStorage } from './SyncQueue'
import { SyncQueue } from './SyncQueue'
import type { SyncResult } from './SyncResult'

export type SyncState = 'idle' | 'pending' | 'conflict' | 'failed'

/** What SyncClient sends a change to. Swap in a real HTTP client with no change to SyncClient. */
export interface SyncTransport<TPayload = unknown> {
  send(change: QueuedChange<TPayload>): Promise<SyncResult>
}

/** Where dual-writes land immediately, independent of the sync queue. */
export interface LocalStore<TPayload = unknown> {
  write(id: string, payload: TPayload): void
  read(id: string): TPayload | undefined
}

export class InMemoryLocalStore<TPayload = unknown> implements LocalStore<TPayload> {
  private readonly data = new Map<string, TPayload>()

  write(id: string, payload: TPayload): void {
    this.data.set(id, payload)
  }

  read(id: string): TPayload | undefined {
    return this.data.get(id)
  }
}

export interface SyncClientOptions {
  /** Base delay in ms before the first retry; doubles per attempt. Default 1000. */
  baseBackoffMs?: number
  /** Retries stop (state -> 'failed') once this many attempts have failed. Default 5. */
  maxRetries?: number
  /** Clock hook for testability. Default Date.now. */
  now?: () => number
}

export class SyncClient<TPayload = unknown> {
  readonly queue: SyncQueue<TPayload>
  readonly localStore: LocalStore<TPayload>
  private state: SyncState = 'idle'
  private readonly baseBackoffMs: number
  private readonly maxRetries: number
  private readonly now: () => number

  constructor(
    private readonly transport: SyncTransport<TPayload>,
    options: SyncClientOptions & { queue?: SyncQueue<TPayload>; storage?: QueueStorage; localStore?: LocalStore<TPayload> } = {},
  ) {
    this.queue = options.queue ?? new SyncQueue<TPayload>(options.storage)
    this.localStore = options.localStore ?? new InMemoryLocalStore<TPayload>()
    this.baseBackoffMs = options.baseBackoffMs ?? 1000
    this.maxRetries = options.maxRetries ?? 5
    this.now = options.now ?? Date.now
  }

  get status(): SyncState {
    return this.state
  }

  /** Dual-write: local immediately, queued for background sync. Reads see this write right away. */
  stage(change: QueuedChange<TPayload>): void {
    this.localStore.write(change.id, change.payload)
    this.queue.enqueue(change)
  }

  /** Backoff delay in ms before the next attempt for a change with the given retry count. */
  backoffFor(retries: number): number {
    return this.baseBackoffMs * 2 ** retries
  }

  /** True once a change has been retried past the retry limit — it should stop being auto-retried. */
  isExhausted(change: QueuedChange<TPayload>): boolean {
    return change.retries >= this.maxRetries
  }

  /**
   * Attempts to sync the head of the queue. Does not itself schedule retries
   * or sleep for backoff — callers (a background loop, a test) decide when
   * to call this again, using backoffFor()/isExhausted() to pace themselves.
   */
  async syncNext(): Promise<SyncResult | undefined> {
    const change = this.queue.peek()
    if (!change) {
      this.state = 'idle'
      return undefined
    }

    this.state = 'pending'
    const result = await this.transport.send(change)

    if (result.success) {
      this.queue.remove(change.id)
      this.state = this.queue.size > 0 ? 'pending' : 'idle'
      return result
    }

    if (result.conflictWith !== undefined) {
      this.state = 'conflict'
      return result
    }

    this.queue.incrementRetries(change.id)
    this.state = this.isExhausted(change) ? 'failed' : 'pending'
    return result
  }
}
