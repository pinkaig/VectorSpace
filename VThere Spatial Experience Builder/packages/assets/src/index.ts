/**
 * @file        index.ts
 * @brief       Public entry point for the asset resolution package.
 *
 * @responsibility
 * Re-exports the asset reference/descriptor/resolver contract, the three
 * concrete resolvers, and the cache/placeholder wrappers. This file is the
 * package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports do
 * not resolve. Anything consumers need must be re-exported here.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
export type { AssetRef } from './AssetRef'
export type { AssetDescriptor, AssetStatus } from './AssetDescriptor'
export {
  idleAssetDescriptor,
  loadingAssetDescriptor,
  readyAssetDescriptor,
  errorAssetDescriptor,
} from './AssetDescriptor'
export type { AssetResolver } from './AssetResolver'

export { AssetCache } from './AssetCache'
export { CachingAssetResolver } from './CachingAssetResolver'
export {
  PlaceholderAssetResolver,
  isPlaceholderDescriptor,
  type PlaceholderAssetDescriptor,
} from './PlaceholderAssetResolver'

export { PrimitiveResolver } from './resolvers/PrimitiveResolver'
export { LocalCatalogResolver, type LocalCatalogEntry } from './resolvers/LocalCatalogResolver'
export { RemoteMediaResolver, type RemoteMediaResolverOptions } from './resolvers/RemoteMediaResolver'
