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

  it('sends a held project at once, then only the newest edit once the interval is up', async () => {
    const transport = new ScriptedTransport([syncSuccess(1)])
    const timers: Array<{ callback: () => void; ms: number }> = []
    let clock = 1_000
    const sync = createProjectSync({
      transport,
      storage: new InMemoryQueueStorage(),
      holdMs: 30_000,
      shouldHold: () => true,
      now: () => clock,
      scheduleTimeout: (callback, ms) => timers.push({ callback, ms }),
    })

    sync.stage(project('first'))
    await flush()
    clock += 5_000
    sync.stage(project('second'))
    clock += 5_000
    sync.stage(project('third'))
    await flush()
    // the first went straight away; the next two wait, with one send scheduled for the rest of the 30 s
    expect(transport.sent.map((p) => p.name)).toEqual(['first'])
    expect(sync.status()).toBe('pending')
    expect(timers.map((t) => t.ms)).toEqual([25_000])

    clock += 20_000
    timers[0].callback()
    await flush()
    expect(transport.sent.map((p) => p.name)).toEqual(['first', 'third'])
    expect(sync.status()).toBe('idle')
  })

  it('flush sends a held edit without waiting', async () => {
    const transport = new ScriptedTransport([syncSuccess(1)])
    let clock = 0
    const sync = createProjectSync({
      transport,
      storage: new InMemoryQueueStorage(),
      holdMs: 30_000,
      shouldHold: (p) => p.name !== 'local',
      now: () => clock,
      scheduleTimeout: () => 0,
    })

    sync.stage(project('server-1'))
    clock += 1_000
    sync.stage(project('server-2'))
    sync.stage(project('local')) // not held: goes at once
    await flush()
    expect(transport.sent.map((p) => p.name)).toEqual(['server-1', 'local'])

    sync.flush()
    await flush()
    expect(transport.sent.map((p) => p.name)).toEqual(['server-1', 'local', 'server-2'])
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
