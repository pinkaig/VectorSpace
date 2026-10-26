/**
 * @file        RemoteMediaResolver.ts
 * @brief       Resolves image and video library entries from the backend media API.
 *
 * @responsibility
 * Calls `GET /projects/{projectId}/media/{assetId}` and turns the reply into a
 * descriptor:
 * - an uploaded file becomes a ready descriptor with its presigned download
 *   URL, content type and size. ContentGuardResolver then checks the type and
 *   size. expiresAt is set a minute before the URL dies, so
 *   CachingAssetResolver drops it and asks again instead of serving a dead URL;
 * - an approved external link becomes an embed descriptor (provider + id) with
 *   no URL and no fetch of the video itself.
 * Anything else (offline, not found, not ready, not approved, a reply that
 * does not match the ref) becomes an error descriptor. Never throws.
 *
 * @documentation
 * docs/handover/image-video-work-package.md step B5.
 */
import { embedAssetDescriptor, errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

export interface RemoteMediaResolverOptions {
  projectId: string
  /** API address (VITE_API_URL in the app). Undefined means offline, and every resolve is an error. */
  baseUrl?: string
  /** The signed-in person's bearer token, read fresh on every call because it can be refreshed. */
  getToken?: () => Promise<string | null>
  fetchImpl?: typeof fetch
  now?: () => number
}

/** The fields of the API's MediaEntryResponse this resolver reads. */
interface MediaEntry {
  kind: string
  source: 'file' | 'external'
  status?: string | null
  content_type?: string | null
  size_bytes?: number | null
  download_url?: string | null
  download_expires_in?: number | null
  provider?: string | null
  provider_id?: string | null
  approval?: string | null
}

// drop a cached URL this long before the server says it expires, so a slow load never starts on a dead URL
const EXPIRY_MARGIN_MS = 60_000

export class RemoteMediaResolver implements AssetResolver {
  constructor(private readonly options: RemoteMediaResolverOptions) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    const { projectId, baseUrl, getToken, fetchImpl = fetch, now = Date.now } = this.options
    if (ref.kind !== 'image' && ref.kind !== 'video') return errorAssetDescriptor(ref, `The media library holds images and videos, not "${ref.kind}"`)
    if (!baseUrl) return errorAssetDescriptor(ref, 'Media from the library needs the server, and none is set')
    try {
      const headers = new Headers()
      const token = getToken ? await getToken() : null
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const path = `/projects/${encodeURIComponent(projectId)}/media/${encodeURIComponent(ref.assetId)}`
      const response = await fetchImpl(`${baseUrl}${path}`, { headers })
      if (response.status === 404) return errorAssetDescriptor(ref, 'This media is not available')
      if (!response.ok) return errorAssetDescriptor(ref, `The media server answered ${response.status}`)
      const entry = (await response.json()) as MediaEntry
      if (entry.kind !== ref.kind) return errorAssetDescriptor(ref, `Expected ${ref.kind} but the library entry is ${entry.kind}`)

      if (entry.source === 'external') {
        if (entry.approval !== 'approved') return errorAssetDescriptor(ref, 'This link is waiting for a teacher to approve it')
        if (!entry.provider || !entry.provider_id) return errorAssetDescriptor(ref, 'This link is missing its video id')
        // the provider and id are checked against the allowlist by ContentGuardResolver
        return embedAssetDescriptor(ref, { provider: entry.provider as 'youtube', providerId: entry.provider_id })
      }

      if (entry.status !== 'uploaded' || !entry.download_url || !entry.content_type) return errorAssetDescriptor(ref, 'This file has not finished uploading')
      const lifetimeMs = (entry.download_expires_in ?? 0) * 1000
      return readyAssetDescriptor(ref, {
        contentType: entry.content_type,
        url: entry.download_url,
        sizeBytes: entry.size_bytes ?? undefined,
        // no lifetime from the server: expire at once rather than trust the URL forever
        expiresAt: now() + Math.max(0, lifetimeMs - EXPIRY_MARGIN_MS),
      })
    } catch (error) {
      return errorAssetDescriptor(ref, error instanceof Error ? error.message : String(error))
    }
  }
}
