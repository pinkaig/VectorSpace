# Image System

**Status:** Design specification (2026-09-21). Nothing in this doc is implemented yet. It becomes a description of built code as each build-sequence step lands.
**Baseline phase:** Post-baseline subsystem. Builds on the Asset Manager (Stage 4a/6) and the attachment model. See [8-stage baseline overview](../baseline-phases.md).
**Companions:** [`attachment-integration.md`](attachment-integration.md) defines the attachment, the host relationship and the resolver chain this system relies on. [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) is the status map. Sibling designs: [`audio-system.md`](audio-system.md), [`text-system.md`](text-system.md), [`video-system.md`](video-system.md).
**Architecture decision:** [`repository.md`](../architecture/UNDATED--FOUNDATION--repository.md) L67-69 treats a new canonical subsystem as an architectural change. This doc is the proposal for `packages/image`; the package is created only after approval.

## Purpose

Show pictures in a scene and in the UI: a framed photo on a wall, a decal on an object, a floating icon, a full-screen
lightbox, a thumbnail in the asset panel, and (later) a 360-degree background. It owns turning a resolved image asset
into something drawable, keeping decoded pixels within a memory budget, and reporting the state of every image so other
systems can ask.

Today there is nothing. `AssetKind` has no image value, no `TextureLoader`, `Image` or `createImageBitmap` exists in
the repo, and a placed object is always a coloured primitive (`syncArtefacts.ts:34-58`). The backend already accepts
`kind = 'image'` in `media_assets` (`apps/api/app/models.py:163`), but the media routes return 501.

## Boundary

```text
Rule engine: showImage / hideImage / toggleImage          Editor: inspector, asset panel, import
        |                                                        |
        v                                                        v
+---------------------------------------------------------------------------+
| packages/image  (pure TypeScript; no React, no Three.js)                   |
|                                                                           |
|  registerImageActions --> ImageSystem (facade)                             |
|                             |- ImageCache  (over shared DecodedCache)      |
|                             |     resolve -> fetch -> decode -> ImageBitmap|
|                             |- ImageLimits (size, pixels, dimension)       |
|                             |- ImageStateStore  -> subscribe / query       |
|                             '- ImageEventBridge -> rule triggers           |
|                                                                           |
|  ImageBackend (interface):  BrowserImageBackend | FakeImageBackend (tests)  |
+---------------------------------------------------------------------------+
        ^ AssetRef -> AssetDescriptor                | handle: bitmap + size + status
        | (packages/assets)                          v
   Asset Manager                    src/viewport/mediaSurfaces.ts (Three.js)
                                       TextureCache -> THREE.Texture -> quad on host
                                    src/ overlay layer (React): lightbox, thumbnails
```

`ImageBackend` wraps `fetch` and `createImageBitmap`, so tests run against a fake (jsdom has no image decode). The
package imports `@vthere/project` and `@vthere/assets` only. Turning a bitmap into a `THREE.Texture` and placing it on a
quad is Three.js work, so it lives in `src/viewport/`, not in the package
([`tech-stack.md`](../architecture/UNDATED--FOUNDATION--tech-stack.md) L155-158).

## Where to find things (planned)

| Concern | Planned owner |
|---|---|
| Facade and public API | `packages/image/src/ImageSystem.ts` |
| Backend interface, real and fake | `packages/image/src/backend/ImageBackend.ts`, `BrowserImageBackend.ts`, `FakeImageBackend.ts` |
| Decoded cache and budget | `packages/image/src/ImageCache.ts` over `packages/assets/src/DecodedCache.ts` |
| Limits and validation | `packages/image/src/ImageLimits.ts` |
| Layout maths (fit, aspect, UV) | `packages/image/src/layout.ts` (pure) |
| State store and queries | `packages/image/src/ImageStateStore.ts` |
| Action executors and event bridge | `packages/image/src/actions/` |
| Types shared with the project file | `packages/project/src/index.ts` |
| Texture cache and quad rendering | `src/viewport/mediaSurfaces.ts`, `src/viewport/textureCache.ts` |
| Asset resolution | `packages/assets/`, `src/viewport/assetResolution.ts` |
| Overlay: lightbox, thumbnails | `src/` (React) |

## Owns

- Fetching and decoding an image asset into an `ImageBitmap`, with orientation applied and size limits enforced
- The decoded-image cache: reference counts, LRU, byte budget, pinning, stats
- Layout maths: fit modes, aspect ratio, UV rectangles for atlas or crop
- The state store for image status and the events images raise
- Executors for the image actions
- Placeholder behaviour for a missing or failed image (in cooperation with `src/`, which draws it)

## Does not own

- Turning an `assetId` into a URL, signed URLs, upload and storage (Asset Manager, Stage 3)
- Creating `THREE.Texture`, materials or meshes (`src/viewport/`)
- Drawing the overlay or thumbnails (React)
- Evaluating rules (`packages/interaction`)
- Animated images (GIF, animated WebP): treated as video, see [`video-system.md`](video-system.md)
- Image editing, cropping tools and filters beyond fit and crop rectangle

## Concepts

| Term | Meaning |
|---|---|
| **Image asset** | A PNG, JPEG or WebP file identified by `assetId`, resolved by the Asset Manager to a URL and content type. |
| **Meta** (`ImageAssetMeta`) | Reusable settings for one asset on the project: alt text, dimensions, colour space, filtering, default fit. |
| **Attachment** (`ImageAttachment`) | A binding of an image to a host with a `presentation`. Defined in `attachment-integration.md`. |
| **Presentation** | How the image is shown: `surface` (a quad in the world), `billboard` (a quad that faces the viewer), `overlay` (screen space, DOM), `background` (a 360 sphere behind the scene). |
| **Handle** | A ref-counted lease on a decoded image. Acquire on show, release on hide; the cache may evict once the count is zero. |
| **Surface** | The Three.js quad and material that displays a handle. Lives in `src/`. |

## Functionality

### 1. Loading

1. The caller asks `image.acquire(attachment)`. The system builds an `AssetRef { assetId, kind: 'image' }` and resolves it through the injected `AssetResolver`.
2. It checks the descriptor: content type in the image allowlist, `sizeBytes` under the limit, `width` and `height` (if known) under the pixel cap. A failure here yields an `error` handle and no download.
3. It fetches the URL (or reads the `blob`), then decodes with `createImageBitmap(blob, { imageOrientation: 'from-image', resizeWidth, resizeHeight })`. Decode runs off the main thread.
4. The `ImageBitmap` is stored in the `DecodedCache` with its byte size (`width * height * 4`).
5. Concurrent acquires of one asset share one fetch and one decode (in-flight de-duplication).

Loading is lazy: nothing is fetched until an attachment is shown or preloaded. `preload(attachmentIds)` warms a scene's
visible surfaces on scene load; hidden and far-away images are left alone.

### 2. Memory and size limits

Images are the largest memory cost in the attachment set. A decoded RGBA bitmap costs `width * height * 4` bytes, and
the GPU copy plus mipmaps costs roughly a third more on top.

| Limit | Starting value | Behaviour |
|---|---|---|
| Max file size | 10 MB | Rejected at resolve (`ContentGuardResolver`) and at upload |
| Working max dimension | 2048 px on the long edge | Larger images are downscaled at decode (`resizeWidth` or `resizeHeight`, preserving aspect). 2048 x 2048 is 16 MB decoded. |
| Hard max dimension | 4096 px | Above this the image is rejected. 4096 x 4096 is 64 MB decoded, which would fill half the budget alone. |
| Max pixels | 16 million | Checked from meta or descriptor before decode where known |
| Decoded budget | 128 MB | Shared `DecodedCache` ceiling, LRU-evicting handles with zero references; playing or visible handles are pinned |

These are tuning numbers, not decisions; set them from a target device once one is chosen. The cache uses the real
decoded size after any downscale, not the file size.

**Decompression bombs.** A tiny file can decode to a huge bitmap. Where dimensions are unknown before decode, decode
with a capped `resizeWidth`. Where the backend has probed the file (Stage 3), trust its `width` and `height` for the
pre-check but still cap at decode.

**Overlay images.** A lightbox may request up to the hard max for detail; it acquires a separate, larger handle and
releases it when closed.

### 3. Presentation

| Mode | Where it renders | Notes |
|---|---|---|
| `surface` | A quad in the world, child of the host's mesh, at a host-local `offset`, `size` and rotation | Sized in world units. `fit` decides how the image sits in the quad: `contain`, `cover`, `stretch`. |
| `billboard` | A quad that always faces the viewer | For icons and labels. Rotation is applied per frame from the camera. |
| `overlay` | DOM (`<img>` or canvas) in the overlay layer | Screen space; not affected by the camera. For lightbox, HUD and thumbnails. |
| `background` (T2) | An inside-out sphere behind the scene | Equirectangular 360 image. The image counterpart of 360 audio. Needs a large budget; keep at 4096 x 2048 or below. |

```ts
export type ImageFit = 'contain' | 'cover' | 'stretch'
export interface ImagePresentation {
  mode: 'surface' | 'billboard' | 'overlay' | 'background'
  fit?: ImageFit
  size?: [number, number]            // world units for surface and billboard; omitted = derive from aspect
  offset?: [number, number, number]  // host-local, surface only
  rotation?: [number, number, number]
  doubleSided?: boolean
  opacity?: number                   // 0..1
  crop?: [number, number, number, number]   // u, v, w, h in 0..1: an atlas or crop rectangle (T2)
}
```

When `size` is omitted, one edge is fixed (default 1 world unit) and the other follows the image aspect, read from meta
or the decoded bitmap, so a photo is never stretched by accident.

### 4. Texture settings (the `src/` side)

| Setting | Default | Why |
|---|---|---|
| Colour space | sRGB | Photos and UI art are authored in sRGB; a wrong space looks washed out or too dark |
| Mipmaps | On for `surface`, off for `overlay` | Stops shimmer at distance; costs about a third more GPU memory |
| Anisotropy | Capped at a small value, not the device maximum | Sharp at grazing angles without the cost |
| Filtering | Linear, or nearest when meta says `pixelated` | Pixel art stays crisp |
| Alpha | Premultiplied when the source has alpha | Avoids dark fringes. Sets `transparent` on the material only when needed, since transparency changes draw order. |
| Wrapping | Clamp | No accidental tiling |

Textures are owned by `TextureCache` in `src/viewport/`, keyed by `assetId` and settings, ref-counted like the bitmaps.
`disposeObjectResources` (`syncArtefacts.ts:40-47`) disposes geometry and materials but **not** textures, which is what
lets a cached texture survive the full artefact rebuild on each sync. The cache, not the rebuild, calls
`texture.dispose()` when a handle's count reaches zero.

### 5. Placeholders and failure

An image that has not loaded shows a neutral placeholder at its intended size, so layout does not jump when it arrives.
A failed one shows a checkerboard "missing image" texture, and the editor offers retry (`PlaceholderAssetResolver`
already exposes `retry`). Failure never throws into the dispatcher: the handle goes to `error`, the store emits
`imageError`, and the surface draws the placeholder.

`T2`: a small blurred thumbnail loads first (from a backend-generated thumbnail or a downscaled decode) and is swapped
for the full image when ready.

### 6. Lifecycle

| Event | What happens |
|---|---|
| Show (`showImage`, or scene load for an always-on surface) | Acquire a handle; `src/` creates a texture and quad when the handle is ready; register `effects.add(release)` |
| Hide | Release the handle; the cache may evict; `src/` disposes the texture when its count is zero |
| Host removed or scene changes | `resetRuntime` calls `disposeAll()`; every released handle drops to zero references |
| Tab hidden | Nothing (images are static). Cache trimming may run on `visibilitychange` if the budget is over. |
| WebGL context lost | Textures are re-created from bitmaps still held in the cache; a bitmap is closed only on eviction, never on upload |
| Dispose | `ImageSystem.dispose()` closes every bitmap (`ImageBitmap.close()`), clears the cache and unsubscribes |

### 7. State store (`ImageStateStore`)

Same shape as the other type packages, so React uses `useSyncExternalStore`.

```ts
interface ImageSnapshot { images: ImageStatus[]; cache: { bytes: number; budget: number; entries: number } }
interface ImageStatus { attachmentId: string; assetId: string; state: 'idle'|'loading'|'ready'|'error';
                        width?: number; height?: number; errorMessage?: string; visible: boolean }
getSnapshot(): ImageSnapshot
subscribe(listener): () => void
getStatus(attachmentId): ImageStatus | undefined
isVisible(attachmentId): boolean
```

Events: `imageLoading`, `imageReady`, `imageError`, `imageShown`, `imageHidden`.

### 8. Events back into the rule engine

`imageShown` and `imageHidden` are forwarded to `emitRuntimeEvent` (`Viewport.tsx:287`) by `ImageEventBridge`, with the
same loop guard the audio bridge uses (rate limit, and no re-firing the same rule in one tick). This lets a rule say
"when the poster is shown, play the narration". Clicking a surface is an ordinary `objectClick` on the host (the quad
carries `userData.entityId` = host id, plus `userData.attachmentId`), so no new trigger is needed for basic click rules.

### 9. Authoring and editor use

Separate from runtime, and a later slice:

- **Asset panel thumbnails.** Decode at a small size (`resizeWidth: 128`) into a separate, tiny cache so the panel does not compete with the scene budget.
- **Inspector.** Fit, size, offset, opacity, alt text (required; lint if empty), and a "flip" and "crop" for T2.
- **Import.** Drag a file onto an object or the panel. Until Stage 3 storage exists the file becomes a session-only `blob:` URL through `ObjectUrlResolver`, and the project stores only meta and the `assetId`.
- **Preview.** Selecting an attachment previews the image in the inspector without starting any runtime effect or rule.
- **Depth and z-fighting.** A `surface` sits a small fixed offset in front of the host to avoid z-fighting, and the inspector clamps it.

### 10. Accessibility

- `alt` text lives on `ImageAssetMeta`, is required to publish, and is exposed to the overlay layer as the `alt` attribute and to screen readers through an off-screen live region when an image is shown.
- Decorative images are marked `decorative: true` and given empty alt.
- Reduced motion: background and crop animations are off when `prefers-reduced-motion` is set.
- Contrast and size are the author's concern; the editor may warn on very small surfaces.

### 11. Security and privacy

- **Allowlist by content type and by content.** `image/png`, `image/jpeg`, `image/webp` only. SVG is excluded because it can contain script. The backend checks magic bytes, not the extension.
- **EXIF.** Uploaded images can carry GPS and device data. Strip it server-side on upload (Stage 3). The client uses `imageOrientation: 'from-image'` so rotation is still correct after stripping.
- **CORS.** A texture from another origin needs `crossOrigin = 'anonymous'` and matching headers from the media server, or WebGL refuses to upload it. The presigned-URL bucket needs a CORS rule.
- **No remote URLs from authors.** Assets come only through the manager; a rule or attachment never holds a raw URL.

## Feature tiers

| # | Feature | Why | Tier |
|---|---|---|---|
| 1 | Load, decode, cache, ref-count, budget, in-flight de-duplication | Core | T1 |
| 2 | `surface`, `billboard`, `overlay` presentation with fit modes | Core | T1 |
| 3 | Placeholder and error state, retry | Stability | T1 |
| 4 | State store, events, `showImage`/`hideImage`/`toggleImage`, disposal through `EffectRegistry` | Integration | T1 |
| 5 | Size, pixel and dimension limits with downscale on decode | Memory safety | T1 |
| 6 | Alt text and decorative flag | Accessibility | T1 |
| 7 | `panel` primitive (flat quad) for world-placed images | Authoring: place a picture as a thing | T2 |
| 8 | Progressive load: blurred thumbnail first | Perceived speed | T2 |
| 9 | `background` 360 equirectangular | Counterpart to 360 audio | T2 |
| 10 | Crop rectangle and atlas UVs | Sprite sheets, framing | T2 |
| 11 | Asset panel thumbnails with their own small cache | Editor usability | T2 |
| 12 | AVIF support after a browser check; KTX2 GPU-compressed textures | Smaller downloads and GPU memory | T3 |
| 13 | Image sequences and animated images as flipbooks | Effects | T3 |
| 14 | Server-side thumbnail and multiple resolutions (LOD by distance) | Memory on weak devices | T3 |

### The `panel` primitive (T2, spec)

Defined in [`attachment-integration.md`](attachment-integration.md) section 4.3. `assetKind: 'panel'` is a flat quad
(default 1.6 x 0.9 world units, thin). Adding `'panel'` to `AssetKind` touches seven places: `restingHeight`, `makeObject`
naming, `ASSET_COLORS`/`colorFor`, `createGeometry`, the inline switch in `ReferenceViewport.tsx:124`,
`PrimitiveResolver`'s kind list and the serializer allowlist (`serializer.ts:171`). A panel with no attachment renders
as a plain grey quad. A panel with an image attachment of `mode: 'surface'` and no `size` fills the panel.

## Data model (additions to `@vthere/project`)

Additive and optional. `ImageAttachment` and the host fields are in `attachment-integration.md` section 3.

```ts
export interface ImageAssetMeta {
  assetId: string
  name: string
  alt: string                       // required to publish; may be '' only when decorative
  decorative?: boolean
  width?: number                    // pixels; lets layout and the bomb check run before decode
  height?: number
  fit?: ImageFit                    // default fit for new attachments of this asset
  colorSpace?: 'srgb' | 'linear'    // default srgb
  filter?: 'linear' | 'nearest'
  mipmaps?: boolean
  premultipliedAlpha?: boolean
  sources?: { assetId: string; width: number }[]   // T3: alternative resolutions
  credit?: string                   // attribution text, shown in the inspector and optionally in the experience
}
// ProjectData.imageAssets?: ImageAssetMeta[]      SceneObject.attachments and ZoneDefinition.attachments may hold ImageAttachment
```

## Class design (`packages/image/src`)

```ts
class ImageSystem {                                          // the only object other code holds
  constructor(opts: { backend: ImageBackend; assets: ImageAssetLibrary; resolver: AssetResolver;
                      cache?: DecodedCache<ImageBitmap>; limits?: Partial<ImageLimits>; clock?: () => number })
  acquire(att: ImageAttachment): ImageHandle              // returns at once; may be 'loading'
  preload(atts: ImageAttachment[]): Promise<void>
  release(handle: ImageHandle): void
  show(attachmentId: string): void;  hide(attachmentId: string): void;  toggle(attachmentId: string): void
  retry(attachmentId: string): void
  dispose(): void
  readonly store: ImageStateStore
  getStats(): ImageStats
}
interface ImageHandle {
  readonly attachmentId: string
  readonly state: 'loading' | 'ready' | 'error'
  readonly bitmap?: ImageBitmap; readonly width?: number; readonly height?: number
  readonly ready: Promise<void>
  release(): void
}
```

| Class | Responsibility |
|---|---|
| `ImageBackend` (interface) | `decode(blob, opts) -> { bitmap, width, height }` and `fetchBlob(url)`. |
| `BrowserImageBackend` | `fetch` and `createImageBitmap`. Thin. |
| `FakeImageBackend` | Deterministic: returns fake bitmaps of given sizes, can fail on demand, records calls. All unit tests use it. |
| `ImageCache` | Wraps `DecodedCache<ImageBitmap>`: byte size `w*h*4`, close on evict. |
| `ImageLimits` | The limit table above, with `check(descriptor, meta)`. |
| `ImageAssetLibrary` | `getMeta(assetId)`; merges defaults and attachment overrides. Reads `ProjectData.imageAssets`. |
| `layout` | Pure: `fitRect(fit, imageAspect, boxAspect)`, `uvRect(crop)`. |
| `ImageStateStore` | Snapshot, queries, subscribe, events. |
| `ImageEventBridge` | Forwards `imageShown` and `imageHidden` to `emitRuntimeEvent` with the loop guard. |
| `registerImageActions(registry, image, opts)` | Registers the executors below and the disposers. |
| **In `src/viewport/` (Three.js):** `TextureCache` | `THREE.Texture` from a bitmap, ref-counted, disposed at zero. |
| `SurfaceRenderer` | Builds and updates quads for image, video and text surfaces on a host, inside the `syncArtefacts` rebuild. Shared by all three visual type systems. |

## Action vocabulary

Every executor that acquires a handle registers a disposer with `context.effects.add`. Unknown or invalid params are
ignored with a logged warning, not thrown.

| Kind | `params` | Effect |
|---|---|---|
| `showImage` | `attachmentId` or `assetId`; optional `presentation` overrides, `duration` (auto-hide after seconds), `wait` | Show the image |
| `hideImage` | `attachmentId` or `assetId` | Hide it |
| `toggleImage` | `attachmentId` or `assetId` | Show or hide |

## Integration points

| Where | Change |
|---|---|
| `packages/project`, `src/serializer.ts` | `ImageAssetMeta`, `ImageAttachment`, validation and round-trip. See `attachment-integration.md`. |
| `packages/assets` | Image entries in `MEDIA_KIND_SPECS`, `DecodedCache`, content guard, kind router. |
| `src/viewport/assetResolution.ts` | Route `kind: 'image'`; `resolveAttachment`. |
| `src/viewport/syncArtefacts.ts` | Call `SurfaceRenderer` while rebuilding each host mesh. Do not dispose textures in `disposeObjectResources`; the cache owns them. |
| `src/ReferenceViewport.tsx` | Decide whether it shows surfaces (recommend: no; document it as a plain shape view). |
| `src/Viewport.tsx` near L278 | Create `ImageSystem`, `registerImageActions`. Pass project-level `imageAssets` in as a new prop, like `rules` (`Viewport.tsx:318`). |
| `src/viewport/interactionController.ts` | Raycast must hit surfaces: quad meshes carry `userData.entityId` (host id) and `userData.attachmentId`. |
| Overlay layer | Lightbox and thumbnails read `image.store`. |

## Considerations and limits

- **Rebuild on every sync.** Surfaces are recreated each time `syncArtefacts` runs. This is cheap only because textures and bitmaps live in caches outside the group. Keep it that way.
- **Two renderers.** `ReferenceViewport.tsx` builds its own meshes. Surfaces are not added there unless the team decides otherwise.
- **GPU memory is invisible to JavaScript.** The budget counts the decoded bitmap and an estimated mipmap overhead. Real GPU pressure can only be checked by testing on the target device.
- **Storage is not real yet.** Until Stage 3, images come from `public/` or session-only object URLs and vanish on reload. A project referencing one must show the placeholder, not fail to load.
- **`ImageBitmap` lifetime.** A bitmap that is closed cannot be re-uploaded. Close only on cache eviction. After a context loss, re-create textures from cached bitmaps; if a bitmap was evicted, re-decode.
- **Colour space mistakes are silent.** Wrong `colorSpace` produces a plausible but wrong image. Default sRGB, and keep the setting visible in the inspector.
- **Very wide or tall images.** The pixel cap, not just the dimension cap, protects against a 16384 x 512 strip.
- **Transparency and draw order.** Transparent quads sort by object centre, so two overlapping semi-transparent images can flicker. Keep `opacity: 1` and opaque unless the author needs alpha.
- **Text in images** is not searchable and not translatable. Prefer a text attachment for words.
- **Licensing.** Uploaded images may not be the author's to publish. `credit` and a license note on the meta record support this, but enforcement is a product decision, not a code one.
- **Tests.** No image decode in vitest. Logic runs against `FakeImageBackend`; the Three.js side is verified in the browser.

## Open questions

1. **Panel primitive.** Add it (T2), or keep pictures as attachments on ordinary objects only?
2. **Working max dimension.** 2048 is proposed. Confirm against the target device and typical author assets.
3. **Overlay for images in edit mode.** Should the editor viewport show surfaces, or only play mode? Editing without seeing the picture is awkward; showing them costs memory during authoring.
4. **Thumbnails.** Generated client-side on import (session only) or by the backend at upload (Stage 3)?
5. **Attribution.** Whether `credit` is shown to visitors automatically.

## Build sequence

1. **Approve this doc** and the shared attachment model. Decide the panel and edit-mode questions.
2. **Shared work first** ([`attachment-integration.md`](attachment-integration.md) build steps 2 to 5): types, serializer, `DecodedCache`, kind specs, router, guard.
3. **Core without a browser.** Create `packages/image` (`package.json` with `"exports": "./src/index.ts"`, depends on `@vthere/project` and `@vthere/assets`). `ImageSystem`, `ImageCache`, `ImageLimits`, `layout`, `ImageStateStore`, `FakeImageBackend`, with co-located `*.test.ts`.
4. **Browser backend.** `BrowserImageBackend` (`fetch`, `createImageBitmap`, orientation, downscale).
5. **Rendering.** `TextureCache` and `SurfaceRenderer` in `src/viewport/`; hook into `syncArtefacts`; raycast hits; placeholder texture.
6. **Runtime wiring.** Executors and disposers, event bridge, project-level `imageAssets` prop.
7. **Dev surface.** A demo scene with two bundled images (one small, one deliberately over the working limit to prove downscale), a lightbox overlay and a status readout.
8. **T2 features** in this order: panel primitive, progressive load, thumbnails, crop, 360 background.
9. **Docs sync.** `asset-manager.md`, `architecture.md`, `repository.md`, `development-guide.md`, `contracts.md`; mark this doc's status as implemented.

### Verification

- `npm test`. Unit tests cover: limit checks (size, pixels, dimension) and downscale request sizes, cache LRU, ref-count, pinning and in-flight sharing, close-on-evict, state store events and transitions, `layout` fit and UV maths, error and retry, disposal through `resetRuntime`, serializer round-trip of `imageAssets` and image attachments.
- `npm run typecheck` and `npm run build`. `tsconfig.app.json` includes only `src`, so `packages/image` is type-checked once `src/` imports it (step 6). Run `npm install` to link the workspace and commit the lockfile.
- Manual browser check: a picture appears on a host and follows it when moved; a broken `assetId` shows the checkerboard and Retry works; an oversized image is downscaled (check `getStats()`); repeated show and hide does not grow memory; restart scene releases everything; a cross-origin image without CORS fails visibly rather than as a black quad.
