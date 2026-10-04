/**
 * @file        AudioResolver.ts
 * @brief       Turns an assetId into a playable URL, without depending on @vthere/assets.
 *
 * @responsibility
 * Audio does not resolve through the full Asset Manager chain. `AudioResolver`
 * is the minimal seam that lets the app supply a URL/bytes lookup while
 * packages/audio stays dependency-free of @vthere/assets.
 *
 * The original reason was that AssetKind had not been widened past the 3D
 * primitives. That is no longer true — AssetRef.kind now accepts the media
 * kinds — so the remaining reason is the return type, and it is a real one:
 * ResolvedAudio's url-vs-buffer discriminant IS the two-tier decision (stream
 * vs decode from the IndexedDB byte cache), and AssetDescriptor has no way to
 * say which tier an asset should use. `blob` vs `ArrayBuffer` is an adapter;
 * "which tier" is not expressible yet. Converging means adding a tier concept
 * to AssetDescriptor, not just mapping fields — so do not treat this as a
 * simple adapter task.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Chain-side policy: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Media-Policy-and-Cloud-Download
 * Links point at the project wiki; migration is still in progress.
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
