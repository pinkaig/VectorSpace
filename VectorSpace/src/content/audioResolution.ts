/**
 * @file        audioResolution.ts
 * @brief       App-level audio asset lookup: assetId -> URL or cached bytes, from a local catalog.
 *
 * @responsibility
 * The seam AudioSystem's AudioResolver interface expects. Audio does not go
 * through the full Asset Manager resolver chain used for GLB assets in
 * assetResolution.ts (see AudioResolver.ts's header for why); instead this
 * keeps one flat assetId -> {url, cacheStrategy} catalog, filled from two
 * sources:
 *   - the bundled catalog (audioAssets.ts), for clips shipped under `public/audio/`
 *   - registerAudioAsset(), for assetIds resolved elsewhere (e.g. a future
 *     cloud/CDN manifest)
 *
 * Every entry is still cloud/bundle-sourced by URL; `cacheStrategy` only
 * decides what happens after the first fetch:
 *   - 'url' (default): resolve() always hands back the URL. Nothing is
 *     persisted on the device — for long-form/streaming audio where a
 *     re-fetch is cheap relative to the file size.
 *   - 'cached': resolve() checks audioByteCache (IndexedDB) first. On a hit
 *     it returns the cached bytes with no network request; on a miss it
 *     fetches the URL itself, writes the bytes to the cache, and returns
 *     those same bytes so the first play doesn't pay for a second round-trip
 *     through AudioBackend.decode. For small/frequent clips (SFX, chimes).
 *
 * See https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System's "Loading audio into the app"
 * for the full two-tier design.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type { AudioResolver, ResolvedAudio } from '../../packages/audio/src/index'
import { readCachedClip, writeCachedClip } from './audioByteCache'

interface AudioCatalogEntry {
  url: string
  contentType?: string
  cacheStrategy: 'url' | 'cached'
}

// An authored assetId that resolves to nothing simply fails, which AudioSystem
// surfaces as a voice in 'error' — never a silent blank, per the design doc's
// error policy.
const localAudioCatalog = new Map<string, AudioCatalogEntry>()

const fetchAndCache = async (assetId: string, entry: AudioCatalogEntry): Promise<ResolvedAudio> => {
  const response = await fetch(entry.url)
  if (!response.ok) throw new Error(`Failed to fetch audio "${entry.url}": ${response.status}`)
  const data = await response.arrayBuffer()
  void writeCachedClip(assetId, data, entry.contentType).catch(() => {
    // Cache write failures (quota, disabled storage) just mean the next play re-fetches; not fatal.
  })
  return { kind: 'buffer', data, contentType: entry.contentType }
}

export const audioResolver: AudioResolver = {
  async resolve(assetId: string): Promise<ResolvedAudio | null> {
    const entry = localAudioCatalog.get(assetId)
    if (!entry) return null
    if (entry.cacheStrategy === 'url') return { kind: 'url', url: entry.url, contentType: entry.contentType }

    const cached = await readCachedClip(assetId).catch(() => undefined)
    if (cached) return { kind: 'buffer', data: cached.data, contentType: cached.contentType ?? entry.contentType }
    return fetchAndCache(assetId, entry)
  },
}

/**
 * Adds (or replaces) a catalog entry. `entry.url` is always the fetch source —
 * whether it points at a bundled `public/audio/` file today or a cloud/CDN URL
 * later. `cacheStrategy` (default `'url'`) decides whether the fetched bytes
 * are also cached in IndexedDB for future resolves; see this file's header.
 */
export const registerAudioAsset = (
  assetId: string,
  entry: { url: string; contentType?: string; cacheStrategy?: 'url' | 'cached' },
): void => {
  localAudioCatalog.set(assetId, { url: entry.url, contentType: entry.contentType, cacheStrategy: entry.cacheStrategy ?? 'url' })
}

export const unregisterAudioAsset = (assetId: string): void => {
  localAudioCatalog.delete(assetId)
}

export const resolveLocalAudioUrl = (assetId: string): string | undefined => localAudioCatalog.get(assetId)?.url
