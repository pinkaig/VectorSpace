import { describe, expect, it } from 'vitest'
import { KindRouterResolver } from './KindRouterResolver'
import { readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

const route = (label: string): AssetResolver & { calls: AssetRef[] } => ({
  calls: [],
  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    this.calls.push(ref)
    return readyAssetDescriptor(ref, { contentType: label })
  },
})

describe('KindRouterResolver', () => {
  const build = () => {
    const primitives = route('primitives')
    const inlineText = route('inlineText')
    const catalog = route('catalog')
    return { primitives, inlineText, catalog, router: new KindRouterResolver({ primitives, inlineText, catalog }) }
  }

  it('keeps the primitive-<kind> rule from the FallbackResolver it replaces', async () => {
    const { router, primitives, catalog } = build()
    await router.resolve({ assetId: 'primitive-cube', kind: 'cube' })
    // a broken assetId on a primitive kind must still fail visibly via the catalog
    await router.resolve({ assetId: 'not-a-primitive', kind: 'cube' })

    expect(primitives.calls).toHaveLength(1)
    expect(catalog.calls).toHaveLength(1)
  })

  it('routes inline text to the project-data resolver and media kinds to the catalog', async () => {
    const { router, inlineText, catalog } = build()
    await router.resolve({ assetId: 'text-1', kind: 'text' })
    await router.resolve({ assetId: 'song-1', kind: 'audio' })
    await router.resolve({ assetId: 'lamp-01', kind: 'model' })

    expect(inlineText.calls.map((ref) => ref.assetId)).toEqual(['text-1'])
    expect(catalog.calls.map((ref) => ref.assetId)).toEqual(['song-1', 'lamp-01'])
  })
})
