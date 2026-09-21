/**
 * Verifies the core Asset Manager acceptance criterion: one resolver
 * interface serves all three sources, and swapping the origin behind an
 * AssetRef requires no change to calling code — only the resolver instance
 * handed to it changes.
 */
import { describe, expect, it } from 'vitest'
import { LocalCatalogResolver } from './resolvers/LocalCatalogResolver'
import { PrimitiveResolver } from './resolvers/PrimitiveResolver'
import { RemoteMediaResolver } from './resolvers/RemoteMediaResolver'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

// The one piece of "calling code" under test — identical for every resolver.
const loadAsset = async (resolver: AssetResolver, ref: AssetRef) => resolver.resolve(ref)

describe('AssetResolver contract', () => {
  const resolvers: Array<{ name: string; resolver: AssetResolver; ref: AssetRef; expectStatus: 'ready' | 'error' }> = [
    { name: 'PrimitiveResolver', resolver: new PrimitiveResolver(), ref: { assetId: 'primitive-cube', kind: 'cube' }, expectStatus: 'ready' },
    {
      name: 'LocalCatalogResolver',
      resolver: new LocalCatalogResolver(new Map([['lamp-01', { url: '/lamp-01.glb' }]])),
      ref: { assetId: 'lamp-01', kind: 'cube' },
      expectStatus: 'ready',
    },
    {
      name: 'RemoteMediaResolver',
      resolver: new RemoteMediaResolver({ projectId: 'proj-1' }),
      ref: { assetId: 'media-1', kind: 'cube' },
      expectStatus: 'error',
    },
  ]

  it.each(resolvers)('$name satisfies the resolve(ref) -> AssetDescriptor contract', async ({ resolver, ref, expectStatus }) => {
    const descriptor = await loadAsset(resolver, ref)
    expect(descriptor.ref).toEqual(ref)
    expect(descriptor.status).toBe(expectStatus)
  })

  it('swaps origin (local catalog -> primitive) through the same calling code with no branching on resolver type', async () => {
    const catalogResolver = new LocalCatalogResolver(new Map([['cube', { url: '/cube.glb' }]]))
    const primitiveResolver = new PrimitiveResolver()

    const viaCatalog = await loadAsset(catalogResolver, { assetId: 'cube', kind: 'cube' })
    const viaPrimitive = await loadAsset(primitiveResolver, { assetId: 'primitive-cube', kind: 'cube' })

    expect(viaCatalog.status).toBe('ready')
    expect(viaPrimitive.status).toBe('ready')
  })
})
