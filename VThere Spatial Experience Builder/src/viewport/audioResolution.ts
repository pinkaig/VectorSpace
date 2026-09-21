/**
 * @file        audioResolution.ts
 * @brief       App-level audio asset lookup: assetId -> URL, from a local dev catalog.
 *
 * @responsibility
 * The seam AudioSystem's AudioResolver interface expects. No real audio
 * storage exists yet (audio-system.md's "Considerations"), so this resolves
 * against a small bundled catalog under `public/audio/` rather than the full
 * Asset Manager resolver chain used for GLB assets in assetResolution.ts.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
 */
import type { AudioResolver, ResolvedAudio } from '../../packages/audio/src/index'

// Empty for now: no bundled audio clips exist yet. An authored assetId simply
// fails to resolve, which AudioSystem surfaces as a voice in 'error' — never
// a silent blank, per the design doc's error policy.
const localAudioCatalog = new Map<string, ResolvedAudio>()

export const audioResolver: AudioResolver = {
  async resolve(assetId: string): Promise<ResolvedAudio | null> {
    return localAudioCatalog.get(assetId) ?? null
  },
}
