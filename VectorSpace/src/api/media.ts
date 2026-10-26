/**
 * @file        media.ts
 * @project     VectorSpace
 * @author      Weian Ching
 * @brief       The browser's side of a project's media library: list, upload,
 *              add a link, approve or send back a link, delete.
 *
 * @responsibility
 * Wraps the routes in apps/api/app/routers/media.py. Uploading is three steps:
 * ask for a presigned URL, PUT the file straight to storage with progress,
 * then confirm so the server checks what arrived. A file of the wrong type or
 * over its size cap is refused here, before anything is sent; the server checks
 * again and is the one that decides.
 *
 * @boundary
 * The token is never stored here; callers pass getToken, as with client.ts.
 * Throws ApiError (from client.ts) when the server refuses.
 *
 * @documentation
 * docs/handover/image-video-work-package.md steps B4 and B8.
 */
import { MEDIA_KIND_SPECS, kindForContentType } from '../../packages/assets/src/index'
import { apiFetch, apiUrl, type GetToken } from './client'

/** One library entry as the API sends it (MediaEntryResponse); file or external link in one shape. */
export interface MediaEntry {
  id: string
  project_id: string
  kind: 'image' | 'video'
  source: 'file' | 'external'
  /** The uploaded file's name, or "YouTube video <id>". */
  label: string
  status: 'pending' | 'uploaded' | 'failed' | null
  content_type: string | null
  size_bytes: number | null
  provider: 'youtube' | null
  provider_id: string | null
  url: string | null
  approval: 'pending' | 'approved' | 'rejected' | null
  review_comment: string | null
  created_at: string
}

interface UploadTicket {
  media_asset_id: string
  upload_url: string
  storage_key: string
}

const mediaPath = (projectId: string, suffix = '') => `/projects/${encodeURIComponent(projectId)}/media${suffix}`

export const listMedia = (getToken: GetToken, projectId: string, base = apiUrl) =>
  apiFetch<MediaEntry[]>(getToken, mediaPath(projectId), {}, base)

export const addMediaLink = (getToken: GetToken, projectId: string, url: string, base = apiUrl) =>
  apiFetch<MediaEntry>(getToken, mediaPath(projectId, '/links'), { method: 'POST', body: { url } }, base)

/** Approve a link, or send it back ('rejected') with a comment for whoever added it. */
export const reviewMediaLink = (getToken: GetToken, projectId: string, linkId: string, approval: 'approved' | 'rejected', comment?: string, base = apiUrl) =>
  apiFetch<MediaEntry>(getToken, mediaPath(projectId, `/links/${encodeURIComponent(linkId)}`), { method: 'PATCH', body: { approval, comment: comment || undefined } }, base)

export const deleteMedia = (getToken: GetToken, projectId: string, mediaId: string, base = apiUrl) =>
  apiFetch<void>(getToken, mediaPath(projectId, `/${encodeURIComponent(mediaId)}`), { method: 'DELETE' }, base)

/** Which kind a file would upload as, or why it cannot be uploaded at all. */
export const checkUploadFile = (file: { type: string; size: number }): { kind: 'image' | 'video' } | { error: string } => {
  const kind = kindForContentType(file.type)
  if (kind !== 'image' && kind !== 'video') return { error: 'Only PNG, JPEG or WebP images and MP4 or WebM videos can be uploaded' }
  if (file.size <= 0) return { error: 'The file is empty' }
  const cap = MEDIA_KIND_SPECS[kind].maxBytes
  if (file.size > cap) return { error: `The file is larger than ${Math.round(cap / 1_000_000)} MB` }
  return { kind }
}

/** PUT with progress; fetch cannot report upload progress, XMLHttpRequest can. */
const putWithProgress = (url: string, file: Blob, contentType: string, onProgress?: (fraction: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    // must match the type the URL was signed for, or storage refuses the upload
    request.setRequestHeader('Content-Type', contentType)
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total) }
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (${request.status})`)))
    request.onerror = () => reject(new Error('The upload was interrupted'))
    request.send(file)
  })

/** The whole upload: ask, PUT, confirm. Returns the confirmed entry. */
export const uploadMediaFile = async (
  getToken: GetToken,
  projectId: string,
  file: File,
  onProgress?: (fraction: number) => void,
  base = apiUrl,
): Promise<MediaEntry> => {
  const checked = checkUploadFile(file)
  if ('error' in checked) throw new Error(checked.error)
  const ticket = await apiFetch<UploadTicket>(getToken, mediaPath(projectId), {
    method: 'POST',
    body: { kind: checked.kind, content_type: file.type, size_bytes: file.size, filename: file.name },
  }, base)
  await putWithProgress(ticket.upload_url, file, file.type, onProgress)
  return apiFetch<MediaEntry>(getToken, mediaPath(projectId, `/${encodeURIComponent(ticket.media_asset_id)}/confirm`), { method: 'POST' }, base)
}

/** What an info card may show: uploaded files and approved links only, as picker choices. */
export const playableChoices = (entries: MediaEntry[]): { assetId: string; kind: 'image' | 'video'; label: string }[] =>
  entries
    .filter((entry) => (entry.source === 'file' ? entry.status === 'uploaded' : entry.approval === 'approved'))
    .map((entry) => ({ assetId: entry.id, kind: entry.kind, label: entry.label }))
