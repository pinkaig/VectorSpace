import { describe, expect, it } from 'vitest'
import { SyncClient, type SyncTransport } from './SyncClient'
import { SyncService } from './SyncService'
import { syncConflict, syncSuccess, type SyncResult } from './SyncResult'
import type { QueuedChange } from './SyncQueue'

const change = (id: string): QueuedChange => ({
  id,
  op: 'update',
  revision: 1,
  payload: { value: id },
  idempotencyKey: `key-${id}`,
  retries: 0,
})

class QueueTransport implements SyncTransport {
  private index = 0
  constructor(private readonly results: SyncResult[]) {}
  async send(): Promise<SyncResult> {
    const result = this.results[this.index]
    this.index += 1
    return result
  }
}

describe('SyncService', () => {
  it('drains multiple queued changes to idle', async () => {
    const client = new SyncClient(new QueueTransport([syncSuccess(2), syncSuccess(3)]))
    client.stage(change('a'))
    client.stage(change('b'))
    const service = new SyncService('project', client)

    const results = await service.drain()

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.success)).toBe(true)
    expect(client.status).toBe('idle')
    expect(client.queue.size).toBe(0)
  })

  it('stops draining on conflict, leaving the conflicting change queued', async () => {
    const client = new SyncClient(new QueueTransport([syncConflict(9)]))
    client.stage(change('a'))
    const service = new SyncService('project', client)

    const results = await service.drain()

    expect(results).toHaveLength(1)
    expect(client.status).toBe('conflict')
    expect(client.queue.size).toBe(1)
  })

  it('resolveConflict() is not implemented — conflict-resolution policy is a separate decision', () => {
    const client = new SyncClient(new QueueTransport([syncSuccess(1)]))
    const service = new SyncService('asset', client)
    expect(() => service.resolveConflict()).toThrow(/not implemented/i)
  })
})
