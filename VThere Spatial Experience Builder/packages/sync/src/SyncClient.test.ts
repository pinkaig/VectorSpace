import { describe, expect, it } from 'vitest'
import { InMemoryQueueStorage, SyncQueue, type QueuedChange } from './SyncQueue'
import { SyncClient, type SyncTransport } from './SyncClient'
import { syncConflict, syncRetryableFailure, syncSuccess, type SyncResult } from './SyncResult'

const change = (id: string, revision = 1): QueuedChange => ({
  id,
  op: 'update',
  revision,
  payload: { value: id },
  idempotencyKey: `key-${id}`,
  retries: 0,
})

class ScriptedTransport implements SyncTransport {
  private index = 0
  constructor(private readonly results: SyncResult[]) {}
  async send(): Promise<SyncResult> {
    const result = this.results[this.index] ?? this.results[this.results.length - 1]
    this.index += 1
    return result
  }
}

describe('SyncClient', () => {
  it('stage() dual-writes: local read succeeds immediately, and the change is queued', () => {
    const client = new SyncClient(new ScriptedTransport([syncSuccess(2)]))
    client.stage(change('a'))
    expect(client.localStore.read('a')).toEqual({ value: 'a' })
    expect(client.queue.size).toBe(1)
  })

  it('syncNext() removes the change from the queue on success and reports idle', async () => {
    const client = new SyncClient(new ScriptedTransport([syncSuccess(2)]))
    client.stage(change('a'))
    const result = await client.syncNext()
    expect(result?.success).toBe(true)
    expect(client.queue.size).toBe(0)
    expect(client.status).toBe('idle')
  })

  it('detects conflict via revision mismatch and stops draining without dropping the change', async () => {
    const client = new SyncClient(new ScriptedTransport([syncConflict(5)]))
    client.stage(change('a', 1))
    const result = await client.syncNext()
    expect(result?.conflictWith).toBe(5)
    expect(client.status).toBe('conflict')
    expect(client.queue.size).toBe(1)
  })

  it('retries a failed change and marks it failed once retries are exhausted', async () => {
    const client = new SyncClient(new ScriptedTransport([syncRetryableFailure()]), { maxRetries: 2 })
    client.stage(change('a'))

    await client.syncNext()
    expect(client.status).toBe('pending')
    expect(client.queue.peek()?.retries).toBe(1)

    await client.syncNext()
    expect(client.status).toBe('failed')
    expect(client.queue.peek()?.retries).toBe(2)
  })

  it('backoffFor() doubles per retry from the configured base', () => {
    const client = new SyncClient(new ScriptedTransport([syncSuccess(1)]), { baseBackoffMs: 100 })
    expect(client.backoffFor(0)).toBe(100)
    expect(client.backoffFor(1)).toBe(200)
    expect(client.backoffFor(3)).toBe(800)
  })

  it('isExhausted() reflects the configured retry limit', () => {
    const client = new SyncClient(new ScriptedTransport([syncSuccess(1)]), { maxRetries: 3 })
    expect(client.isExhausted(change('a'))).toBe(false)
    expect(client.isExhausted({ ...change('a'), retries: 3 })).toBe(true)
  })

  it('queue persists across a simulated client restart', async () => {
    const storage = new InMemoryQueueStorage()
    const first = new SyncClient(new ScriptedTransport([syncRetryableFailure()]), { storage })
    first.stage(change('a'))
    await first.syncNext()
    expect(first.queue.peek()?.retries).toBe(1)

    const restartedQueue = new SyncQueue(storage)
    expect(restartedQueue.size).toBe(1)
    expect(restartedQueue.peek()?.retries).toBe(1)
  })
})
