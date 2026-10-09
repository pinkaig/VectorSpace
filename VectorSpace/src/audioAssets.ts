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
 *
 * The catalog itself is auto-generated from every audio file under
 * public/audio/ (listed by vite.config.ts's audioManifestPlugin, since
 * public/ is intentionally outside import.meta.glob's reach) — dropping a
 * new .ogg/.mp3/.wav file there and refreshing is enough, no manual entry
 * required. Metadata (label, channel, cache tier) is derived from the
 * filename's `prefix-words.ext` convention; see deriveAssetMeta below.
 * Overrides for specific assetIds can be added to assetMetaOverrides if the
 * derived label/detail isn't good enough.
 *
 * A file matching the naming convention is still just a filename, not proof
 * it is real, decodable audio (a renamed .txt, a half-copied download, a
 * corrupt export). validateAudioCatalog() confirms every entry by actually
 * decoding it with the Web Audio API, and prunes anything that fails so it
 * can never be picked as a rule's sound and fail silently at play time.
 */
import type { ChannelId, ProjectData } from '../packages/project/src/index'
import audioFileNames from 'virtual:audio-files'
import { registerAudioAsset, unregisterAudioAsset } from './viewport/audioResolution'

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

// Manual label/detail overrides keyed by assetId, for files whose derived
// label (from filename words) isn't descriptive enough. Everything else
// (channel, cacheStrategy, searchableText, url) is still derived automatically.
const assetMetaOverrides: Record<string, Partial<Pick<AudioAssetDefinition, 'label' | 'detail'>>> = {
  'main-bgm-crowd-galley': { label: 'Crowd Galley (Main BGM)', detail: 'Main background theme, loops for the whole visit' },
  'sec-bgm-ambience-museum': { label: 'Ambience Museum (Sec BGM)', detail: 'Museum ambience bed for the gallery zone' },
  'sec-bgm-fire-burning': { label: 'Fire Burning (Sec BGM)', detail: 'Fire/campfire ambience bed for the fire zone' },
  'sec-bgm-musical-voice': { label: 'Musical With Voice (Sec BGM)', detail: 'Musical/vocal ambience bed for the musical zone' },
  'sec-bgm-vehicle-sounds': { label: 'Vehicle Sounds (Sec BGM)', detail: 'Vehicle ambience bed for the vehicle zone' },
  'sfx-cartoon-comedy-sad': { detail: 'Comedic sad sting for interactions' },
  'sfx-cartoon-sneaky': { detail: 'Sneaky tip-toe sting for interactions' },
  'sfx-rock-debris': { detail: 'Rock/rubble crash for interactions' },
}

// Sec BGM clips use the custom 'secBgm' channel (not 'bgm', which is exclusive and
// would cut off the main theme) so a zone's secondary bed layers under the main BGM
// instead of replacing it. See src/demoAudioScene.ts for the rules that play these.
const deriveAssetMeta = (assetId: string): Pick<AudioAssetDefinition, 'label' | 'detail' | 'defaultChannel' | 'searchableText' | 'cacheStrategy'> => {
  const words = assetId.split('-')
  const titleCase = words.map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')

  let defaultChannel: ChannelId = 'sfx'
  let cacheStrategy: 'url' | 'cached' = 'cached'
  let tag = 'SFX'
  if (assetId.startsWith('main-bgm')) {
    defaultChannel = 'bgm'
    cacheStrategy = 'url'
    tag = 'Main BGM'
  } else if (assetId.startsWith('sec-bgm')) {
    defaultChannel = 'secBgm'
    cacheStrategy = 'url'
    tag = 'Sec BGM'
  }

  return {
    label: `${titleCase} (${tag})`,
    detail: `${titleCase} (auto-detected from public/audio/)`,
    defaultChannel,
    searchableText: words.join(' ').toLowerCase(),
    cacheStrategy,
  }
}

// Every audio file under public/audio/ is picked up automatically — drop a
// new .ogg/.mp3/.wav there and refresh, no manual catalog entry needed.
export const audioAssetCatalog: AudioAssetDefinition[] = audioFileNames
  .map((filename): AudioAssetDefinition => {
    const assetId = filename.replace(/\.[^./]+$/, '')
    const derived = deriveAssetMeta(assetId)
    const override = assetMetaOverrides[assetId]
    return {
      assetId,
      ...derived,
      ...override,
      url: `/audio/${filename}`,
    }
  })
  .sort((a, b) => a.assetId.localeCompare(b.assetId))

audioAssetCatalog.forEach((asset) => {
  registerAudioAsset(asset.assetId, { url: asset.url, cacheStrategy: asset.cacheStrategy })
})

export const filterAudioAssets = (query: string, catalog: readonly AudioAssetDefinition[] = audioAssetCatalog): AudioAssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}

// How many rule actions (playAudio/stopAudio), across the whole project, reference
// `assetId`. Mirrors assets.ts's countAssetUses for models — an audio asset in use
// can't be removed from the library, or those rules would lose their sound.
export const countAudioAssetUses = (project: ProjectData, assetId: string): number =>
  (project.rules ?? []).reduce(
    (total, rule) => total + rule.actions.filter((action) => action.params?.assetId === assetId).length,
    0,
  )

// A filename matching the naming convention is not proof it is playable audio — it
// could be a renamed .txt, a half-finished download, or a corrupt export. This
// confirms each catalog entry by actually decoding it, and drops anything that
// fails so it can never be picked in a rule and then fail silently at play time.
// Runs once at app startup (see src/main.tsx); not awaited there since the UI
// should render immediately with the unvalidated list and shrink if needed.
export const validateAudioCatalog = async (
  catalog: AudioAssetDefinition[] = audioAssetCatalog,
): Promise<{ removed: AudioAssetDefinition[] }> => {
  const removed: AudioAssetDefinition[] = []
  await Promise.all(
    catalog.map(async (asset) => {
      const ok = await isDecodableAudio(asset.url)
      if (!ok) removed.push(asset)
    }),
  )
  if (removed.length > 0) {
    const removedIds = new Set(removed.map((asset) => asset.assetId))
    const keep = catalog.filter((asset) => !removedIds.has(asset.assetId))
    catalog.splice(0, catalog.length, ...keep)
    removed.forEach((asset) => unregisterAudioAsset(asset.assetId))
    // eslint-disable-next-line no-console
    console.warn(`Audio catalog: skipped ${removed.length} file(s) that could not be decoded as audio:`, removed.map((asset) => asset.url))
  }
  return { removed }
}

const isDecodableAudio = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url)
    if (!response.ok) return false
    const bytes = await response.arrayBuffer()
    return isDecodableAudioBytes(bytes)
  } catch {
    return false
  }
}

// Shared with userAudio.ts, which already has the bytes in hand (from a File/Blob)
// and so skips the fetch this does for a bundled catalog entry's URL.
export const isDecodableAudioBytes = async (bytes: ArrayBuffer): Promise<boolean> => {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return true // no Web Audio API available (e.g. some test environments); don't block on it
  const context = new AudioContextCtor()
  try {
    // decodeAudioData detaches/consumes the buffer it's given, so a copy is passed
    // through — the caller (e.g. a File read as ArrayBuffer) may still need the original.
    await context.decodeAudioData(bytes.slice(0))
    return true
  } catch {
    return false
  } finally {
    void context.close()
  }
}
