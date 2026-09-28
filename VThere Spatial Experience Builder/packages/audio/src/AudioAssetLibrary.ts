/**
 * @file        AudioAssetLibrary.ts
 * @brief       Reads ProjectData.audioAssets and merges per-play overrides over meta over channel defaults.
 *
 * @responsibility
 * Implements the resolution order from audio-system.md section 2 for the
 * fields this slice supports: per-play override, then AudioAssetMeta, then a
 * built-in default. (Attachment overrides are not implemented in this slice —
 * no attachment model exists on SceneObject/ZoneDefinition yet.)
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
 */
import type { AudioAssetMeta, ChannelId } from '@vthere/project'

export interface ResolvedPlaySettings {
  channel: ChannelId
  volume: number
  loop: boolean
  rate: number
}

const BUILT_IN_DEFAULTS: ResolvedPlaySettings = { channel: 'sfx', volume: 1, loop: false, rate: 1 }

export interface PlayOverrides {
  channel?: ChannelId
  volume?: number
  loop?: boolean
  rate?: number
}

export class AudioAssetLibrary {
  private metaById = new Map<string, AudioAssetMeta>()

  constructor(metas: readonly AudioAssetMeta[] = []) {
    this.setMetas(metas)
  }

  setMetas(metas: readonly AudioAssetMeta[]): void {
    this.metaById = new Map(metas.map((meta) => [meta.assetId, meta]))
  }

  getMeta(assetId: string): AudioAssetMeta | undefined {
    return this.metaById.get(assetId)
  }

  resolve(assetId: string, overrides: PlayOverrides = {}): ResolvedPlaySettings {
    const meta = this.metaById.get(assetId)
    return {
      channel: overrides.channel ?? meta?.channel ?? BUILT_IN_DEFAULTS.channel,
      volume: overrides.volume ?? meta?.volume ?? BUILT_IN_DEFAULTS.volume,
      loop: overrides.loop ?? meta?.loop ?? BUILT_IN_DEFAULTS.loop,
      rate: overrides.rate ?? BUILT_IN_DEFAULTS.rate,
    }
  }
}
