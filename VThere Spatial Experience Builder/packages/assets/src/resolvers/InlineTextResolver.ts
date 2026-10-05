/**
 * @file        InlineTextResolver.ts
 * @brief       Resolves text assets from project data already in memory.
 *
 * @responsibility
 * Text is project data, never media storage (text-system.md section 1), so
 * this resolver exists purely for shape: text participates in the same
 * AssetRef -> AssetDescriptor path as every other kind, for callers that do
 * not care which kind they are looking at. It always resolves from the meta
 * the injected lookup returns — no network, no loading state, nothing to
 * cache or evict.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/attachment-integration.md section 6.1
 */
import type { TextAssetMeta } from '@vthere/project'
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

export type TextAssetLookup = (assetId: string) => TextAssetMeta | undefined

export class InlineTextResolver implements AssetResolver {
  constructor(private readonly lookup: TextAssetLookup) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (ref.kind !== 'text') {
      return errorAssetDescriptor(ref, `InlineTextResolver cannot resolve asset kind "${ref.kind}"`)
    }
    const meta = this.lookup(ref.assetId)
    if (!meta) {
      return errorAssetDescriptor(ref, `No text asset "${ref.assetId}" exists in the project`)
    }
    const blob = new Blob([meta.content], { type: 'text/plain' })
    return readyAssetDescriptor(ref, { contentType: 'text/plain', blob, sizeBytes: blob.size })
  }
}
