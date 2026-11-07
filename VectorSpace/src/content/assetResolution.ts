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
  PackAssetResolver,
  PackDirectory,
  PlaceholderAssetResolver,
  PrimitiveResolver,
  isPlaceholderDescriptor,
  type AssetDescriptor,
  type AssetRef,
  type PackDirectoryEntry,
  type PackOutcome,
} from '../../packages/assets/src/index'
import { ApiError, apiFetch, apiUrl } from '../api/client'
import { assetRefForAttachment, type Attachment, type SceneObject, type TextAssetMeta } from '../project/model'

// The dev/local GLB catalog: built-in models (assets.ts) and models imported through
// the UI (userAssets.ts) register here via registerLocalAsset. An assetId that was
// never registered still fails as a genuine, visible error.
const localCatalog = new Map<string, { url: string; contentType?: string; sizeBytes?: number }>()

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
/**
 * Cloud pack assets. A scene keeps only "pack:<slug>:<asset id>"; the address is the server's to
 * give (POST /packs/resolve, open to visitors who have no token because the files are public-read).
 * The directory batches, dedupes and retries those asks, and says "removed" apart from "could not
 * reach the server". The catalog leg below consults it for any pack id the local catalogue lacks.
 */
type ResolveAnswer = {
  assets: Array<{ id: string; url: string; content_type: string; size_bytes: number; title: string; attribution: string | null }>
  missing: string[]
}

const noToken = async (): Promise<string | null> => null

// Only a 5xx, a timeout or a rate limit is worth another try; any other 4xx will answer the same again.
const worthRetrying = (error: unknown): boolean => {
  if (!apiUrl) return false
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429
}

export const packDirectory = new PackDirectory({
  fetchBatch: async (ids) => {
    const answer = await apiFetch<ResolveAnswer>(noToken, '/packs/resolve', { method: 'POST', body: { ids } })
    return {
      found: answer.assets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        contentType: asset.content_type,
        sizeBytes: asset.size_bytes,
        title: asset.title,
        attribution: asset.attribution,
      })),
      missing: answer.missing,
    }
  },
  isTransient: worthRetrying,
})

const catalogListeners = new Set<() => void>()
const notifyCatalogChanged = () => catalogListeners.forEach((listener) => listener())

/** Told whenever the catalogue gains an address, so a viewer that skipped an object can redraw it. */
export const subscribeCatalogChanges = (listener: () => void): (() => void) => {
  catalogListeners.add(listener)
  return () => { catalogListeners.delete(listener) }
}

const registerPackEntry = (entry: PackDirectoryEntry): void => {
  if (localCatalog.get(entry.id)?.url === entry.url) return
  localCatalog.set(entry.id, { url: entry.url, contentType: entry.contentType, sizeBytes: entry.sizeBytes })
  notifyCatalogChanged()
}

const cachingResolver = new CachingAssetResolver(
  new ContentGuardResolver(
    new KindRouterResolver({
      primitives: new PrimitiveResolver(),
      inlineText: new InlineTextResolver((assetId) => textAssetsById.get(assetId)),
      catalog: new PackAssetResolver(new LocalCatalogResolver(localCatalog), packDirectory, registerPackEntry),
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
  notifyCatalogChanged()
  descriptors.forEach((descriptor, key) => {
    if (descriptor.status === 'error' && descriptor.ref.assetId === assetId) {
      cachingResolver.invalidate(descriptor.ref)
      void resolveRef(key, descriptor.ref)
    }
  })
}

export const resolveLocalAssetUrl = (assetId: string): string | undefined => localCatalog.get(assetId)?.url

/**
 * Ask the server for these pack assets and register every address it gives, so the viewport's
 * synchronous lookup (resolveLocalAssetUrl) can answer. Never rejects: each id gets an outcome.
 * Ids the catalogue already holds (the palette read their manifest) are not asked for again.
 */
export const ensurePackAssets = async (assetIds: readonly string[]): Promise<Map<string, PackOutcome>> => {
  const outcomes = new Map<string, PackOutcome>()
  const unknown: string[] = []
  assetIds.forEach((id) => {
    const url = localCatalog.get(id)?.url
    if (url) outcomes.set(id, { status: 'found', entry: { id, url, contentType: localCatalog.get(id)?.contentType ?? 'model/gltf-binary' } })
    else unknown.push(id)
  })
  const asked = await packDirectory.need(unknown)
  asked.forEach((outcome, id) => {
    if (outcome.status === 'found') registerPackEntry(outcome.entry)
    outcomes.set(id, outcome)
  })
  return outcomes
}

/** Forget what was learned about a pack asset (a "gone" or a failed look-up) so the next ask is real. */
export const forgetPackAsset = (assetId: string): void => {
  packDirectory.forget(assetId)
  cachingResolver.invalidate({ assetId, kind: 'model' })
}

export const unregisterLocalAsset = (assetId: string): void => {
  localCatalog.delete(assetId)
  cachingResolver.invalidate({ assetId, kind: 'model' })
}

export const retryAsset = (object: SceneObject): Promise<AssetDescriptor> => {
  cachingResolver.invalidate(assetRefFor(object))
  return resolveAsset(object)
}

/**
 * Every descriptor the chain has cached, for the asset inventory. This is the
 * manager's own record of what it has resolved, and unlike the descriptor store
 * above it is keyed by asset rather than by placement — twenty objects from one
 * GLB are one entry here and twenty there.
 */
export const listCachedDescriptors = (): AssetDescriptor[] => cachingResolver.listCached()

/** Every assetId the local catalog can resolve: bundled models plus UI imports. */
export const listLocalCatalog = (): Array<{ assetId: string; url: string; contentType?: string }> =>
  [...localCatalog.entries()].map(([assetId, entry]) => ({ assetId, ...entry }))

export { isPlaceholderDescriptor }
export type { AssetDescriptor }
