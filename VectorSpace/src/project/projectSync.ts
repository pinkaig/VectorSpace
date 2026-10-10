/**
 * @file        projectSync.ts
 * @brief       App-level Sync Engine wiring: Tier 2 background sync for project saves.
 *
 * @responsibility
 * Adapts @vectorspace/sync's SyncClient/SyncQueue to the editor: a
 * localStorage-backed QueueStorage so the queue survives a reload, a stub
 * SyncTransport (no real backend endpoint exists yet — see Stage 3), and a
 * small status store the UI can subscribe to. Tier 1 (serializer.ts's
 * localStorage autosave) stays synchronous and authoritative for reads; this
 * module is purely the background Tier 2 path layered on top.
 *
 * @ownership
 * Owns the SyncClient instance, its storage adapters, the retry-on-reconnect
 * loop, and the sync-status-by-listener store. Does not own ProjectData
 * persistence itself — serializer.ts's saveProject remains the source of
 * truth for what's on disk.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Sync-Engine
 */
import {
  InMemoryLocalStore,
  SyncClient,
  syncSuccess,
  type QueuedChange,
  type QueueStorage,
  type SyncResult,
  type SyncTransport,
} from '../../packages/sync/src/index'
import type { ProjectData } from './model'
import { createLogger } from '../../packages/debugging/src/index'

const QUEUE_STORAGE_KEY = 'vectorspace-sync-queue-v1'

const logger = createLogger('editor.sync')

/** Persists the queue to localStorage so it survives a reload; falls back to in-memory if storage is unavailable. */
class LocalStorageQueueStorage implements QueueStorage {
  load(): string | null {
    try {
      return localStorage.getItem(QUEUE_STORAGE_KEY)
    } catch {
      return null
    }
  }

  save(serialized: string): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, serialized)
    } catch (error) {
      logger.warn('Could not persist sync queue to localStorage', { error })
    }
  }
}

/**
 * No backend write endpoint exists yet (Stage 3's routes are still 501 —
 * see https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Sync-Engine). This stub always succeeds so the
 * Links point at the project wiki; migration is still in progress.
 * client-side queue/dual-write/retry machinery can be exercised end-to-end;
 * swapping in a real HTTP transport requires no change to ProjectSync below.
 */
class StubSyncTransport implements SyncTransport<ProjectData> {
  async send(change: QueuedChange<ProjectData>): Promise<SyncResult> {
    return syncSuccess(change.revision + 1)
  }
}

export type ProjectSyncStatus = 'idle' | 'pending' | 'conflict' | 'failed'
export type ProjectSyncListener = (status: ProjectSyncStatus) => void

export interface ProjectSync {
  /** Tier 2: enqueue the project for background sync. Tier 1 (serializer.ts's localStorage write) must happen separately and first. */
  stage(project: ProjectData): void
  /** Re-drives the queue — call on network reconnect or a manual "retry now". A no-op if nothing is queued. */
  retry(): void
  status(): ProjectSyncStatus
  subscribe(listener: ProjectSyncListener): () => void
}

export interface ProjectSyncOptions {
  transport?: SyncTransport<ProjectData>
  storage?: QueueStorage
  /** setTimeout-compatible scheduler, for tests to control retry timing. Default globalThis.setTimeout. */
  scheduleTimeout?: (callback: () => void, ms: number) => unknown
}

export const createProjectSync = (options: ProjectSyncOptions = {}): ProjectSync => {
  const client = new SyncClient<ProjectData>(options.transport ?? new StubSyncTransport(), {
    storage: options.storage ?? new LocalStorageQueueStorage(),
    localStore: new InMemoryLocalStore<ProjectData>(),
  })
  const scheduleTimeout = options.scheduleTimeout ?? ((callback: () => void, ms: number) => setTimeout(callback, ms))

  const listeners = new Set<ProjectSyncListener>()
  let currentStatus: ProjectSyncStatus = 'idle'
  let revision = 0
  let retryScheduled = false

  const setStatus = (next: ProjectSyncStatus) => {
    if (next === currentStatus) return
    currentStatus = next
    listeners.forEach((listener) => listener(currentStatus))
  }

  const scheduleRetry = (retries: number) => {
    if (retryScheduled) return
    retryScheduled = true
    scheduleTimeout(() => {
      retryScheduled = false
      void drain()
    }, client.backoffFor(retries))
  }

  // Drives syncNext() directly (rather than SyncService.drain()'s black-box
  // loop) so the 'pending' state is observable between each queued change,
  // matching the doc's guidance that a real caller should step syncNext()
  // itself rather than use drain() as-is. Chained onto the previous drain's
  // promise so two overlapping calls (e.g. two stage()s back to back) can't
  // both race the same queue head.
  let drainChain: Promise<void> = Promise.resolve()
  const drain = (): Promise<void> => {
    drainChain = drainChain.then(async () => {
      let result: SyncResult | undefined
      do {
        // syncNext() sets state to 'pending' synchronously before awaiting the
        // transport, then overwrites it with the final state once the transport
        // resolves — so the intermediate 'pending' must be read from the call
        // itself (before awaiting it), not from client.status afterward.
        const attempt = client.syncNext()
        setStatus(client.status)
        result = await attempt
        setStatus(client.status)
      } while (result?.success && client.queue.size > 0)
      if (client.status === 'pending' && result && !result.success) {
        const head = client.queue.peek()
        if (head) scheduleRetry(head.retries)
      }
    })
    return drainChain
  }

  return {
    stage(project) {
      revision += 1
      // QueuedChange.id identifies this queue entry, not the project resource —
      // reusing project.id across edits made every change to the same project
      // collide in SyncQueue (remove()/incrementRetries() key off it), so a
      // second staged edit would vanish instead of queuing behind the first.
      client.stage({
        id: `${project.id}-${revision}`,
        op: 'update',
        revision,
        payload: project,
        idempotencyKey: `${project.id}-${revision}-${Date.now()}`,
        retries: 0,
      })
      setStatus(client.status)
      void drain()
    },
    retry() {
      void drain()
    },
    status: () => currentStatus,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const defaultProjectSync = typeof window !== 'undefined' ? createProjectSync() : undefined

if (typeof window !== 'undefined' && defaultProjectSync) {
  window.addEventListener('online', () => defaultProjectSync.retry())
}

export const stageProjectSync = (project: ProjectData): void => defaultProjectSync?.stage(project)
export const retryProjectSync = (): void => defaultProjectSync?.retry()
export const getProjectSyncStatus = (): ProjectSyncStatus => defaultProjectSync?.status() ?? 'idle'
export const subscribeProjectSync = (listener: ProjectSyncListener): (() => void) => defaultProjectSync?.subscribe(listener) ?? (() => {})
