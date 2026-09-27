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

// No clips ship yet — drop a file under `public/audio/` and add its entry here.
// An assetId with no entry simply fails to resolve (AudioSystem surfaces it as
// a voice in 'error'), never a silent blank.
export const audioAssetCatalog: AudioAssetDefinition[] = []

audioAssetCatalog.forEach((asset) => {
  registerAudioAsset(asset.assetId, { url: asset.url, cacheStrategy: asset.cacheStrategy })
})

export const filterAudioAssets = (query: string, catalog: readonly AudioAssetDefinition[] = audioAssetCatalog): AudioAssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}
