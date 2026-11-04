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

/**
 * Whether the bytes behind an asset are worth persisting. This is
 * audioResolution.ts's existing `cacheStrategy` promoted onto the descriptor,
 * so the decision travels with the asset instead of living in one subsystem:
 * `stream` hands back a URL and persists nothing, `cache` persists the bytes
 * after the first fetch. Audio cannot converge onto the resolver chain until
 * the descriptor can express this (see packages/audio/src/AudioResolver.ts).
 */
export type AssetTier = 'stream' | 'cache'

/**
 * RESERVED, no reader. Who an asset belongs to, which is the first decision the
 * cloud work has to settle. Declared now so adding the server is a fill-in
 * rather than a schema change — the same wired-but-unfed pattern the text leg
 * in src/content/assetResolution.ts already uses.
 */
export type AssetScope = 'catalog' | 'project' | 'user'

/** RESERVED, no reader. The upload lifecycle an uploaded asset passes through. */
export type AssetModerationState = 'pending' | 'processing' | 'approved' | 'rejected'

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
  /** Whether these bytes are worth persisting. Absent = decided by the caller, as today. */
  tier?: AssetTier
  /**
   * An etag or content hash identifying *these* bytes, so a persistent cache can
   * be keyed by `assetId + version` and a changed asset cannot serve stale bytes.
   * userAssets.ts already computes a SHA-256 of an import's entry file.
   */
  version?: string
  /** RESERVED, no reader. See AssetScope. */
  scope?: AssetScope
  /** RESERVED, no reader. See AssetModerationState. */
  moderationState?: AssetModerationState
}

export const idleAssetDescriptor = (ref: AssetRef): AssetDescriptor => ({ ref, status: 'idle' })

export const loadingAssetDescriptor = (ref: AssetRef): AssetDescriptor => ({ ref, status: 'loading' })

export const readyAssetDescriptor = (
  ref: AssetRef,
  fields: {
    contentType: string
    url?: string
    blob?: Blob
    expiresAt?: number
    sizeBytes?: number
    width?: number
    height?: number
    durationMs?: number
    tier?: AssetTier
    version?: string
    scope?: AssetScope
    moderationState?: AssetModerationState
  },
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
