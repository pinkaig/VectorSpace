import { describe, expect, it } from 'vitest'
import { InMemoryQueueStorage, SyncQueue, type QueuedChange } from './SyncQueue'

const change = (id: string): QueuedChange => ({
  id,
  op: 'update',
  revision: 1,
  payload: { foo: 'bar' },
  idempotencyKey: `key-${id}`,
  retries: 0,
})

describe('SyncQueue', () => {
  it('enqueues and peeks in FIFO order', () => {
    const queue = new SyncQueue()
    queue.enqueue(change('a'))
    queue.enqueue(change('b'))
    expect(queue.peek()?.id).toBe('a')
    expect(queue.size).toBe(2)
  })

  it('removes an entry by id', () => {
    const queue = new SyncQueue()
    queue.enqueue(change('a'))
    queue.enqueue(change('b'))
    queue.remove('a')
    expect(queue.list().map((c) => c.id)).toEqual(['b'])
  })

  it('increments retries for a specific entry', () => {
    const queue = new SyncQueue()
    queue.enqueue(change('a'))
    queue.incrementRetries('a')
    queue.incrementRetries('a')
    expect(queue.peek()?.retries).toBe(2)
  })

  it('persists across a simulated restart via shared storage', () => {
    const storage = new InMemoryQueueStorage()
    const first = new SyncQueue(storage)
    first.enqueue(change('a'))
    first.enqueue(change('b'))

    const restarted = new SyncQueue(storage)
    expect(restarted.size).toBe(2)
    expect(restarted.list().map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('persisted state reflects removals, not just enqueues', () => {
    const storage = new InMemoryQueueStorage()
    const first = new SyncQueue(storage)
    first.enqueue(change('a'))
    first.enqueue(change('b'))
    first.remove('a')

    const restarted = new SyncQueue(storage)
    expect(restarted.list().map((c) => c.id)).toEqual(['b'])
  })
})
