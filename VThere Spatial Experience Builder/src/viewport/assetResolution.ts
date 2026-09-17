/**
 * @file        assetResolution.ts
 * @brief       App-level Asset Manager wiring: one resolver chain, shared status cache.
 *
 * @responsibility
 * Builds the resolver chain (primitives, then a local dev catalog, wrapped in
 * caching and placeholder-on-failure behavior) and exposes a small store that
 * lets the viewport and interaction layer read/observe the resolution status
 * of any SceneObject by id, keyed off its AssetRef (assetId + assetKind).
 *
 * @ownership
 * Owns the resolver chain and an in-memory status-by-object-id cache. Does
 * not own SceneObject/ProjectData; a SceneObject's assetId is the only input.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import {
  CachingAssetResolver,
  LocalCatalogResolver,
  PlaceholderAssetResolver,
  PrimitiveResolver,
  isPlaceholderDescriptor,
  type AssetDescriptor,
  type AssetRef,
  type AssetResolver,
} from '../../packages/assets/src/index'
import type { SceneObject } from '../model'

/**
 * Every AssetKind happens to also be a primitive kind, so PrimitiveResolver
 * alone would resolve any object "ready" regardless of assetId, and a broken
 * assetId could never be observed. Only assetIds shaped like the canonical
 * `primitive-<kind>` (see makeObject in packages/project) are treated as
 * primitives; anything else — including a deliberately broken id — falls
 * through to the local dev catalog, which is empty until real GLB assets
 * exist, so it fails as a genuine, visible error.
 */
class FallbackResolver implements AssetResolver {
  constructor(private readonly primary: AssetResolver, private readonly secondary: AssetResolver) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (ref.assetId === `primitive-${ref.kind}`) return this.primary.resolve(ref)
    return this.secondary.resolve(ref)
  }
}

// Empty for now: no dev GLB catalog exists yet, so every non-primitive assetId
// deliberately fails, surfacing the placeholder/retry state described above.
const localCatalog = new Map<string, { url: string; contentType?: string }>()

const cachingResolver = new CachingAssetResolver(
  new FallbackResolver(new PrimitiveResolver(), new LocalCatalogResolver(localCatalog)),
)
const resolver = new PlaceholderAssetResolver(cachingResolver)

export const assetRefFor = (object: SceneObject): AssetRef => ({ assetId: object.assetId, kind: object.assetKind })

export type AssetResolutionListener = (descriptor: AssetDescriptor) => void

/**
 * Per-object descriptor cache plus subscriber list. A React component calls
 * `resolveAsset` on selection and re-renders from the listener callback; the
 * viewport reads `getAssetStatus` every frame to decide what's pickable.
 */
const descriptors = new Map<string, AssetDescriptor>()
const listeners = new Map<string, Set<AssetResolutionListener>>()

const notify = (objectId: string, descriptor: AssetDescriptor) => {
  descriptors.set(objectId, descriptor)
  listeners.get(objectId)?.forEach((listener) => listener(descriptor))
}

export const getAssetDescriptor = (objectId: string): AssetDescriptor | undefined => descriptors.get(objectId)

export const getAssetStatus = (objectId: string): AssetDescriptor['status'] | undefined => descriptors.get(objectId)?.status

export const subscribeAssetResolution = (objectId: string, listener: AssetResolutionListener): (() => void) => {
  const set = listeners.get(objectId) ?? new Set()
  set.add(listener)
  listeners.set(objectId, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(objectId)
  }
}

export const resolveAsset = async (object: SceneObject): Promise<AssetDescriptor> => {
  const ref = assetRefFor(object)
  notify(object.id, { ref, status: 'loading' })
  const descriptor = await resolver.resolve(ref)
  notify(object.id, descriptor)
  return descriptor
}

export const retryAsset = (object: SceneObject): Promise<AssetDescriptor> => {
  cachingResolver.invalidate(assetRefFor(object))
  return resolveAsset(object)
}

export { isPlaceholderDescriptor }
export type { AssetDescriptor }
