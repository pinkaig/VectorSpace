/**
 * @file        AssetRef.ts
 * @brief       The opaque reference every part of the app uses to name an asset.
 *
 * @responsibility
 * Defines the identity of an asset independent of where it lives or how it is
 * fetched. Resolvers turn an AssetRef into an AssetDescriptor; nothing else
 * about an asset's origin leaks into calling code.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import type { AssetRefKind } from '@vthere/project'

export interface AssetRef {
  assetId: string
  // widened from AssetKind so media attachments (audio/image/video/text)
  // resolve through the same chain as placeable primitives and models
  kind: AssetRefKind
}
