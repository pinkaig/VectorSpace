# Asset Manager

**Baseline phase:** Stage 4a (build) + Stage 6 (wire into frontend). See [8-stage baseline overview](../FOUNDATION--baseline-phases.md).

**See also:** [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) for which attachment types (image, text, video, audio, 3D) can be loaded today and what is proposed, [`attachment-integration.md`](attachment-integration.md) for the proposed resolver chain, asset kinds and attachment model, [`media-policy-and-cloud-download.md`](CURRENT--media-policy-and-cloud-download.md) for the per-kind content-type allowlist, size caps and the mechanisms that control cloud download of large assets, and the type designs [`audio-system.md`](audio-system.md), [`image-system.md`](image-system.md), [`text-system.md`](text-system.md) and [`video-system.md`](video-system.md).

## Purpose

Give every part of the app — editor, runtime, and (once it exists) the backend — one way to
turn an `AssetRef` into a usable, loadable thing, regardless of whether that thing is a
hardcoded primitive, a local dev-time GLB, or (eventually) signed-URL media from the backend.
Callers never branch on where an asset lives; only the `AssetResolver` instance they're handed
changes.

## Boundary

```text
SceneObject.assetId / assetKind
          |
          | AssetRef { assetId, kind }
          v
packages/assets
  AssetResolver.resolve(ref) -> Promise<AssetDescriptor>
    PrimitiveResolver | LocalCatalogResolver | RemoteMediaResolver
          |
          | wrapped by
          v
  CachingAssetResolver (TTL cache)  ->  PlaceholderAssetResolver (never a silent blank)
          |
          v
  AssetDescriptor { status: idle|loading|ready|error, contentType?, url?, blob?, errorMessage? }
```

Stage 4a built the resolver vehicle in `packages/assets`. Stage 6 wired it into the live
editor: [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts) composes
the resolver chain the app actually uses and is the only place that consumes an
`AssetDescriptor` today. See
[`2026-09-17--PLAN--infrastructure-skeleton-extended.md`](../../archive/research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md)
for the staged plan and
[`2026-09-17--NOTE--stage6-primitive-resolver-always-succeeds.md`](../../archive/research-and-history/2026-09-17--NOTE--stage6-primitive-resolver-always-succeeds.md)
for a design gap this wiring surfaced and fixed.

## Where to find things

| Concern | Current owner |
|---|---|
| Asset identity (what to resolve) | [`packages/assets/src/AssetRef.ts`](../../packages/assets/src/AssetRef.ts) |
| Resolved form (loading state, URL/blob, content type) | [`packages/assets/src/AssetDescriptor.ts`](../../packages/assets/src/AssetDescriptor.ts) |
| The pluggable contract every origin implements | [`packages/assets/src/AssetResolver.ts`](../../packages/assets/src/AssetResolver.ts) |
| Hardcoded cube/sphere/cylinder | [`packages/assets/src/resolvers/PrimitiveResolver.ts`](../../packages/assets/src/resolvers/PrimitiveResolver.ts) |
| Dev-time GLB catalog (caller-supplied map) | [`packages/assets/src/resolvers/LocalCatalogResolver.ts`](../../packages/assets/src/resolvers/LocalCatalogResolver.ts) |
| Backend media (skeleton — always resolves to an error descriptor today) | [`packages/assets/src/resolvers/RemoteMediaResolver.ts`](../../packages/assets/src/resolvers/RemoteMediaResolver.ts) |
| In-memory cache, TTL tied to `expiresAt` | [`packages/assets/src/AssetCache.ts`](../../packages/assets/src/AssetCache.ts) |
| Cache-then-resolve wrapper (composable `AssetResolver`) | [`packages/assets/src/CachingAssetResolver.ts`](../../packages/assets/src/CachingAssetResolver.ts) |
| Failure-to-visible-placeholder wrapper, with retry | [`packages/assets/src/PlaceholderAssetResolver.ts`](../../packages/assets/src/PlaceholderAssetResolver.ts) |
| The canonical `AssetKind` union `SceneObject` uses | [`packages/project/src/index.ts`](../../packages/project/src/index.ts) |
| App-level resolver composition + resolution status store | [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts) |
| Selection-triggered resolution, per-frame unpickable-id tracking | [`src/Viewport.tsx`](../../src/Viewport.tsx) |
| Raycasting skip for loading/error objects | [`src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts) |
| Loading/error viewport badge with retry | [`src/viewport/AssetStatusBadge.tsx`](../../src/viewport/AssetStatusBadge.tsx) |

### Resolver contract

Every resolver implements exactly one method:

```ts
export interface AssetResolver {
  resolve(ref: AssetRef): Promise<AssetDescriptor>
}
```

`resolve()` must never reject. A failed lookup returns an `error` descriptor
(`errorAssetDescriptor`), not a thrown exception — `RemoteMediaResolver`'s
not-implemented body follows this rule so calling code has one failure shape to handle, not
two. `packages/assets/src/resolverContract.test.ts` runs the same calling function
(`loadAsset(resolver, ref)`) against all three resolvers and against a local-catalog ->
primitive swap, which is the direct test for the "swapping origin requires no caller changes"
acceptance criterion.

### Caching

`AssetCache` keys on `kind:assetId` and only caches `ready` descriptors — `loading` and
`error` are never cached, so a failed or in-flight resolve is retried on the next call instead
of getting stuck. A cached descriptor with `expiresAt` set is evicted once that time passes
(meant for signed URLs, which go stale); one with no `expiresAt` is cached indefinitely
(primitives, static local-catalog entries). `CachingAssetResolver` wraps any `AssetResolver`
and is itself an `AssetResolver`, so a caller can drop it in front of any origin without
changing call sites.

### App-level routing policy (Stage 6)

`PrimitiveResolver` matches on `ref.kind` alone, and every `AssetKind` value is currently a
primitive kind — so handing it straight to `CachingAssetResolver` would resolve every legal
`SceneObject` as `ready` regardless of `assetId`, making a broken assetId unobservable.
`src/viewport/assetResolution.ts` adds a small `FallbackResolver` in front of the shared
package resolvers: only an `assetId` matching the canonical `primitive-${kind}` shape (the id
`makeObject` assigns on creation) routes to `PrimitiveResolver`; anything else — including a
user-edited or deliberately broken id — falls through to `LocalCatalogResolver`. This routing
decision lives at the call site, not inside either resolver, since neither resolver alone knows
which ids are supposed to look like primitives. Full trace:
[`2026-09-17--NOTE--stage6-primitive-resolver-always-succeeds.md`](../../archive/research-and-history/2026-09-17--NOTE--stage6-primitive-resolver-always-succeeds.md).

### Placeholder / retry

`PlaceholderAssetResolver` wraps a resolver so that both a rejected promise and an
`error`-status descriptor come out the same way: an `error` descriptor with
`isPlaceholder: true` (checked via `isPlaceholderDescriptor`). This exists so UI can always
render *something* — a visible placeholder with a retry affordance — and never a blank where
an asset should be. `retry()` re-resolves through the same wrapper.

## Usage

`packages/assets` has a single entry point (`package.json`'s `"exports"` is `./src/index.ts`, so
subpath imports do not resolve — everything a caller needs is re-exported from
`packages/assets/src/index.ts`):

```ts
import {
  AssetCache,
  CachingAssetResolver,
  LocalCatalogResolver,
  PlaceholderAssetResolver,
  PrimitiveResolver,
  RemoteMediaResolver,
  isPlaceholderDescriptor,
  type AssetDescriptor,
  type AssetRef,
  type AssetResolver,
} from '@vthere/assets'
// `src/viewport/assetResolution.ts` currently imports the same symbols via a relative
// path (`../../packages/assets/src/index`) rather than the `@vthere/assets` workspace
// alias — both resolve to the same file; the alias is what `packages/assets/package.json`
// declares as this package's name.

const localCatalog = new Map<string, { url: string; contentType?: string }>()

const resolver = new PlaceholderAssetResolver(
  new CachingAssetResolver(
    new LocalCatalogResolver(localCatalog), // or PrimitiveResolver(), or RemoteMediaResolver(...)
  ),
)

const descriptor: AssetDescriptor = await resolver.resolve({ assetId: 'primitive-cube', kind: 'cube' })
if (descriptor.status === 'ready') {
  // descriptor.url / descriptor.contentType / descriptor.blob
} else if (isPlaceholderDescriptor(descriptor)) {
  // descriptor.errorMessage — safe to show; retry() re-resolves through the same wrapper
}
```

This is exactly the shape `src/viewport/assetResolution.ts` builds (with an extra
app-specific `FallbackResolver` in front, see "App-level routing policy" above). A caller in
the editor or runtime does not construct a resolver chain directly — it goes through that
module's small store instead:

```ts
import {
  getAssetDescriptor,
  resolveAsset,
  retryAsset,
  subscribeAssetResolution,
} from '../viewport/assetResolution' // from src/

// Kick off resolution for a SceneObject (id + assetId + assetKind):
void resolveAsset(sceneObject)

// Read the last known status without subscribing:
const current = getAssetDescriptor(sceneObject.id)

// Subscribe to status changes (e.g. from a React effect); returns an unsubscribe fn:
const unsubscribe = subscribeAssetResolution(sceneObject.id, (descriptor) => {
  // update UI, e.g. AssetStatusBadge
})

// Manual retry (e.g. a "retry" button), invalidates the cache entry first:
void retryAsset(sceneObject)
```

## Owns

- The `AssetRef` / `AssetDescriptor` / `AssetResolver` contract
- Resolution for the three defined origins: primitive, local catalog, remote media (skeleton)
- In-memory caching and cache invalidation policy (TTL tied to descriptor `expiresAt`)
- Turning any resolution failure into a visible, retryable placeholder state

## Does not own

- Asset *import* or *upload* — there is no ingestion path in this package yet (see Limits)
- Rendering a resolved descriptor as an actual visual change (mesh swap, `<img>`/`<audio>`/
  `<video>` elements, texture loading) — Stage 6 wired resolution and status *observability*
  (badges, pickability) into the editor, but `syncArtefacts.ts` still renders geometry purely
  from `assetKind`; a `ready` descriptor with a real GLB `url` does not yet change what's drawn
- The backend media API, presigned URLs, or object storage — that is Stage 3
  (`apps/api/app/storage.py`, `/projects/{id}/media`); `RemoteMediaResolver` only reserves the
  call shape
- Licensing/attribution/inventory metadata for approved assets — that is
  [`asset-library-contract.md`](CURRENT--asset-library-contract.md), a separate
  approval artifact this package does not enforce
- Persisted disk/browser cache — `AssetCache` is process-memory only and does not survive a
  reload (see Limits)

## Considerations and limits

**Only 3D primitive kinds exist today.** `AssetKind` (in `packages/project/src/index.ts`) is
currently `'cube' | 'sphere' | 'cylinder'`. `PrimitiveResolver` explicitly rejects any other
kind. `LocalCatalogResolver` and `RemoteMediaResolver` are already content-agnostic — they
resolve an `assetId` to a URL/contentType/blob regardless of what it actually is — but nothing
upstream can *express* a text/image/audio/video asset yet, since `SceneObject.assetKind` has
no such value. Extending `AssetKind` to cover those kinds ripples into `packages/project` and
every place that switches on it (e.g. `makeObject`'s `restingHeight` table), and is not yet
scoped to a stage.

**There is no import/upload path.** This package resolves assets that already have an
`assetId`; it does not accept a file, generate an `assetId`, or write anything to storage.
Real "importing" media happens once Stage 3's backend media endpoints exist and
`RemoteMediaResolver` has a real body — today it always returns an `error` descriptor
containing "not implemented". `LocalCatalogResolver` is dev-only: its catalog is a map the
caller constructs by hand (or from a fixed dev-assets folder), not a runtime import flow.

**Resolution status is observable, but a `ready` descriptor still doesn't change what renders.**
Stage 6 made loading/ready/error visible (viewport badge) and load-state-aware (raycasting
skips loading/error objects), but `syncArtefacts.ts` builds geometry purely from
`SceneObject.assetKind`, never from a resolved `AssetDescriptor.url`/`blob`. Turning a `ready`
non-primitive descriptor into an actual Three.js mesh, an `<img>`, an `<audio>`/`<video>`
element, or a text render is still unbuilt. Different content types will likely need different
renderer-side handling even though they share one resolver contract.

**Every `AssetKind` is currently a primitive kind.** `PrimitiveResolver` only checks `kind`,
so without the app-level routing policy above, no assetId could ever fail. If `AssetKind` grows
a non-primitive case, whoever wires its resolver needs to extend that routing policy
deliberately — matching on `kind` alone is not the same as validating `assetId`.

**Cache is in-memory only, per process.** `AssetCache` has no persistence layer — a page
reload starts cold, and multiple tabs/windows do not share a cache. This is deliberate for
Stage 4a (infrastructure vehicle only) but means repeated large-media fetches across reloads
are not yet mitigated.

**No concurrent-request de-duplication.** If the same `AssetRef` is resolved twice before the
first call resolves, `CachingAssetResolver` currently issues two delegate calls (the cache is
only checked/populated after each call completes) rather than sharing one in-flight promise.
Not a correctness bug — both calls converge on the same result — but a potential efficiency
gap for a resolver that hits the network, worth revisiting once `RemoteMediaResolver` is real.

**Signed-URL expiry is caller-supplied, not derived.** `AssetCache` evicts based on
`AssetDescriptor.expiresAt`, but nothing in this package sets that field from an actual
signed-URL TTL yet — `RemoteMediaResolver` will need to populate it from the backend's
response once Stage 3 lands.

**`PlaceholderAssetResolver` does not itself retry automatically or back off.** `retry()` is a
manual re-resolve triggered by a caller (e.g. a UI "retry" button); there is no built-in
polling, exponential backoff, or retry limit. Runaway retry loops are a UI-layer
responsibility, not something this package guards against.

## Build sequence

### Stage 4a: resolver vehicle (this stage)

- Define `AssetRef`, `AssetDescriptor`, `AssetResolver`.
- Implement `PrimitiveResolver`, `LocalCatalogResolver`, `RemoteMediaResolver` (skeleton body).
- Implement `AssetCache` and `CachingAssetResolver`.
- Implement `PlaceholderAssetResolver` for visible-failure handling.
- Acceptance: `npm run test -- packages/assets` passes; one resolver interface serves all
  three sources; swapping origin requires no caller changes — verified directly by
  `resolverContract.test.ts`.

### Stage 6 (done): wired into the frontend

- `SceneObject.assetId` / `assetKind` resolved through this package on selection, via
  `src/viewport/assetResolution.ts`.
- Viewport raycasting skips objects whose asset is loading or errored
  (`interactionController.ts::pick`).
- Gizmo picking confirmed unaffected — gizmo handles are separate Three.js objects, not
  asset-resolved `SceneObject`s.
- A loading/error status is visible via `AssetStatusBadge.tsx`, with a manual retry.
- The Inspector's Asset ID field is editable, so a broken assetId can be exercised on a real
  object end-to-end.
- Acceptance verified: `npm run test`, `npm run typecheck`, `npm run build` pass; a
  deliberately broken assetId shows the placeholder/retry state and becomes unpickable.
- Not yet scoped: renderer-side handling per content type (see Limits), and whether/how
  `AssetKind` grows beyond the three current primitives.

### Stage 3 (backend infra done; media integration still pending): real remote media

- `apps/api/app/storage.py` (boto3 presigned URLs against MinIO) and the `/projects/{id}/media`
  routes exist and are real, but per the Stage 3 skeleton boundary the media routes'
  handler bodies raise 501 and are not called by anything in this package yet — see
  [`2026-09-17--NOTE--stage3-auth-dependency-ordering.md`](../../archive/research-and-history/2026-09-17--NOTE--stage3-auth-dependency-ordering.md).
- `RemoteMediaResolver.resolve()` still always returns an `error` descriptor; it needs a real
  body once the media routes are implemented, and its `expiresAt` should come from the
  presigned URL's actual TTL.
- Acceptance carries over from the plan doc: swapping `RemoteMediaResolver` in for
  `LocalCatalogResolver` requires no change to any calling code, per the same contract test
  pattern used in Stage 4a.
