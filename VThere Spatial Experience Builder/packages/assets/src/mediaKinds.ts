/**
 * @file        mediaKinds.ts
 * @brief       Table-driven knowledge of every media kind: routing, allowlist, size caps.
 *
 * @responsibility
 * One shared table answering "which content types may this kind carry, how
 * big may a file be, and which type package owns its decoded memory" — so
 * resolvers and guards stay table-driven instead of scattering per-kind
 * knowledge. An asset can arrive from a primitive, the dev catalog, an inline
 * project field or (Stage 3) a signed cloud URL; a per-origin check would be
 * written four times and diverge, so the knowledge lives here and is enforced
 * once by ContentGuardResolver. The caps are tuning numbers, but the
 * allowlist is not: removing an entry is tuning, adding one is a security
 * decision. The client and the backend allowlist must stay the same list —
 * this table protects the client's own memory, it is not the security
 * boundary.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/media-policy-and-cloud-download.md
 */
import type { MediaKind } from '@vthere/project'

export interface MediaKindSpec {
  kind: MediaKind
  /** Exact content-type allowlist; an extension is never trusted. */
  contentTypes: readonly string[]
  /** Upload and resolve limit for one file. */
  maxBytes: number
  /** Which type package decodes this kind and owns its decoded memory. */
  owner: 'audio' | 'image' | 'text' | 'video'
  /** Starting budget for that package's decoded cache; 0 = not byte-budgeted. */
  decodedBudgetBytes: number
}

export const MEDIA_KIND_SPECS: Readonly<Record<MediaKind, MediaKindSpec>> = {
  audio: {
    kind: 'audio',
    contentTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm'],
    maxBytes: 20_000_000,
    owner: 'audio',
    decodedBudgetBytes: 64_000_000,
  },
  image: {
    kind: 'image',
    // image/svg+xml deliberately excluded: SVG can carry script
    contentTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 10_000_000,
    owner: 'image',
    decodedBudgetBytes: 128_000_000,
  },
  video: {
    kind: 'video',
    contentTypes: ['video/mp4', 'video/webm'],
    maxBytes: 200_000_000,
    owner: 'video',
    // streamed, never decoded into a byte budget; limited by playing slots
    decodedBudgetBytes: 0,
  },
  text: {
    kind: 'text',
    contentTypes: ['text/plain', 'text/markdown'],
    // matches the serializer's per-asset cap; inline text needs no decode budget
    maxBytes: 65_536,
    owner: 'text',
    decodedBudgetBytes: 0,
  },
}

export const isMediaKind = (kind: string): kind is MediaKind =>
  Object.prototype.hasOwnProperty.call(MEDIA_KIND_SPECS, kind)

export const kindForContentType = (contentType: string): MediaKind | undefined => {
  for (const spec of Object.values(MEDIA_KIND_SPECS)) {
    if (spec.contentTypes.includes(contentType)) return spec.kind
  }
  return undefined
}

export const isAllowedContentType = (kind: MediaKind, contentType: string): boolean =>
  MEDIA_KIND_SPECS[kind].contentTypes.includes(contentType)
