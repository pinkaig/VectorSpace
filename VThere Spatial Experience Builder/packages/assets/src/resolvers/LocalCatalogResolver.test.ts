import { describe, expect, it } from 'vitest'
import { LocalCatalogResolver } from './LocalCatalogResolver'

describe('LocalCatalogResolver', () => {
  it('resolves a cataloged asset to a ready descriptor with its URL', async () => {
    const resolver = new LocalCatalogResolver(
      new Map([['lamp-01', { url: '/dev-assets/lamp-01.glb', contentType: 'model/gltf-binary' }]]),
    )
    const descriptor = await resolver.resolve({ assetId: 'lamp-01', kind: 'cube' })
    expect(descriptor.status).toBe('ready')
    expect(descriptor.url).toBe('/dev-assets/lamp-01.glb')
    expect(descriptor.contentType).toBe('model/gltf-binary')
  })

  it('returns an error descriptor for an asset missing from the catalog', async () => {
    const resolver = new LocalCatalogResolver(new Map())
    const descriptor = await resolver.resolve({ assetId: 'missing', kind: 'cube' })
    expect(descriptor.status).toBe('error')
    expect(descriptor.errorMessage).toContain('missing')
  })

  it('defaults content type when the catalog entry omits it', async () => {
    const resolver = new LocalCatalogResolver(new Map([['lamp-01', { url: '/x.glb' }]]))
    const descriptor = await resolver.resolve({ assetId: 'lamp-01', kind: 'cube' })
    expect(descriptor.contentType).toBe('model/gltf-binary')
  })
})
