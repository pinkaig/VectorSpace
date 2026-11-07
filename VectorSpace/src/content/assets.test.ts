import { describe, expect, it } from 'vitest'
import {
  packManifestToCatalog,
  registerPackModels,
  resolveModelUrl,
  type PackManifest,
} from './assets'

describe('cloud asset packs', () => {
  it('maps model manifest entries to stable catalogue ids', () => {
    const manifest: PackManifest = {
      slug: 'fossils',
      title: 'Fossils',
      kind: 'objects',
      assets: [
        { id: 'asset-1', title: 'Triceratops', kind: 'model', url: 'https://cdn.test/triceratops.glb' },
        { id: 'asset-2', title: 'Background', kind: 'image', url: 'https://cdn.test/bg.png' },
      ],
    }

    expect(packManifestToCatalog(manifest)).toEqual([expect.objectContaining({
      assetId: 'pack:fossils:asset-1',
      label: 'Triceratops',
      modelUrl: 'https://cdn.test/triceratops.glb',
      unavailable: false,
    })])
  })

  it('resolves registered pack ids to their cloud URL', () => {
    const [asset] = packManifestToCatalog({
      slug: 'props',
      title: 'Props',
      kind: 'objects',
      assets: [{ id: 'lamp', title: 'Lamp', kind: 'model', url: 'https://cdn.test/lamp.glb' }],
    })
    registerPackModels([asset])
    expect(resolveModelUrl('pack:props:lamp')).toBe('https://cdn.test/lamp.glb')
  })
})
