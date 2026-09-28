/**
 * @file        audioAssets.ts
 * @brief       The bundled audio catalog: assetId -> {label, url under public/audio/}.
 *
 * @responsibility
 * Mirrors assets.ts's role for models. Every entry here ships with the app
 * (a file under `public/audio/`) and registers into audioResolution's local
 * catalog at import time, the same way assets.ts registers built-in models
 * into assetResolution's local catalog. This is the "bundled" half of the
 * loading plan; a later cloud/CDN catalog would populate the same
 * audioResolution map through registerAudioAsset(), not replace this file.
 */
import type { ChannelId } from '../packages/project/src/index'
import { registerAudioAsset } from './viewport/audioResolution'

export interface AudioAssetDefinition {
  assetId: string
  label: string
  detail: string
  // Suggested default; authors can still override per-play or via AudioAssetMeta.
  defaultChannel: ChannelId
  searchableText: string
  url: string
  /**
   * Which loading tier this asset should use (see audio-system.md's "Loading
   * audio into the app"). `'url'` (default): fetched on demand, nothing
   * persisted on the device — for long-form/streaming audio. `'cached'`: the
   * bytes are cached in IndexedDB after first fetch, so replays and reloads
   * skip the network — for small/frequent clips (SFX, chimes) that are cheap
   * to store whole and get replayed constantly.
   */
  cacheStrategy?: 'url' | 'cached'
}

// Bundled demo clips under public/audio/ (source .wav originals in assets/audio/,
// transcoded to .ogg — see docs/code/subsystems/audio-system.md's loading-tier notes).
// Sec BGM clips use the custom 'secBgm' channel (not 'bgm', which is exclusive and
// would cut off the main theme) so a zone's secondary bed layers under the main BGM
// instead of replacing it. See src/demoAudioScene.ts for the rules that play these.
export const audioAssetCatalog: AudioAssetDefinition[] = [
  {
    assetId: 'main-bgm',
    label: 'Crowd Galley (Main BGM)',
    detail: 'Main background theme, loops for the whole visit',
    defaultChannel: 'bgm',
    searchableText: 'main bgm crowd galley theme music background',
    url: '/audio/main-bgm-crowd-galley.ogg',
    cacheStrategy: 'url',
  },
  {
    assetId: 'sec-bgm-museum',
    label: 'Ambience Museum (Sec BGM)',
    detail: 'Museum ambience bed for the gallery zone',
    defaultChannel: 'secBgm',
    searchableText: 'sec bgm ambience museum gallery zone',
    url: '/audio/sec-bgm-ambience-museum.ogg',
    cacheStrategy: 'url',
  },
  {
    assetId: 'sec-bgm-fire',
    label: 'Fire Burning (Sec BGM)',
    detail: 'Fire/campfire ambience bed for the fire zone',
    defaultChannel: 'secBgm',
    searchableText: 'sec bgm fire burning campfire zone',
    url: '/audio/sec-bgm-fire-burning.ogg',
    cacheStrategy: 'url',
  },
  {
    assetId: 'sec-bgm-musical',
    label: 'Musical With Voice (Sec BGM)',
    detail: 'Musical/vocal ambience bed for the musical zone',
    defaultChannel: 'secBgm',
    searchableText: 'sec bgm musical voice zone',
    url: '/audio/sec-bgm-musical-voice.ogg',
    cacheStrategy: 'url',
  },
  {
    assetId: 'sec-bgm-vehicle',
    label: 'Vehicle Sounds (Sec BGM)',
    detail: 'Vehicle ambience bed for the vehicle zone',
    defaultChannel: 'secBgm',
    searchableText: 'sec bgm vehicle sounds zone',
    url: '/audio/sec-bgm-vehicle-sounds.ogg',
    cacheStrategy: 'url',
  },
  {
    assetId: 'sfx-cartoon-comedy-sad',
    label: 'Cartoon Comedy Sad (SFX)',
    detail: 'Comedic sad sting for interactions',
    defaultChannel: 'sfx',
    searchableText: 'sfx cartoon comedy sad sting click',
    url: '/audio/sfx-cartoon-comedy-sad.ogg',
    cacheStrategy: 'cached',
  },
  {
    assetId: 'sfx-cartoon-sneaky',
    label: 'Cartoon Sneaky (SFX)',
    detail: 'Sneaky tip-toe sting for interactions',
    defaultChannel: 'sfx',
    searchableText: 'sfx cartoon sneaky tip toe click',
    url: '/audio/sfx-cartoon-sneaky.ogg',
    cacheStrategy: 'cached',
  },
  {
    assetId: 'sfx-rock-debris',
    label: 'Rock Debris (SFX)',
    detail: 'Rock/rubble crash for interactions',
    defaultChannel: 'sfx',
    searchableText: 'sfx rock debris crash rubble click',
    url: '/audio/sfx-rock-debris.ogg',
    cacheStrategy: 'cached',
  },
]

audioAssetCatalog.forEach((asset) => {
  registerAudioAsset(asset.assetId, { url: asset.url, cacheStrategy: asset.cacheStrategy })
})

export const filterAudioAssets = (query: string, catalog: readonly AudioAssetDefinition[] = audioAssetCatalog): AudioAssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}
