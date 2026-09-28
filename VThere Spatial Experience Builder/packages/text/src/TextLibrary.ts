/**
 * @file        TextLibrary.ts
 * @brief       Synchronous lookup of text asset meta and content from project data.
 *
 * @responsibility
 * Text is project data (text-system.md section 1): every asset deserialised
 * with the project and sits in memory, so lookup is a field read — no
 * network, no loading state, no cache tier. The app feeds the current
 * ProjectData.textAssets in whenever the project changes, the same pattern
 * as AudioSystem.setProjectAudioAssets.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md sections 1 and "Class design"
 */
import type { TextAssetMeta } from '@vthere/project'

export class TextLibrary {
  private byId = new Map<string, TextAssetMeta>()

  constructor(textAssets?: readonly TextAssetMeta[]) {
    this.setTextAssets(textAssets)
  }

  setTextAssets(textAssets: readonly TextAssetMeta[] | undefined): void {
    this.byId = new Map((textAssets ?? []).map((meta) => [meta.assetId, meta]))
  }

  getMeta(assetId: string): TextAssetMeta | undefined {
    return this.byId.get(assetId)
  }

  getContent(assetId: string): string | undefined {
    return this.byId.get(assetId)?.content
  }
}
