# Asset Library Contract

**Status:** Outstanding approval artifact

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

## Implementation status

Nothing in this file is built yet. There is no curated 20–30 asset inventory, no thumbnail or
licensing registry, and no import/upload path anywhere in the app. What exists today in
`packages/assets/src` (see [`asset-manager.md`](CURRENT--asset-manager.md)) is the resolver
*infrastructure* this contract's assets would eventually flow through, not the contract itself:

- [`resolvers/LocalCatalogResolver.ts`](../../packages/assets/src/resolvers/LocalCatalogResolver.ts)
  looks an `assetId` up in a caller-supplied `Map<string, { url, contentType? }>` — today that map
  is empty (`src/viewport/assetResolution.ts`'s `localCatalog`), so every non-primitive `assetId`
  deliberately resolves to an error/placeholder state. This is the closest thing to a "local
  catalog" today, and it carries none of the fields below (`category`, `license`, `attribution`,
  `pivot`, etc.) — it is `{ url, contentType }` only.
- [`resolvers/RemoteMediaResolver.ts`](../../packages/assets/src/resolvers/RemoteMediaResolver.ts)
  is a skeleton that always returns an error descriptor; it is where signed-URL-backed inventory
  would eventually resolve through, once Stage 3's media endpoints are real.
- `AssetKind` (in [`packages/project/src/index.ts`](../../packages/project/src/index.ts)) is
  currently only `'cube' | 'sphere' | 'cylinder'` — there is no `environment | exhibit | media`
  kind distinction yet, so `SceneObject` cannot express most of the inventory shape below.

There is no asset-browser UI, no approval workflow, and no inventory file (JSON/CSV/database) in
the repo implementing the `Required inventory fields` table. Everything below remains a
requirements/approval artifact for future work, not a description of shipped code.

## MVP rules

- Use supplied or openly licensed assets only.
- Use GLB/glTF throughout the MVP; OBJ, FBX, and conversion pipelines are out of scope.
- Supply two to four approved 3D environments.
- Supply approximately 20–30 curated placeable assets with thumbnails, categories, stable IDs, and known scale/orientation/pivot conventions.
- Store large binaries in object storage; the project file stores stable asset IDs and metadata references.
- Asset loading must expose loading, progress, error, retry, and missing-asset states.

## Required inventory fields

```text
assetId
name
category
kind: environment | exhibit | media
sourceUrl
license
attribution
fileFormat: glb
fileSizeBytes
unitScale
upAxis
forwardAxis
pivot
thumbnailUrl
collisionOrInteractionProxy
approvedBy
```

## Acceptance checks

- Every asset has a licensing/attribution record before it enters the approved registry.
- Every asset loads in the target browser matrix and uses the documented scale and pivot.
- An environment can load with visible progress and a recoverable error state.
- Asset budgets are tested on the three-year-old school laptop scenario.
