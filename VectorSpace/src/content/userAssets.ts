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
 *              https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Library-Contract.
 * Links point at the project wiki; migration is still in progress.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */

/************************************************************************************/
import type { AssetDefinition } from './assets'
import { describeOptimisation, type ModelStats } from './assetPipeline/modelBudget'
import { optimiseInWorker } from './assetPipeline/optimiseInWorker'
import { registerLocalAsset, resolveLocalAssetUrl, unregisterLocalAsset } from '../content/assetResolution'

const DB_NAME = 'vectorspace-user-assets'
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
  // SHA-256 of the entry file, used to refuse re-importing the same model under another
  // name. Missing on records saved before duplicate checking; filled in on first import.
  contentHash?: string
  // Set when the stored files are the budget-optimised version of the import rather
  // than the files as given (see assetPipeline/). Absent for untouched imports.
  optimisation?: { before: ModelStats; after: ModelStats }
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
    detail: `${record.entryFileName.toLowerCase().endsWith('.gltf') ? 'Imported glTF' : 'Imported GLB'}${record.optimisation ? ' · optimised' : ''}`,
    category: 'model',
    searchableText: `${record.name} imported model glb gltf user`.toLowerCase(),
    modelUrl: entryUrl,
  }
}

export const getUserModelUrlModifier = (assetId: string): ((url: string) => string) | undefined =>
  userModelUrlModifiers[assetId]

export const isUserAsset = (assetId: string): boolean => assetId.startsWith(ASSET_ID_PREFIX)

export const loadUserAssets = async (): Promise<AssetDefinition[]> => {
  const records = await readAllRecords(await openDb())
  return records.sort((a, b) => a.addedAt - b.addedAt).map(registerRecord)
}

const readAllRecords = async (db: IDBDatabase): Promise<StoredUserModel[]> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as StoredUserModel[])
    request.onerror = () => reject(request.error ?? new Error('Failed to read imported assets'))
  })

const putRecord = async (db: IDBDatabase, record: StoredUserModel): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to save the imported asset'))
  })

const hashBlob = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Built-in model files never change during a session, so each is fetched and hashed once.
const builtInHashes = new Map<string, Promise<string>>()
const hashBuiltIn = (url: string): Promise<string> => {
  let hash = builtInHashes.get(url)
  if (!hash) {
    hash = fetch(url).then((response) => response.blob()).then(hashBlob)
    builtInHashes.set(url, hash)
    hash.catch(() => builtInHashes.delete(url)) // let a failed fetch retry next import
  }
  return hash
}

// Names compare case- and spacing-insensitively, Pedestal clashes 
// with pedestal, and underscores/dashes are treated as spaces.
export const normalizeAssetName = (name: string): string => name.trim().toLowerCase().replace(/[\s_-]+/g, ' ')

// The external files (.bin buffers, textures) a .gltf references by relative URI.
// Embedded data: URIs need no companion file and are skipped.
export const referencedFileNames = (gltfJson: string): string[] => {
  const gltf = JSON.parse(gltfJson) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] }
  const uris = [...(gltf.buffers ?? []), ...(gltf.images ?? [])]
    .map((item) => item.uri)
    .filter((uri): uri is string => !!uri && !uri.startsWith('data:'))
  return [...new Set(uris.map((uri) => decodeURIComponent(uri.split('/').pop() ?? uri)))]
}

export interface SkippedImport {
  fileName: string
  reason: string
}

export interface OptimisedImport {
  asset: AssetDefinition
  /** e.g. "753k → 100k triangles, 8K → 2K textures, 46.4 MB → 5.1 MB" */
  summary: string
  /** Swaps the stored optimised model for the files exactly as imported. */
  keepOriginal: () => Promise<AssetDefinition>
}

export interface ImportResult {
  added: AssetDefinition[]
  skipped: SkippedImport[]
  optimised: OptimisedImport[]
  /** Over budget but couldn't be optimised, so stored as given: file name and why. */
  unoptimised: SkippedImport[]
}

const releaseRecordUrls = (assetId: string): void => {
  const url = resolveLocalAssetUrl(assetId)
  if (url) URL.revokeObjectURL(url)
  unregisterLocalAsset(assetId)
  delete userModelUrlModifiers[assetId]
}

/**
 * Imports every model in `files` — any mix of .glb files and .gltf files with their
 * .bin/texture files, selected or dropped together in one go. Each .gltf is given the
 * companion files it actually references. A model is skipped, not imported, when its
 * name matches one already in the library (`existingNames`, which includes built-ins)
 * or its content is byte-identical to one already in it — imported or `builtInModels`.
 */
export const addUserAssets = async (
  files: File[],
  existingNames: readonly string[],
  builtInModels: readonly { label: string; url: string }[],
  /** Reports long-running steps (optimising a large model) while the import runs. */
  onProgress?: (message: string) => void,
): Promise<ImportResult> => {
  const entries = files.filter((file) => ENTRY_FILE_PATTERN.test(file.name))
  if (entries.length === 0) throw new Error('Select a .glb or .gltf file')
  const companions = new Map(files.filter((file) => !ENTRY_FILE_PATTERN.test(file.name)).map((file) => [file.name, file]))

  const db = await openDb()
  const records = await readAllRecords(db)
  const hashes = new Map<string, string>() // content hash -> library name
  for (const record of records) {
    if (!record.contentHash) {
      const entry = record.files.find((file) => file.name === record.entryFileName)
      if (!entry) continue
      record.contentHash = await hashBlob(entry.blob)
      await putRecord(db, record)
    }
    hashes.set(record.contentHash, record.name)
  }
  // Built-ins aren't in the database, so their content is hashed from the bundled file.
  // One that can't be fetched is only protected by the name check.
  for (const model of builtInModels) {
    try {
      hashes.set(await hashBuiltIn(model.url), model.label)
    } catch {
      // ignore: see above
    }
  }
  const takenNames = new Set(existingNames.map(normalizeAssetName))

  const result: ImportResult = { added: [], skipped: [], optimised: [], unoptimised: [] }
  for (const entry of entries) {
    const name = entry.name.replace(ENTRY_FILE_PATTERN, '')
    if (takenNames.has(normalizeAssetName(name))) {
      result.skipped.push({ fileName: entry.name, reason: `an asset named "${name}" is already in the library` })
      continue
    }
    const contentHash = await hashBlob(entry)
    const sameAs = hashes.get(contentHash)
    if (sameAs !== undefined) {
      result.skipped.push({ fileName: entry.name, reason: `it is the same model as "${sameAs}"` })
      continue
    }

    let modelFiles: File[] = [entry]
    if (entry.name.toLowerCase().endsWith('.gltf')) {
      let referenced: string[]
      try {
        referenced = referencedFileNames(await entry.text())
      } catch {
        result.skipped.push({ fileName: entry.name, reason: 'it is not valid glTF' })
        continue
      }
      const missing = referenced.filter((fileName) => !companions.has(fileName))
      if (missing.length > 0) {
        result.skipped.push({ fileName: entry.name, reason: `add ${missing.join(', ')} alongside it` })
        continue
      }
      modelFiles = [entry, ...referenced.map((fileName) => companions.get(fileName)!)]
    }

    const originalFiles = modelFiles.map((file) => ({ name: file.name, blob: file as Blob }))
    const record: StoredUserModel = {
      id: crypto.randomUUID(),
      name,
      entryFileName: entry.name,
      files: originalFiles,
      addedAt: Date.now(),
      contentHash,
    }

    // Over-budget models are stored optimised; the duplicate check above still used the
    // original's hash, so re-importing the same original is still recognised.
    onProgress?.(`Checking ${name} against the real-time budget…`)
    const optimisation = await optimiseInWorker(entry, modelFiles.slice(1))
    if (optimisation.status === 'optimised') {
      // A .gltf comes back as one self-contained GLB.
      const glbName = `${name}.glb`
      record.entryFileName = glbName
      record.files = [{ name: glbName, blob: new Blob([optimisation.glb as Uint8Array<ArrayBuffer>], { type: 'model/gltf-binary' }) }]
      record.optimisation = { before: optimisation.before, after: optimisation.after }
    } else if (optimisation.status === 'failed') {
      result.unoptimised.push({ fileName: entry.name, reason: optimisation.reason })
    }

    await putRecord(db, record)
    takenNames.add(normalizeAssetName(name))
    hashes.set(contentHash, name)
    const asset = registerRecord(record)
    result.added.push(asset)
    if (record.optimisation) {
      const { before, after } = record.optimisation
      result.optimised.push({
        asset,
        summary: describeOptimisation(before, after),
        keepOriginal: async () => {
          const original: StoredUserModel = { ...record, entryFileName: entry.name, files: originalFiles, optimisation: undefined }
          await putRecord(await openDb(), original)
          releaseRecordUrls(asset.assetId)
          return registerRecord(original)
        },
      })
    }
  }
  return result
}

export const removeUserAsset = async (assetId: string): Promise<void> => {
  const db = await openDb()
  const id = assetId.slice(ASSET_ID_PREFIX.length)
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to remove the imported asset'))
  })
  releaseRecordUrls(assetId)
  // Auxiliary (.bin/texture) blob URLs created in registerRecord's fileMap closure aren't
  // individually revoked here — a bounded, session-local leak of dead URL handles, not of
  // the underlying memory, and acceptable for this local-only prototype feature.
}
