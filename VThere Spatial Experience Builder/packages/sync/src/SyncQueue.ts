/**
 * @file        SyncQueue.ts
 * @brief       An ordered, persistable queue of local writes waiting to sync.
 *
 * @responsibility
 * Holds `QueuedChange` entries in insertion order and exposes the operations
 * a `SyncClient` needs: enqueue, peek the head, remove a completed entry,
 * bump retry count, and serialize/restore so the queue survives a reload via
 * an injected storage adapter (localStorage/IndexedDB in real use, an
 * in-memory stub in tests).
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

export type SyncOp = 'create' | 'update' | 'delete'

export interface QueuedChange<TPayload = unknown> {
  id: string
  op: SyncOp
  /** The revision this change was built on top of, for conflict detection. */
  revision: number
  payload: TPayload
  /** Client-generated, stable across retries — lets the server deduplicate. */
  idempotencyKey: string
  retries: number
}

/** Minimal persistence contract SyncQueue reads/writes through — swap for localStorage, IndexedDB, or a test double. */
export interface QueueStorage {
  load(): string | null
  save(serialized: string): void
}

export class InMemoryQueueStorage implements QueueStorage {
  private serialized: string | null = null

  load(): string | null {
    return this.serialized
  }

  save(serialized: string): void {
    this.serialized = serialized
  }
}

export class SyncQueue<TPayload = unknown> {
  private entries: Array<QueuedChange<TPayload>> = []

  constructor(private readonly storage: QueueStorage = new InMemoryQueueStorage()) {
    this.restore()
  }

  enqueue(change: QueuedChange<TPayload>): void {
    this.entries.push(change)
    this.persist()
  }

  peek(): QueuedChange<TPayload> | undefined {
    return this.entries[0]
  }

  list(): ReadonlyArray<QueuedChange<TPayload>> {
    return this.entries
  }

  /** Removes a completed (or abandoned) entry by id. */
  remove(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id)
    this.persist()
  }

  incrementRetries(id: string): void {
    const entry = this.entries.find((e) => e.id === id)
    if (!entry) return
    entry.retries += 1
    this.persist()
  }

  get size(): number {
    return this.entries.length
  }

  private persist(): void {
    this.storage.save(JSON.stringify(this.entries))
  }

  private restore(): void {
    const raw = this.storage.load()
    if (!raw) return
    this.entries = JSON.parse(raw) as Array<QueuedChange<TPayload>>
  }
}
