/**
 * Verifies the Stage 8 observable contract: staging a project queues it for
 * background sync without touching Tier 1, a forced failure retries via
 * backoff without dropping the change, and offline edits queued locally are
 * delivered in order once the transport starts succeeding again.
 */
import { describe, expect, it } from 'vitest'
import { InMemoryQueueStorage, type QueuedChange, type SyncResult, syncRetryableFailure, syncSuccess } from '../../packages/sync/src/index'
import { createProjectSync } from './projectSync'
import { defaultProject } from './model'
import type { ProjectData } from './model'

class ScriptedTransport {
  private index = 0
  readonly sent: ProjectData[] = []
  constructor(private readonly results: SyncResult[]) {}
  async send(change: QueuedChange<ProjectData>): Promise<SyncResult> {
    this.sent.push(change.payload)
    const result = this.results[this.index] ?? this.results[this.results.length - 1]
    this.index += 1
    return result
  }
}

const project = (name: string): ProjectData => ({ ...defaultProject(), name })

/** Flushes pending microtasks (async transport resolutions, chained drains) between assertions. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('projectSync', () => {
  it('stages a project without throwing and reaches idle on a successful transport', async () => {
    const transport = new ScriptedTransport([syncSuccess(1)])
    const sync = createProjectSync({ transport, storage: new InMemoryQueueStorage() })

    sync.stage(project('a'))
    await flush()

    expect(sync.status()).toBe('idle')
    expect(transport.sent).toHaveLength(1)
  })

  it('notifies subscribers as status moves from pending to idle', async () => {
    const transport = new ScriptedTransport([syncSuccess(1)])
    const sync = createProjectSync({ transport, storage: new InMemoryQueueStorage() })
    const seen: string[] = []
    const unsubscribe = sync.subscribe((status) => seen.push(status))

    sync.stage(project('a'))
    await flush()

    expect(seen).toContain('pending')
    expect(seen[seen.length - 1]).toBe('idle')
    unsubscribe()
  })

  it('schedules a retry on transient failure instead of dropping the change', async () => {
    const transport = new ScriptedTransport([syncRetryableFailure(), syncSuccess(1)])
    const scheduled: Array<() => void> = []
    const sync = createProjectSync({
      transport,
      storage: new InMemoryQueueStorage(),
      scheduleTimeout: (callback) => {
        scheduled.push(callback)
        return 0
      },
    })

    sync.stage(project('a'))
    await flush()
    expect(sync.status()).toBe('pending')
    expect(scheduled).toHaveLength(1)

    scheduled[0]()
    await flush()

    expect(sync.status()).toBe('idle')
    expect(transport.sent).toHaveLength(2)
  })

  it('persists queued changes across a simulated reload (same storage instance)', async () => {
    const storage = new InMemoryQueueStorage()
    const failingTransport = new ScriptedTransport([syncRetryableFailure()])
    const first = createProjectSync({
      transport: failingTransport,
      storage,
      scheduleTimeout: () => 0,
    })
    first.stage(project('offline-edit'))
    await flush()

    const successTransport = new ScriptedTransport([syncSuccess(1)])
    const second = createProjectSync({ transport: successTransport, storage })
    second.retry()
    await flush()

    expect(second.status()).toBe('idle')
    expect(successTransport.sent).toHaveLength(1)
    expect(successTransport.sent[0].name).toBe('offline-edit')
  })

  it('delivers multiple queued offline edits to the transport in order', async () => {
    const transport = new ScriptedTransport([syncSuccess(1), syncSuccess(2)])
    const sync = createProjectSync({ transport, storage: new InMemoryQueueStorage() })

    sync.stage(project('first'))
    sync.stage(project('second'))
    await flush()

    expect(transport.sent.map((p) => p.name)).toEqual(['first', 'second'])
  })
})
