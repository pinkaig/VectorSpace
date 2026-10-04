/**
 * @file        audioByteCache.ts
 * @brief       IndexedDB byte cache for Tier B audio assets (small/frequent clips).
 *
 * @responsibility
 * A transparent, app-managed cache in front of the network — not an authoring
 * store. This is deliberately not the same thing as userAssets.ts's IndexedDB
 * use: that one persists user-authored, offline-editable imports the user
 * browses and deletes; this one silently caches encoded bytes for assetIds
 * the catalog already resolves to a URL, keyed by assetId, and can be evicted
 * or repopulated at will with no user-visible effect beyond a slower first
 * play. See audio-system.md's "Loading audio into the app" for the two-tier
 * design this implements the Tier B half of.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
const DB_NAME = 'vthere-audio-cache'
const STORE_NAME = 'clips'
const DB_VERSION = 1

/** Total cached bytes above which oldest-accessed entries are evicted to make room. */
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024

interface CachedClipRecord {
  assetId: string
  bytes: ArrayBuffer
  contentType?: string
  byteLength: number
  lastAccessedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

const openDb = (): Promise<IDBDatabase> => {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'assetId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open the audio byte cache database'))
  })
  return dbPromise
}

const runRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Audio byte cache request failed'))
  })

/**
 * Reads a cached clip's bytes, or undefined on a miss. Bumps the entry's
 * last-accessed time so eviction stays least-recently-used, not
 * least-recently-written.
 */
export const readCachedClip = async (assetId: string): Promise<{ data: ArrayBuffer; contentType?: string } | undefined> => {
  const db = await openDb()
  const record = await runRequest<CachedClipRecord | undefined>(
    db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(assetId),
  )
  if (!record) return undefined

  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
  store.put({ ...record, lastAccessedAt: Date.now() })
  return { data: record.bytes, contentType: record.contentType }
}

/** Writes a clip's bytes to the cache, then evicts least-recently-used entries over the byte budget. */
export const writeCachedClip = async (
  assetId: string,
  data: ArrayBuffer,
  contentType: string | undefined,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<void> => {
  const db = await openDb()
  const record: CachedClipRecord = { assetId, bytes: data, contentType, byteLength: data.byteLength, lastAccessedAt: Date.now() }
  await runRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record))
  await evictOverBudget(db, maxBytes)
}

const evictOverBudget = async (db: IDBDatabase, maxBytes: number): Promise<void> => {
  const records = await runRequest<CachedClipRecord[]>(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll())
  let totalBytes = records.reduce((sum, record) => sum + record.byteLength, 0)
  if (totalBytes <= maxBytes) return

  const oldestFirst = [...records].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
  for (const record of oldestFirst) {
    if (totalBytes <= maxBytes) break
    store.delete(record.assetId)
    totalBytes -= record.byteLength
  }
}

/** Removes one cached clip, e.g. when an asset is retired from the catalog. */
export const evictCachedClip = async (assetId: string): Promise<void> => {
  const db = await openDb()
  await runRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(assetId))
}

/** Test/dev-only: drops every cached clip. */
export const clearAudioByteCache = async (): Promise<void> => {
  const db = await openDb()
  await runRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear())
}
