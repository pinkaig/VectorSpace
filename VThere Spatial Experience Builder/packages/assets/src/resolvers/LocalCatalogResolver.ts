/**
 * @file        LocalCatalogResolver.ts
 * @brief       Resolves assets from a dev-time GLB catalog.
 *
 * @responsibility
 * Looks assetId up in an injected catalog map of assetId -> URL, so editor
 * and tests can run against a fixed local set of GLBs without a backend.
 * The catalog is provided by the caller (never hardcoded here) so it can be
 * swapped for fixtures in tests or a real dev-asset folder in the app.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

export interface LocalCatalogEntry {
  url: string
  contentType?: string
}

export class LocalCatalogResolver implements AssetResolver {
  constructor(private readonly catalog: ReadonlyMap<string, LocalCatalogEntry>) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    const entry = this.catalog.get(ref.assetId)
    if (!entry) {
      return errorAssetDescriptor(ref, `LocalCatalogResolver has no entry for asset "${ref.assetId}"`)
    }
    return readyAssetDescriptor(ref, {
      contentType: entry.contentType ?? 'model/gltf-binary',
      url: entry.url,
    })
  }
}
