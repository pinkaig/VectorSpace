# Asset Manager

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

Stage 4a (current) builds the resolver vehicle only. Nothing in the viewport or runtime
consumes an `AssetDescriptor` yet — that wiring is Stage 6 in
[`2026-09-17--PLAN--infrastructure-skeleton-extended.md`](../07-research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md).

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

### Placeholder / retry

`PlaceholderAssetResolver` wraps a resolver so that both a rejected promise and an
`error`-status descriptor come out the same way: an `error` descriptor with
`isPlaceholder: true` (checked via `isPlaceholderDescriptor`). This exists so UI can always
render *something* — a visible placeholder with a retry affordance — and never a blank where
an asset should be. `retry()` re-resolves through the same wrapper.

## Owns

- The `AssetRef` / `AssetDescriptor` / `AssetResolver` contract
- Resolution for the three defined origins: primitive, local catalog, remote media (skeleton)
- In-memory caching and cache invalidation policy (TTL tied to descriptor `expiresAt`)
- Turning any resolution failure into a visible, retryable placeholder state

## Does not own

- Asset *import* or *upload* — there is no ingestion path in this package yet (see Limits)
- Rendering a resolved descriptor (mesh creation, `<img>`/`<audio>`/`<video>` elements,
  texture loading) — that is Stage 6, wiring the Asset Manager into the viewport/runtime
- The backend media API, presigned URLs, or object storage — that is Stage 3
  (`apps/api/app/storage.py`, `/projects/{id}/media`); `RemoteMediaResolver` only reserves the
  call shape
- Licensing/attribution/inventory metadata for approved assets — that is
  [`asset-library-contract.md`](UNDATED--CURRENT--asset-library-contract.md), a separate
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

**No renderer integration.** Resolving a descriptor to `status: 'ready'` with a `url` or
`blob` is as far as this package goes. Turning that into a Three.js mesh, an `<img>`, an
`<audio>`/`<video>` element, or a text render is unbuilt and belongs to Stage 6 per the plan
doc. Different content types will likely need different renderer-side handling even though
they share one resolver contract.

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

### Stage 6 (planned): wire into frontend

- `SceneObject.assetId` / `assetKind` resolved through this package in the viewport.
- Viewport raycasting filters by asset status (skip loading/failed).
- Gizmo picking accounts for asset load state.
- Not yet scoped: renderer-side handling per content type, and whether/how `AssetKind` grows
  beyond the three current primitives.

### Stage 3 (planned, backend): real remote media

- `apps/api/app/storage.py` (boto3 presigned URLs) and `/projects/{id}/media` routes land.
- `RemoteMediaResolver.resolve()` gets a real body; its `expiresAt` should come from the
  presigned URL's actual TTL.
- Acceptance carries over from the plan doc: swapping `RemoteMediaResolver` in for
  `LocalCatalogResolver` requires no change to any calling code, per the same contract test
  pattern used in Stage 4a.
