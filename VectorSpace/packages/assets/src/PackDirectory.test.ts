import { describe, expect, it, vi } from 'vitest'
import { PackDirectory, isPackAssetId, type PackBatchAnswer, type PackDirectoryEntry } from './PackDirectory'

const entry = (id: string): PackDirectoryEntry => ({ id, url: `https://cdn.test/${id}.glb`, contentType: 'model/gltf-binary' })
const instantly = async () => {}
const serveAll = async (ids: string[]): Promise<PackBatchAnswer> => ({ found: ids.map(entry), missing: [] })

describe('PackDirectory', () => {
  it('recognises pack ids', () => {
    expect(isPackAssetId('pack:fossils:abc')).toBe(true)
    expect(isPackAssetId('cube')).toBe(false)
  })

  it('sends ids asked for together as one request, once each', async () => {
    const fetchBatch = vi.fn(serveAll)
    const directory = new PackDirectory({ fetchBatch, sleep: instantly })
    const [a, b] = await Promise.all([directory.need(['pack:x:1', 'pack:x:2']), directory.need(['pack:x:2', 'pack:x:3'])])
    expect(fetchBatch).toHaveBeenCalledTimes(1)
    expect([...fetchBatch.mock.calls[0][0]].sort()).toEqual(['pack:x:1', 'pack:x:2', 'pack:x:3'])
    expect(a.get('pack:x:2')?.status).toBe('found')
    expect(b.get('pack:x:3')?.status).toBe('found')
  })

  it('does not ask again for what it already knows', async () => {
    const fetchBatch = vi.fn(serveAll)
    const directory = new PackDirectory({ fetchBatch, sleep: instantly })
    await directory.need(['pack:x:1'])
    const again = await directory.need(['pack:x:1'])
    expect(fetchBatch).toHaveBeenCalledTimes(1)
    expect(again.get('pack:x:1')).toEqual({ status: 'found', entry: entry('pack:x:1') })
    expect(directory.peek('pack:x:1')?.url).toBe('https://cdn.test/pack:x:1.glb')
  })

  it('treats an id the server did not serve as gone, and remembers it', async () => {
    const fetchBatch = vi.fn(async (): Promise<PackBatchAnswer> => ({ found: [], missing: ['pack:x:9'] }))
    const directory = new PackDirectory({ fetchBatch, sleep: instantly })
    expect((await directory.need(['pack:x:9'])).get('pack:x:9')).toEqual({ status: 'missing' })
    await directory.need(['pack:x:9'])
    expect(fetchBatch).toHaveBeenCalledTimes(1)
    directory.forget('pack:x:9')
    await directory.need(['pack:x:9'])
    expect(fetchBatch).toHaveBeenCalledTimes(2)
  })

  it('retries a failed request with a growing pause, then succeeds', async () => {
    const pauses: number[] = []
    const fetchBatch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ found: [entry('pack:x:1')], missing: [] })
    const directory = new PackDirectory({ fetchBatch, baseDelayMs: 100, sleep: async (ms) => { pauses.push(ms) } })
    expect((await directory.need(['pack:x:1'])).get('pack:x:1')?.status).toBe('found')
    expect(fetchBatch).toHaveBeenCalledTimes(3)
    expect(pauses).toEqual([100, 200])
  })

  it('reports unreachable after the last try, and does not remember it', async () => {
    const fetchBatch = vi.fn(async (): Promise<PackBatchAnswer> => { throw new Error('offline') })
    const directory = new PackDirectory({ fetchBatch, attempts: 2, sleep: instantly })
    expect((await directory.need(['pack:x:1'])).get('pack:x:1')).toEqual({ status: 'unreachable', message: 'offline' })
    expect(fetchBatch).toHaveBeenCalledTimes(2)
    await directory.need(['pack:x:1'])
    expect(fetchBatch).toHaveBeenCalledTimes(4)
  })

  it('stops early on an error retrying cannot fix', async () => {
    const fetchBatch = vi.fn(async (): Promise<PackBatchAnswer> => { throw new Error('forbidden') })
    const directory = new PackDirectory({ fetchBatch, isTransient: () => false, sleep: instantly })
    expect((await directory.need(['pack:x:1'])).get('pack:x:1')?.status).toBe('unreachable')
    expect(fetchBatch).toHaveBeenCalledTimes(1)
  })

  it('splits a long list across requests', async () => {
    const fetchBatch = vi.fn(serveAll)
    const directory = new PackDirectory({ fetchBatch, maxBatch: 2, sleep: instantly })
    await directory.need(['pack:x:1', 'pack:x:2', 'pack:x:3'])
    expect(fetchBatch).toHaveBeenCalledTimes(2)
  })

  it('tells listeners what it learns, and accepts addresses from elsewhere', async () => {
    const fetchBatch = vi.fn(serveAll)
    const directory = new PackDirectory({ fetchBatch, sleep: instantly })
    const learned: string[] = []
    directory.onLearned((e) => learned.push(e.id))
    directory.seed([entry('pack:x:5')])
    await directory.need(['pack:x:5', 'pack:x:6'])
    expect(fetchBatch).toHaveBeenCalledTimes(1)
    expect(fetchBatch.mock.calls[0][0]).toEqual(['pack:x:6'])
    expect(learned).toEqual(['pack:x:6'])
  })
})
