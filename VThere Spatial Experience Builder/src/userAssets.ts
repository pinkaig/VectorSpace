/**
 * @file        userAssets.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       Browser-local storage for GLB/GLTF assets imported through the UI.
 *
 *              Persists imported models, including a single .glb or a .gltf together
 *              with its .bin and texture files, in the browser's IndexedDB so they
 *              survive reloads. Exposes them as AssetDefinition entries that the
 *              asset palette can display and Viewport/ReferenceViewport can resolve
 *              to a loadable URL.
 *
 *              Storage is local to the current browser and device only. There is no
 *              server-side or shared storage yet; this acts as the temporary
 *              implementation for the shared-storage contract described in
 *              docs/05-subsystems/UNDATED--CURRENT--asset-library-contract.md.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */

/************************************************************************************/
import type { AssetDefinition } from './assets'
import { registerLocalAsset, resolveLocalAssetUrl, unregisterLocalAsset } from './viewport/assetResolution'

const DB_NAME = 'vthere-user-assets'
const STORE_NAME = 'models'
const ASSET_ID_PREFIX = 'user-model-'
const ENTRY_FILE_PATTERN = /\.(glb|gltf)$/i

interface StoredUserModelFile {
  name: string
  blob: Blob
}

interface StoredUserModel {
  id: string
  name: string
  entryFileName: string
  files: StoredUserModelFile[]
  addedAt: number
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open the local asset database'))
  })

// Fresh object URLs are minted per record per page load (URLs from a previous session are
// dead once the page unloads), so these are rebuilt from scratch by loadUserAssets() on every
// load rather than persisted — assets.ts's resolveModelUrl()/resolveModelUrlModifier() read them live.
const userModelUrlModifiers: Record<string, (url: string) => string> = {}

const registerRecord = (record: StoredUserModel): AssetDefinition => {
  const assetId = `${ASSET_ID_PREFIX}${record.id}`
  const fileMap = new Map<string, string>()
  record.files.forEach((file) => fileMap.set(file.name, URL.createObjectURL(file.blob)))
  const entryUrl = fileMap.get(record.entryFileName)!
  registerLocalAsset(assetId, {
    url: entryUrl,
    contentType: record.entryFileName.toLowerCase().endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary',
  })

  // A .gltf's buffers/textures are referenced by relative filename, resolved against the
  // entry file's own URL — meaningless for a blob: URL, which has no real directory. Rewrite
  // any such request to the matching sibling file's own blob URL instead. Single-file .glb
  // imports need none of this (GLTFLoader never requests anything beyond the file itself).
  if (record.files.length > 1) {
    userModelUrlModifiers[assetId] = (url: string) => {
      const basename = decodeURIComponent(url.split('/').pop() ?? '')
      return fileMap.get(basename) ?? url
    }
  }

  return {
    kind: 'model',
    assetId,
    label: record.name,
    detail: record.entryFileName.toLowerCase().endsWith('.gltf') ? 'Imported glTF' : 'Imported GLB',
    category: 'model',
    searchableText: `${record.name} imported model glb gltf user`.toLowerCase(),
    modelUrl: entryUrl,
  }
}

export const getUserModelUrlModifier = (assetId: string): ((url: string) => string) | undefined =>
  userModelUrlModifiers[assetId]

export const isUserAsset = (assetId: string): boolean => assetId.startsWith(ASSET_ID_PREFIX)

export const loadUserAssets = async (): Promise<AssetDefinition[]> => {
  const db = await openDb()
  const records = await new Promise<StoredUserModel[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as StoredUserModel[])
    request.onerror = () => reject(request.error ?? new Error('Failed to read imported assets'))
  })
  return records.sort((a, b) => a.addedAt - b.addedAt).map(registerRecord)
}

// `files` is everything the user selected/dropped together in one go — for a .glb that's
// just the one file; for a .gltf it's expected to include its .bin and texture files too.
export const addUserAsset = async (files: File[]): Promise<AssetDefinition> => {
  const entries = files.filter((file) => ENTRY_FILE_PATTERN.test(file.name))
  if (entries.length === 0) throw new Error('Select a .glb or .gltf file')
  if (entries.length > 1) throw new Error('Select only one .glb or .gltf file at a time (its .bin/texture files can come along with it)')
  const entry = entries[0]

  const db = await openDb()
  const record: StoredUserModel = {
    id: crypto.randomUUID(),
    name: entry.name.replace(ENTRY_FILE_PATTERN, ''),
    entryFileName: entry.name,
    files: files.map((file) => ({ name: file.name, blob: file })),
    addedAt: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to save the imported asset'))
  })
  return registerRecord(record)
}

export const removeUserAsset = async (assetId: string): Promise<void> => {
  const db = await openDb()
  const id = assetId.slice(ASSET_ID_PREFIX.length)
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to remove the imported asset'))
  })
  const url = resolveLocalAssetUrl(assetId)
  if (url) URL.revokeObjectURL(url)
  unregisterLocalAsset(assetId)
  delete userModelUrlModifiers[assetId]
  // Auxiliary (.bin/texture) blob URLs created in registerRecord's fileMap closure aren't
  // individually revoked here — a bounded, session-local leak of dead URL handles, not of
  // the underlying memory, and acceptable for this local-only prototype feature.
}
