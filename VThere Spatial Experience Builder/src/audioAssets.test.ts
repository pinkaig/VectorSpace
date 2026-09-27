import { describe, expect, it } from 'vitest'
import { audioAssetCatalog, filterAudioAssets, type AudioAssetDefinition } from './audioAssets'
import { audioResolver } from './viewport/audioResolution'

const fixture: AudioAssetDefinition[] = [
  { assetId: 'chime', label: 'Chime', detail: 'A soft chime', defaultChannel: 'sfx', searchableText: 'chime soft bell sfx', url: '/audio/chime.mp3' },
  { assetId: 'theme', label: 'Theme', detail: 'Background theme', defaultChannel: 'bgm', searchableText: 'theme background music bgm', url: '/audio/theme.mp3' },
]

describe('audioAssetCatalog', () => {
  it('is empty until real clips are added, and never throws for an unresolved assetId', async () => {
    expect(audioAssetCatalog).toEqual([])
    await expect(audioResolver.resolve('does-not-exist')).resolves.toBeNull()
  })
})

describe('filterAudioAssets', () => {
  it('returns every entry for an empty query', () => {
    expect(filterAudioAssets('', fixture)).toEqual(fixture)
  })

  it('filters case-insensitively against searchableText', () => {
    expect(filterAudioAssets('BELL', fixture)).toEqual([fixture[0]])
    expect(filterAudioAssets('bgm', fixture)).toEqual([fixture[1]])
  })

  it('returns nothing for a query that matches no entry', () => {
    expect(filterAudioAssets('nonexistent', fixture)).toEqual([])
  })
})
