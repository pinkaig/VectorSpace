# Asset Manager — the unified asset reference vehicle

**Status:** Planned, not yet implemented. No blockers — can start immediately.
**Origin:** Extracted from `2026-09-17--PLAN--infrastructure-skeleton-extended.md` (Stage 4a)
into its own file per the 2026-09-17 frontend-business-logic-backlog split, so this feature has
one full, self-contained spec instead of a shared subsection.

**Baseline phase:** Stage 4a (Asset Manager). See [8-stage baseline overview](../../code/baseline-phases.md).
**Tracking:** row 5 in `2026-09-17--PLAN--frontend-business-logic-backlog.md`.
**Subsystem index entry:** `docs/05-subsystems/asset-manager.md` (stub, links back here).

## What it is

A pluggable resolver system so any part of the architecture (editor, runtime, backend) can
reference an asset the same way, independent of where that asset actually lives (hardcoded
primitive, local dev catalog, or remote signed-URL media). This is the **vehicle**, not the
asset catalog — it does not decide which assets exist, only how any part of the app resolves
an `AssetRef` into something renderable.

## Why this is infrastructure, not domain logic

`SceneObject.assetId` is already a plain string today (`src/model.ts`), resolved ad hoc per
caller. Without a shared resolver, every future asset source (S3, a CDN, a different catalog
format) means touching every call site that currently assumes a hardcoded primitive. The
resolver interface is the seam that keeps that a one-place change.

## [REAL] infrastructure — build this now, no domain decisions required

- `packages/assets/src/AssetRef.ts` — opaque reference type: `{ assetId: string, kind: AssetKind }`.
- `packages/assets/src/AssetDescriptor.ts` — resolved form: metadata, content-type, URL/blob,
  loading state (`'idle' | 'loading' | 'ready' | 'error'`).
- `packages/assets/src/AssetResolver.ts` — the pluggable interface:
  ```ts
  interface AssetResolver {
    resolve(ref: AssetRef): Promise<AssetDescriptor>
  }
  ```
- Three concrete resolvers:
  - `PrimitiveResolver` — hardcoded cube/sphere/cylinder, mirrors the current `AssetKind` set
    in `packages/project/src/index.ts`.
  - `LocalCatalogResolver` — dev-time GLB catalog, satisfies the existing
    `docs/05-subsystems/UNDATED--CURRENT--asset-library-contract.md` contract.
  - `RemoteMediaResolver` — calls the backend `/projects/{id}/media` endpoint + signed URLs.
    Stays a skeleton (throws or returns a not-implemented descriptor) until Stage 3's
    `MediaRepository` exists on the backend; the interface and call shape are still real.
- Cache management: in-memory cache keyed by `assetId`, TTL tied to signed-URL expiry (so a
  cached `RemoteMediaResolver` entry doesn't outlive its own signed URL).
- Degraded state handling: a missing or failed asset renders a visible placeholder with a
  retry affordance — never a silent blank mesh or a thrown error that breaks the viewport.

## [SKELETON] domain logic — deferred

- Which specific assets are in the approved catalog (that's `src/assets.ts`'s existing job,
  already implemented — this vehicle wraps it, doesn't replace it).
- Remote media upload/conversion pipeline (Stage 3 backend concern).

## Integration points

- `SceneObject.assetId` stays a plain string; `SceneObject.assetKind` selects which resolver
  handles it.
- `Component.assetId` (media attachments, once they exist) uses the same resolver for
  consistency — one resolution path for the whole app.
- Viewport raycasting (`src/viewport/interactionController.ts` `pick()`) can filter by asset
  status so a `loading`/`error` object doesn't intercept clicks meant for what's behind it.
- Both the editor (`src/App.tsx`/`Viewport.tsx`) and any future runtime call the same
  resolver — no duplicated resolution logic between editor and runtime.

## Files to create

```
packages/assets/
  package.json          ("exports": "./src/index.ts", matching authoring-engine's pattern)
  src/
    index.ts             (re-exports everything — same single-entry-point constraint)
    AssetRef.ts
    AssetDescriptor.ts
    AssetResolver.ts
    resolvers/
      PrimitiveResolver.ts
      LocalCatalogResolver.ts
      RemoteMediaResolver.ts
    cache.ts
    AssetRef.test.ts / AssetResolver.test.ts / resolvers/*.test.ts
```

## Acceptance criteria

- One resolver interface serves multiple asset origins; swapping origin (local → S3) requires
  no caller changes — verified by a test that swaps the resolver implementation behind the
  same call site and asserts callers are unaffected.
- `npm run test -- packages/assets` passes.
- Cache invalidation is tested: a TTL-expired entry is not returned stale.
- Placeholder rendering is tested: a `resolve()` rejection produces an `error`-state
  descriptor, not a thrown exception the caller must catch ad hoc.

## Suggested model/effort tier

Sonnet 5, direct mode — mechanical package scaffolding with a clear interface contract,
no shared-history or undo semantics involved.
