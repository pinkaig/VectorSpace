/**
 * @file        userAudio.ts
 * @brief       Browser-local storage for audio clips imported through the UI.
 *
 * @responsibility
 * Mirrors userAssets.ts's role for GLB/GLTF models, but for audio: persists
 * imported .ogg/.mp3/.wav files in the browser's IndexedDB so they survive
 * reloads, and exposes them as AudioAssetDefinition entries that the rule
 * authoring dropdown (WhenDoRuleSection/RuleRow) can offer and audioResolution
 * can resolve to playable bytes. The bundled half of the catalog lives in
 * audioAssets.ts; this is the user half, the same split userAssets.ts/assets.ts
 * use for models.
 *
 * Storage is local to the current browser and device only, same caveat as
 * userAssets.ts.
 */
import type { ChannelId } from 	'@vectorspace/project'
import { audioAssetCatalog, isDecodableAudioBytes, type AudioAssetDefinition } from './audioAssets'
import { registerAudioAsset, unregisterAudioAsset } from '../content/audioResolution'

const DB_NAME = 'vectorspace-user-audio'
const STORE_NAME = 'clips'
const ASSET_ID_PREFIX = 'user-audio-'
const AUDIO_FILE_PATTERN = /\.(ogg|mp3|wav)$/i

interface StoredUserAudio {
  id: string
  name: string
  fileName: string
  blob: Blob
  contentType: string
  addedAt: number
  // SHA-256 of the file bytes, used to refuse re-importing the same clip under another
  // name — the same check userAssets.ts does for models.
  contentHash: string
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open the local audio database'))
  })

// Fresh object URLs are minted per record per page load, same reasoning as
// userAssets.ts's userModelUrlModifiers — a blob: URL from a previous session is
// dead once the page unloads, so these are rebuilt by loadUserAudio() on every load.
const userAudioUrls: Record<string, string> = {}

const contentTypeFor = (fileName: string): string => {
  if (/\.mp3$/i.test(fileName)) return 'audio/mpeg'
  if (/\.wav$/i.test(fileName)) return 'audio/wav'
  return 'audio/ogg'
}

const registerRecord = (record: StoredUserAudio): AudioAssetDefinition => {
  const assetId = `${ASSET_ID_PREFIX}${record.id}`
  // The editor page loads these on every mount, and it can mount more than once per page
  // load (leave /editor, come back). Hand back the entry already in the catalog rather
  // than mint a second blob URL and a duplicate row.
  const registered = audioAssetCatalog.find((asset) => asset.assetId === assetId)
  if (registered) return registered
  const url = URL.createObjectURL(record.blob)
  userAudioUrls[assetId] = url
  // Uploaded clips default to the 'sfx' channel/cache tier: short, author-picked,
  // frequently replayed clips are exactly the IndexedDB-caching use case described
  // in audioAssets.ts's AudioAssetDefinition.cacheStrategy doc. An author who imports
  // a long music bed can still pick 'bgm' when wiring up the rule; this only sets
  // the suggested default, same as every bundled entry.
  const defaultChannel: ChannelId = 'sfx'
  registerAudioAsset(assetId, { url, contentType: record.contentType, cacheStrategy: 'cached' })
  const asset: AudioAssetDefinition = {
    assetId,
    label: record.name,
    detail: 'Imported audio',
    defaultChannel,
    searchableText: `${record.name} imported audio user`.toLowerCase(),
    url,
    cacheStrategy: 'cached',
  }
  // audioAssetCatalog is read directly (not via props) by WhenDoRuleSection's dropdown
  // and RuleRow's label lookup, same as it's mutated in place by validateAudioCatalog —
  // pushing here is what makes an upload show up in the rule-authoring dropdown at all.
  audioAssetCatalog.push(asset)
  return asset
}

export const isUserAudioAsset = (assetId: string): boolean => assetId.startsWith(ASSET_ID_PREFIX)

export const loadUserAudio = async (): Promise<AudioAssetDefinition[]> => {
  const records = await readAllRecords(await openDb())
  return records.sort((a, b) => a.addedAt - b.addedAt).map(registerRecord)
}

const readAllRecords = async (db: IDBDatabase): Promise<StoredUserAudio[]> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as StoredUserAudio[])
    request.onerror = () => reject(request.error ?? new Error('Failed to read imported audio'))
  })

const putRecord = async (db: IDBDatabase, record: StoredUserAudio): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to save the imported audio'))
  })

const hashBytes = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Bundled audio files never change during a session, so each is fetched and hashed once.
const bundledHashes = new Map<string, Promise<string>>()
const hashBundled = (url: string): Promise<string> => {
  let hash = bundledHashes.get(url)
  if (!hash) {
    hash = fetch(url).then((response) => response.arrayBuffer()).then(hashBytes)
    bundledHashes.set(url, hash)
    hash.catch(() => bundledHashes.delete(url)) // let a failed fetch retry next import
  }
  return hash
}

// Names compare case- and spacing-insensitively, same rule userAssets.ts uses for models.
export const normalizeAudioName = (name: string): string => name.trim().toLowerCase().replace(/[\s_-]+/g, ' ')

export interface SkippedAudioImport {
  fileName: string
  reason: string
}

export interface AudioImportResult {
  added: AudioAssetDefinition[]
  skipped: SkippedAudioImport[]
}

/**
 * Imports every .ogg/.mp3/.wav in `files` (any mix, selected or dropped together).
 * Each file is checked, in order, against three guards before it's stored:
 *   1. name clash — `existingNames` (bundled + already-imported) already has this name
 *   2. duplicate content — its bytes hash the same as a bundled or already-imported clip
 *   3. playability — the bytes must actually decode via the Web Audio API (see
 *      audioAssets.ts's isDecodableAudioBytes); catches a renamed non-audio file, a
 *      half-downloaded clip, or a corrupt export before it ever reaches the project
 *      and silently fails to play later.
 */
export const addUserAudio = async (
  files: File[],
  existingNames: readonly string[],
  bundledAudio: readonly { label: string; url: string }[],
): Promise<AudioImportResult> => {
  const candidates = files.filter((file) => AUDIO_FILE_PATTERN.test(file.name))
  if (candidates.length === 0) throw new Error('Select a .ogg, .mp3, or .wav file')

  const db = await openDb()
  const records = await readAllRecords(db)
  const hashes = new Map<string, string>() // content hash -> library name
  records.forEach((record) => hashes.set(record.contentHash, record.name))
  // Built-ins aren't in the database, so their content is hashed from the bundled file.
  // One that can't be fetched is only protected by the name check.
  for (const asset of bundledAudio) {
    try {
      hashes.set(await hashBundled(asset.url), asset.label)
    } catch {
      // ignore: see above
    }
  }
  const takenNames = new Set(existingNames.map(normalizeAudioName))

  const result: AudioImportResult = { added: [], skipped: [] }
  for (const file of candidates) {
    const name = file.name.replace(AUDIO_FILE_PATTERN, '')
    if (takenNames.has(normalizeAudioName(name))) {
      result.skipped.push({ fileName: file.name, reason: `an audio asset named "${name}" already exists` })
      continue
    }

    const bytes = await file.arrayBuffer()
    const contentHash = await hashBytes(bytes)
    const sameAs = hashes.get(contentHash)
    if (sameAs !== undefined) {
      result.skipped.push({ fileName: file.name, reason: `it is the same audio as "${sameAs}"` })
      continue
    }

    if (!(await isDecodableAudioBytes(bytes))) {
      result.skipped.push({ fileName: file.name, reason: 'it could not be played back — the file may be corrupt or not actually audio' })
      continue
    }

    const record: StoredUserAudio = {
      id: crypto.randomUUID(),
      name,
      fileName: file.name,
      blob: file,
      contentType: contentTypeFor(file.name),
      addedAt: Date.now(),
      contentHash,
    }
    await putRecord(db, record)
    takenNames.add(normalizeAudioName(name))
    hashes.set(contentHash, name)
    result.added.push(registerRecord(record))
  }
  return result
}

export const removeUserAudio = async (assetId: string): Promise<void> => {
  const db = await openDb()
  const id = assetId.slice(ASSET_ID_PREFIX.length)
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to remove the imported audio'))
  })
  const url = userAudioUrls[assetId]
  if (url) URL.revokeObjectURL(url)
  delete userAudioUrls[assetId]
  unregisterAudioAsset(assetId)
  const index = audioAssetCatalog.findIndex((asset) => asset.assetId === assetId)
  if (index !== -1) audioAssetCatalog.splice(index, 1)
}
