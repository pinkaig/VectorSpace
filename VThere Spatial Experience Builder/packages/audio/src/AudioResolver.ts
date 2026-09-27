/**
 * @file        AudioResolver.ts
 * @brief       Turns an assetId into a playable URL, without depending on @vthere/assets.
 *
 * @responsibility
 * This slice does not wire audio through the full Asset Manager resolver
 * chain (no AssetKind widening yet — see audio-system.md's "Considerations").
 * `AudioResolver` is the minimal seam that lets the app supply a URL lookup
 * (a local catalog, a future Asset Manager adapter) while packages/audio
 * itself stays dependency-free of @vthere/assets.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
 */
/**
 * Two forms a resolved asset can take. `url`: fetched by the backend at decode
 * time, nothing persisted on the device (Tier A — long-form/streaming audio).
 * `buffer`: the encoded bytes already in hand (e.g. read from an on-device
 * cache), decoded directly with no fetch (Tier B — small/frequent clips
 * cached in IndexedDB). See audio-system.md's "Loading audio into the app"
 * for which tier a given asset should use and why.
 */
export type ResolvedAudio =
  | { kind: 'url'; url: string; contentType?: string }
  | { kind: 'buffer'; data: ArrayBuffer; contentType?: string }

export interface AudioResolver {
  resolve(assetId: string): Promise<ResolvedAudio | null>
}
