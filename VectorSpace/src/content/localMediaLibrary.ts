/**
 * @file        localMediaLibrary.ts
 * @project     VectorSpace
 * @author      Weian Ching
 * @brief       The media library kept in this browser, until the server library
 *              is in use: image and video files, YouTube links and web image
 *              links, each with an approval state.
 *
 * @responsibility
 * Every image or video an info card or object shows is an entry here, found
 * by id. An entry is one of two kinds of source:
 * - a file (PNG, JPEG, WebP, MP4, WebM) uploaded from this computer, stored in
 *   the browser's IndexedDB (localStorage holds only about 5 MB, too small for
 *   video). Files are ready at once;
 * - an external link: a YouTube video (played in YouTube's own player) or a
 *   direct https link to a PNG, JPEG or WebP image. A link added in the editor
 *   waits for an admin to approve it on the admin Rooms & assets page; a link
 *   the admin adds there is approved straight away.
 * Entry details live in localStorage, file bytes in IndexedDB. Both are local
 * to this browser and device, the same caveat as userAudio.ts and
 * userAssets.ts.
 *
 * @documentation
 * docs/handover/image-video-work-package.md (B2, B7); the server version is
 * apps/api/app/routers/media.py.
 */
import { useSyncExternalStore } from 'react'
import { errorAssetDescriptor, embedAssetDescriptor, readyAssetDescriptor, parseMediaLink, type AssetDescriptor, type AssetRef, type AssetResolver } from '../../packages/assets/src/index'
import { checkUploadFile } from '../api/media'

export type MediaApproval = 'approved' | 'pending' | 'rejected'

export interface LocalMediaEntry {
  id: string
  kind: 'image' | 'video'
  source: 'file' | 'youtube' | 'web'
  label: string
  approval: MediaApproval
  addedBy: 'admin' | 'editor'
  addedAt: number
  contentType?: string   // file and web image only
  sizeBytes?: number     // file only
  providerId?: string    // youtube only: the 11-character video id
  url?: string           // web image only; YouTube addresses are always rebuilt from the id
  reviewComment?: string
}

const ENTRIES_KEY = 'vectorspace-media-library-v1'
const DB_NAME = 'vectorspace-media-files'
const STORE_NAME = 'files'
const MAX_LINK_LENGTH = 500
const WEB_IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

// ── pure helpers (no browser storage), tested in localMediaLibrary.test.ts ──

/**
 * What a pasted link is: a YouTube video, a direct image, or neither.
 * YouTube goes through the same parser as the server (parseMediaLink). An
 * image link must be https, have nothing hidden in its host part (no user,
 * password or port) and end in .png, .jpg, .jpeg or .webp; an <img> never runs
 * script, and anything else is refused.
 */
export const classifyMediaLink = (url: string):
  | { source: 'youtube'; kind: 'video'; providerId: string }
  | { source: 'web'; kind: 'image'; url: string; contentType: string }
  | { error: string } => {
  const youtube = parseMediaLink(url)
  if (!('error' in youtube)) return { source: 'youtube', kind: 'video', providerId: youtube.providerId }
  const text = typeof url === 'string' ? url.trim() : ''
  if (!text || text.length > MAX_LINK_LENGTH || /[\\\s]/.test(text)) return { error: 'Paste a YouTube link or a link to a PNG, JPEG or WebP image' }
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(text)?.[1]
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return { error: 'That is not a valid link' }
  }
  if (parsed.protocol !== 'https:') return { error: 'Only https links can be added' }
  if (authority === undefined || authority.includes('@') || authority.includes(':')) return { error: 'That is not a valid link' }
  const extension = /\.([a-z]+)$/i.exec(parsed.pathname)?.[1]?.toLowerCase()
  const contentType = extension ? WEB_IMAGE_TYPES[extension] : undefined
  if (!contentType) return { error: 'Paste a YouTube link or a link to a PNG, JPEG or WebP image' }
  return { source: 'web', kind: 'image', url: parsed.href, contentType }
}

/** The descriptor an entry resolves to; fileUrl is the blob: URL of a stored file. */
export const descriptorForEntry = (ref: AssetRef, entry: LocalMediaEntry | undefined, fileUrl?: string): AssetDescriptor => {
  if (!entry) return errorAssetDescriptor(ref, 'This media is not in the library')
  if (entry.kind !== ref.kind) return errorAssetDescriptor(ref, `Expected ${ref.kind} but the library entry is ${entry.kind}`)
  if (entry.approval !== 'approved') return errorAssetDescriptor(ref, entry.approval === 'pending' ? 'This link is waiting for an admin to approve it' : 'This link was sent back')
  if (entry.source === 'youtube' && entry.providerId) return embedAssetDescriptor(ref, { provider: 'youtube', providerId: entry.providerId })
  if (entry.source === 'web' && entry.url && entry.contentType) return readyAssetDescriptor(ref, { contentType: entry.contentType, url: entry.url })
  if (entry.source === 'file' && fileUrl && entry.contentType) return readyAssetDescriptor(ref, { contentType: entry.contentType, url: fileUrl, sizeBytes: entry.sizeBytes })
  return errorAssetDescriptor(ref, 'This file is not in this browser')
}

export const youtubeLabel = (providerId: string) => `YouTube video ${providerId}`

// ── browser storage ──

const readEntries = (): LocalMediaEntry[] => {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as LocalMediaEntry[]) : []
  } catch {
    return []
  }
}

let entries: LocalMediaEntry[] = typeof window === 'undefined' ? [] : readEntries()
const listeners = new Set<() => void>()

const writeEntries = (next: LocalMediaEntry[]) => {
  entries = next
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(next))
  } catch {
    // storage full or blocked: the change still shows for this visit
  }
  listeners.forEach((listener) => listener())
}

// another tab (say the admin page) approved something: pick it up here too
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== ENTRIES_KEY) return
    entries = readEntries()
    listeners.forEach((listener) => listener())
  })
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the local media database'))
  })

const putFile = async (id: string, blob: Blob) => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ id, blob })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not save the file in this browser'))
  })
}

const readFile = async (id: string): Promise<Blob | undefined> => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve((request.result as { blob?: Blob } | undefined)?.blob)
    request.onerror = () => reject(request.error ?? new Error('Could not read the file'))
  })
}

const deleteFile = async (id: string) => {
  const db = await openDb()
  await new Promise<void>((resolve) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
}

// one blob: URL per stored file per page load; a URL from an earlier visit is dead
const fileUrls = new Map<string, Promise<string | undefined>>()
const fileUrlFor = (id: string) => {
  let url = fileUrls.get(id)
  if (!url) {
    url = readFile(id).then((blob) => (blob ? URL.createObjectURL(blob) : undefined)).catch(() => undefined)
    fileUrls.set(id, url)
  }
  return url
}

// ── the library's public face ──

export const listLocalMedia = (): readonly LocalMediaEntry[] => entries

export const subscribeLocalMedia = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The live list, for React. */
export const useLocalMediaLibrary = (): readonly LocalMediaEntry[] =>
  useSyncExternalStore(subscribeLocalMedia, listLocalMedia, listLocalMedia)

/** Stores a file from this computer. Returns the new entry, or an error to show. */
export const addLocalMediaFile = async (file: File): Promise<LocalMediaEntry | { error: string }> => {
  const checked = checkUploadFile(file)
  if ('error' in checked) return checked
  const entry: LocalMediaEntry = {
    id: `local-media-${crypto.randomUUID()}`,
    kind: checked.kind,
    source: 'file',
    label: file.name,
    approval: 'approved',
    addedBy: 'editor',
    addedAt: Date.now(),
    contentType: file.type,
    sizeBytes: file.size,
  }
  try {
    await putFile(entry.id, file)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the file in this browser' }
  }
  writeEntries([...entries, entry])
  return entry
}

/**
 * Adds a YouTube or image link. From the editor it waits for an admin; from
 * the admin page it is approved at once. The same video twice is refused.
 */
export const addLocalMediaLink = (url: string, addedBy: 'admin' | 'editor', label?: string): LocalMediaEntry | { error: string } => {
  const link = classifyMediaLink(url)
  if ('error' in link) return link
  const duplicate = entries.find((entry) => (link.source === 'youtube' ? entry.providerId === link.providerId : entry.url === link.url))
  if (duplicate) return { error: 'That link is already in the library' }
  const entry: LocalMediaEntry = {
    id: `local-media-${crypto.randomUUID()}`,
    kind: link.kind,
    source: link.source,
    label: label?.trim() || (link.source === 'youtube' ? youtubeLabel(link.providerId) : decodeURIComponent(link.url.split('/').pop() ?? 'Image link')),
    approval: addedBy === 'admin' ? 'approved' : 'pending',
    addedBy,
    addedAt: Date.now(),
    ...(link.source === 'youtube' ? { providerId: link.providerId } : { url: link.url, contentType: link.contentType }),
  }
  writeEntries([...entries, entry])
  return entry
}

/** Approve a link, or send it back with an optional comment. */
export const reviewLocalMedia = (id: string, approval: 'approved' | 'rejected', comment?: string) => {
  writeEntries(entries.map((entry) => (entry.id === id ? { ...entry, approval, reviewComment: comment?.trim() || undefined } : entry)))
}

export const renameLocalMedia = (id: string, label: string) => {
  if (!label.trim()) return
  writeEntries(entries.map((entry) => (entry.id === id ? { ...entry, label: label.trim() } : entry)))
}

export const removeLocalMedia = async (id: string) => {
  const entry = entries.find((item) => item.id === id)
  writeEntries(entries.filter((item) => item.id !== id))
  if (entry?.source === 'file') {
    const url = await fileUrls.get(id)
    if (url) URL.revokeObjectURL(url)
    fileUrls.delete(id)
    await deleteFile(id).catch(() => undefined)
  }
}

/** Resolves an entry id the way MediaView needs it; never throws. */
export class LocalMediaResolver implements AssetResolver {
  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    const entry = entries.find((item) => item.id === ref.assetId)
    const fileUrl = entry?.source === 'file' ? await fileUrlFor(entry.id) : undefined
    return descriptorForEntry(ref, entry, fileUrl)
  }
}
