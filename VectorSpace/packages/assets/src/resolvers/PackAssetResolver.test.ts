import { describe, expect, it, vi } from 'vitest'
import { PackDirectory, type PackBatchAnswer } from '../PackDirectory'
import { LocalCatalogResolver } from './LocalCatalogResolver'
import { PACK_ASSET_REMOVED, PackAssetResolver } from './PackAssetResolver'

const ref = (assetId: string) => ({ assetId, kind: 'model' as const })
const entry = (id: string) => ({ id, url: `https://cdn.test/${id}.glb`, contentType: 'model/gltf-binary', sizeBytes: 12 })

const build = (fetchBatch: (ids: string[]) => Promise<PackBatchAnswer>, catalog = new Map<string, { url: string }>()) => {
  const directory = new PackDirectory({ fetchBatch, sleep: async () => {}, attempts: 1 })
  const onFound = vi.fn()
  return { resolver: new PackAssetResolver(new LocalCatalogResolver(catalog), directory, onFound), onFound, directory }
}

describe('PackAssetResolver', () => {
  it('leaves non-pack ids to the local catalogue without asking the server', async () => {
    const fetchBatch = vi.fn()
    const { resolver } = build(fetchBatch, new Map([['bundled', { url: '/a.glb' }]]))
    expect((await resolver.resolve(ref('bundled'))).status).toBe('ready')
    expect((await resolver.resolve(ref('unknown'))).status).toBe('error')
    expect(fetchBatch).not.toHaveBeenCalled()
  })

  it('uses a pack address the catalogue already holds', async () => {
    const fetchBatch = vi.fn()
    const { resolver } = build(fetchBatch, new Map([['pack:x:1', { url: 'https://cdn.test/1.glb' }]]))
    expect((await resolver.resolve(ref('pack:x:1'))).url).toBe('https://cdn.test/1.glb')
    expect(fetchBatch).not.toHaveBeenCalled()
  })

  it('asks the server for an unknown pack id and reports what it learned', async () => {
    const { resolver, onFound } = build(async (ids) => ({ found: ids.map(entry), missing: [] }))
    const descriptor = await resolver.resolve(ref('pack:x:1'))
    expect(descriptor).toMatchObject({ status: 'ready', url: 'https://cdn.test/pack:x:1.glb', contentType: 'model/gltf-binary', sizeBytes: 12 })
    expect(onFound).toHaveBeenCalledWith(expect.objectContaining({ id: 'pack:x:1' }))
  })

  it('says removed when the server does not serve it', async () => {
    const { resolver } = build(async () => ({ found: [], missing: ['pack:x:1'] }))
    expect(await resolver.resolve(ref('pack:x:1'))).toMatchObject({ status: 'error', errorMessage: PACK_ASSET_REMOVED })
  })

  it('says it could not reach the server, which is a different message', async () => {
    const { resolver } = build(async () => { throw new Error('offline') })
    const descriptor = await resolver.resolve(ref('pack:x:1'))
    expect(descriptor.status).toBe('error')
    expect(descriptor.errorMessage).toContain('Could not reach the server')
    expect(descriptor.errorMessage).not.toBe(PACK_ASSET_REMOVED)
  })
})
