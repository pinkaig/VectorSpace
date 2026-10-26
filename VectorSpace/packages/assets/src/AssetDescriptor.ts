/**
 * @file        AssetDescriptor.ts
 * @brief       The resolved form of an AssetRef.
 *
 * @responsibility
 * Describes everything a caller needs to render or handle an asset once a
 * resolver has looked it up: its loading state, content type, and payload
 * location. Callers branch on `status`, never on which resolver produced it.
 *
 * @members
 * AssetStatus, AssetDescriptor, and the four status-specific constructors
 * (idleAssetDescriptor, loadingAssetDescriptor, readyAssetDescriptor,
 * errorAssetDescriptor) that keep descriptor shape consistent at call sites.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import type { AssetRef } from './AssetRef'
import type { EmbedProvider } from './mediaKinds'

export type AssetStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AssetDescriptor {
  ref: AssetRef
  status: AssetStatus
  /** MIME-ish content type, e.g. "model/gltf-binary". Absent until ready. */
  contentType?: string
  /** Where the resolved payload lives: a URL or an in-memory blob. Absent until ready. */
  url?: string
  blob?: Blob
  /** Set only when status is "error"; human-readable, safe to surface as a retry prompt. */
  errorMessage?: string
  /** Unix ms when this descriptor should no longer be served from cache. Absent = does not expire. */
  expiresAt?: number
  /** Known before download when the source (catalog entry, backend record) carries it. */
  sizeBytes?: number
  /** Media dimensions/duration, when known — image layout and scrub bars before any decode. */
  width?: number
  height?: number
  durationMs?: number
  /**
   * Set instead of url/blob when the media plays in a provider's own player
   * (an approved YouTube link). Nothing is downloaded: the player rebuilds
   * the embed address from providerId, so no pasted URL ever reaches an iframe.
   */
  embed?: { provider: EmbedProvider; providerId: string }
}

export const idleAssetDescriptor = (ref: AssetRef): AssetDescriptor => ({ ref, status: 'idle' })

export const loadingAssetDescriptor = (ref: AssetRef): AssetDescriptor => ({ ref, status: 'loading' })

export const readyAssetDescriptor = (
  ref: AssetRef,
  fields: { contentType: string; url?: string; blob?: Blob; expiresAt?: number; sizeBytes?: number; width?: number; height?: number; durationMs?: number },
): AssetDescriptor => ({ ref, status: 'ready', ...fields })

/** A ready descriptor for an embed: no URL, no bytes, no content type, just the provider and its id. */
export const embedAssetDescriptor = (
  ref: AssetRef,
  embed: { provider: EmbedProvider; providerId: string },
  fields: { expiresAt?: number } = {},
): AssetDescriptor => ({ ref, status: 'ready', embed, ...fields })

export const errorAssetDescriptor = (ref: AssetRef, errorMessage: string): AssetDescriptor => ({
  ref,
  status: 'error',
  errorMessage,
})
