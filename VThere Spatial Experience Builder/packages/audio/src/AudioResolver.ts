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
export interface ResolvedAudio {
  url: string
  contentType?: string
}

export interface AudioResolver {
  resolve(assetId: string): Promise<ResolvedAudio | null>
}
