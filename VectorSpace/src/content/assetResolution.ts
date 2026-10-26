/**
 * @file        assetResolution.ts
 * @brief       App-level Asset Manager wiring: one resolver chain, shared status cache.
 *
 * @responsibility
 * Builds the resolver chain — Placeholder(Caching(ContentGuard(KindRouter(
 * primitives | inline text | catalog)))) — and exposes a small store that
 * lets the viewport and interaction layer read/observe the resolution status
 * of any SceneObject by object id or any Attachment by attachment id, in one
 * prefixed key space so the two id spaces cannot collide.
 *
 * @ownership
 * Owns the resolver chain and an in-memory status-by-object-id cache. Does
 * not own SceneObject/ProjectData; a SceneObject's assetId is the only input.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 */
import {
  CachingAssetResolver,
  ContentGuardResolver,
  InlineTextResolver,
  KindRouterResolver,
  LocalCatalogResolver,
  PlaceholderAssetResolver,
  PrimitiveResolver,
  isPlaceholderDescriptor,
  type AssetDescriptor,
  type AssetRef,
} from '../../packages/assets/src/index'
import { assetRefForAttachment, type Attachment, type SceneObject, type TextAssetMeta } from '../project/model'

// The dev/local GLB catalog: built-in models (assets.ts) and models imported through
// the UI (userAssets.ts) register here via registerLocalAsset. An assetId that was
// never registered still fails as a genuine, visible error.
const localCatalog = new Map<string, { url: string; contentType?: string }>()

/**
 * RESERVED, not live. Text content is inline in ProjectData today, so
 * TextLibrary is the single source TextSystem.open reads and the app does NOT
 * feed text in here — one set of bytes with two homes is two things to keep in
 * sync, and this copy had no reader (see Viewport.tsx's text effect).
 *
 * The leg is kept wired because it is the seam a non-inline text origin needs:
 * a document drive or signed URL has loading and error states that a
 * synchronous Map cannot express but AssetDescriptor already does. Feeding
 * this map (and swapping InlineTextResolver for the remote resolver) is the
 * migration, not a rewrite.
 *
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Media-Policy-and-Cloud-Download
 * Links point at the project wiki; migration is still in progress.
 */
let textAssetsById = new Map<string, TextAssetMeta>()

export const setProjectTextAssets = (textAssets: readonly TextAssetMeta[] | undefined): void => {
  const next = new Map((textAssets ?? []).map((meta) => [meta.assetId, meta]))
  // a descriptor cached from the previous project state would serve stale
  // content after an edit, so every id that appeared or changed is dropped
  for (const assetId of new Set([...textAssetsById.keys(), ...next.keys()])) {
    cachingResolver.invalidate({ assetId, kind: 'text' })
  }
  textAssetsById = next
}

/**
 * KindRouterResolver keeps the old FallbackResolver rule: every AssetKind is
 * also a primitive kind, so only the canonical `primitive-<kind>` assetId is
 * treated as a primitive and a broken id still fails as a visible error via
 * the catalog. The guard turns a wrong content type or over-cap size on any
 * media kind into an error descriptor before it is cached.
 */
const cachingResolver = new CachingAssetResolver(
  new ContentGuardResolver(
    new KindRouterResolver({
      primitives: new PrimitiveResolver(),
      inlineText: new InlineTextResolver((assetId) => textAssetsById.get(assetId)),
      catalog: new LocalCatalogResolver(localCatalog),
    }),
  ),
)
const resolver = new PlaceholderAssetResolver(cachingResolver)

export const assetRefFor = (object: SceneObject): AssetRef => ({ assetId: object.assetId, kind: object.assetKind })

export type AssetResolutionListener = (descriptor: AssetDescriptor) => void

/**
 * Per-id descriptor cache plus subscriber list. A React component calls
 * `resolveAsset`/`resolveAttachment` and re-renders from the listener
 * callback; the viewport reads `getAssetStatus` every frame to decide what's
 * pickable. One store serves both id spaces: keys are prefixed so an object
 * id and an attachment id can never collide.
 */
const descriptors = new Map<string, AssetDescriptor>()
const listeners = new Map<string, Set<AssetResolutionListener>>()

const keyForObject = (objectId: string) => `object:${objectId}`
const keyForAttachment = (attachmentId: string) => `attachment:${attachmentId}`

const notify = (key: string, descriptor: AssetDescriptor) => {
  descriptors.set(key, descriptor)
  listeners.get(key)?.forEach((listener) => listener(descriptor))
}

const subscribeKey = (key: string, listener: AssetResolutionListener): (() => void) => {
  const set = listeners.get(key) ?? new Set()
  set.add(listener)
  listeners.set(key, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(key)
  }
}

export const getAssetDescriptor = (objectId: string): AssetDescriptor | undefined => descriptors.get(keyForObject(objectId))

export const getAssetStatus = (objectId: string): AssetDescriptor['status'] | undefined => getAssetDescriptor(objectId)?.status

export const subscribeAssetResolution = (objectId: string, listener: AssetResolutionListener): (() => void) =>
  subscribeKey(keyForObject(objectId), listener)

export const getAttachmentDescriptor = (attachmentId: string): AssetDescriptor | undefined =>
  descriptors.get(keyForAttachment(attachmentId))

export const subscribeAttachmentResolution = (attachmentId: string, listener: AssetResolutionListener): (() => void) =>
  subscribeKey(keyForAttachment(attachmentId), listener)

const resolveRef = async (key: string, ref: AssetRef): Promise<AssetDescriptor> => {
  notify(key, { ref, status: 'loading' })
  const descriptor = await resolver.resolve(ref)
  notify(key, descriptor)
  return descriptor
}

export const resolveAsset = (object: SceneObject): Promise<AssetDescriptor> => resolveRef(keyForObject(object.id), assetRefFor(object))

export const resolveAttachment = (attachment: Attachment): Promise<AssetDescriptor> =>
  resolveRef(keyForAttachment(attachment.id), assetRefForAttachment(attachment))

export const retryAttachment = (attachment: Attachment): Promise<AssetDescriptor> => {
  cachingResolver.invalidate(assetRefForAttachment(attachment))
  return resolveAttachment(attachment)
}

/**
 * Adds (or replaces) a catalog entry. Imported assets load asynchronously, so an
 * object placed from one can already have failed to resolve by the time it is
 * registered (e.g. right after a page reload) — those are re-resolved here rather
 * than left stuck on "error" until the user notices and presses Retry.
 */
export const registerLocalAsset = (assetId: string, entry: { url: string; contentType?: string }): void => {
  localCatalog.set(assetId, entry)
  descriptors.forEach((descriptor, key) => {
    if (descriptor.status === 'error' && descriptor.ref.assetId === assetId) {
      cachingResolver.invalidate(descriptor.ref)
      void resolveRef(key, descriptor.ref)
    }
  })
}

export const resolveLocalAssetUrl = (assetId: string): string | undefined => localCatalog.get(assetId)?.url

export const unregisterLocalAsset = (assetId: string): void => {
  localCatalog.delete(assetId)
  cachingResolver.invalidate({ assetId, kind: 'model' })
}

export const retryAsset = (object: SceneObject): Promise<AssetDescriptor> => {
  cachingResolver.invalidate(assetRefFor(object))
  return resolveAsset(object)
}

export { isPlaceholderDescriptor }
export type { AssetDescriptor }
