# Attachment Types and the Asset Manager

**Status:** Overview of current state (audited 2026-09-21) plus a design proposal for the missing pieces. Sections marked **Proposed** are not implemented.
**Baseline phase:** Builds on Stage 4a/6 (resolver vehicle and frontend wiring). See [8-stage baseline overview](../baseline-phases.md).
**Companion docs:** [`asset-manager.md`](asset-manager.md) is the contract for the resolver package as built. This doc is the status map. The design lives in [`attachment-integration.md`](attachment-integration.md) (shared model: project data, scene-object binding, asset kinds, resolvers, libraries) and one doc per type: [`audio-system.md`](audio-system.md), [`image-system.md`](image-system.md), [`text-system.md`](text-system.md), [`video-system.md`](video-system.md).

## Purpose

The product lets an author attach content to objects and zones: text, images, audio and video, alongside 3D models
([`project-scope.md`](../../archive/product/UNDATED--FOUNDATION--project-scope.md) L79, L89, L214). This doc answers
one question for each of those types: **what can the Asset Manager load today, with what library, and what is
missing?** It also fixes the rules that every attachment type must follow, so that Image, Text, Video and Audio are
added the same way and do not each invent their own loading, caching and failure handling.

## Boundary

```text
Author attaches content (object / zone / rule action)
        |
        | AssetRef { assetId, kind }
        v
packages/assets  (resolves an id to a URL/blob + content type; never decodes, never plays)
  AssetResolver.resolve(ref) -> AssetDescriptor { status, contentType, url|blob, expiresAt, sizeBytes? }
        |
        | ready descriptor handed to the subsystem that owns that content type
        v
+-------------+  +-------------+  +-------------+  +-------------+  +-------------+
| 3D / Viewport|  | Image       |  | Text        |  | Video       |  | Audio       |
| (syncArtefacts|  | (proposed)  |  | (proposed)  |  | (proposed)  |  | audio-system|
|  environments)|  |             |  |             |  |             |  |  .md        |
+-------------+  +-------------+  +-------------+  +-------------+  +-------------+
   decode, render/play, own the decoded-memory cache and the disposal of what they create
```

The rule that shapes everything below: **the Asset Manager resolves; the type subsystem decodes, presents and
disposes.** [`asset-manager.md`](asset-manager.md) L184-191 already states this for `<audio>`/`<video>` and mesh
swapping. This doc extends it to all attachment types.

## 1. Attachment types at a glance

| Type | Can it be expressed in the model? | Loader that exists | Resolved through `AssetResolver`? | Rendered/played? | Status |
|---|---|---|---|---|---|
| 3D primitive (cube, sphere, cylinder) | Yes, `AssetKind` | Hardcoded `THREE.*Geometry` in `src/viewport/syncArtefacts.ts:34-58` | Yes, `PrimitiveResolver`, but only for status; the renderer ignores the descriptor | Yes | Working |
| 3D model (GLB) | Only as `EnvironmentDefinition.url` (`packages/project/src/index.ts:54-61`), not as a placed object | Three.js `GLTFLoader`, `src/environments.ts:2,93-103` | No, environments load outside the resolver | Environments only; all three shipped ones are procedural | Partial |
| Image | No. `AssetKind` has no image value. | None (no `TextureLoader`, `Image` or `createImageBitmap` anywhere) | No | No | Not started |
| Text | No | None | No | No (`showPanel` appears only in a comment, `packages/project/src/index.ts:120`) | Not started |
| Video | No | None (no `HTMLVideoElement` or `VideoTexture`) | No | No | Not started |
| Audio | No. `playAudio` is an untyped `ActionSpec.kind` string. | None (no `AudioContext`, `HTMLAudioElement` or `PositionalAudio`) | No | No; no `playAudio` executor is registered (`Viewport.tsx:278`) | Not started, designed in [`audio-system.md`](audio-system.md) |

What is in place for all of them: the backend allows `kind in ('model','image','audio','video','other')` in
`media_assets` (`apps/api/app/models.py:163`), the presign helpers work (`apps/api/app/storage.py:26-45`), and the
routes exist as 501 stubs (`apps/api/app/routers/media.py`). Note the backend has **no `text` kind**.

## 2. How the Asset Manager works today

Short form; the full contract is in [`asset-manager.md`](asset-manager.md).

- **Contract.** `AssetResolver.resolve(ref: AssetRef): Promise<AssetDescriptor>`. It must never reject; a failure is
  an `error` descriptor (`packages/assets/src/AssetResolver.ts:18`).
- **Identity.** `AssetRef { assetId: string; kind: AssetKind }` (`AssetRef.ts:15`). `AssetKind` is imported from
  `@vthere/project` and is `'cube' | 'sphere' | 'cylinder'`.
- **Result.** `AssetDescriptor { ref, status: idle|loading|ready|error, contentType?, url?, blob?, errorMessage?, expiresAt? }`
  (`AssetDescriptor.ts:20-34`).
- **Origins.**

  | Resolver | Handles | Notes |
  |---|---|---|
  | `PrimitiveResolver` | `cube`, `sphere`, `cylinder` only | Returns `contentType: 'model/primitive+<kind>'`; rejects other kinds |
  | `LocalCatalogResolver` | Any `assetId` present in a caller-supplied `Map<string,{url,contentType?}>` | Content-agnostic. Default content type is `model/gltf-binary`. Does not fetch. |
  | `RemoteMediaResolver` | Backend media by `projectId` + `assetId` | Skeleton: always returns an error descriptor ("not implemented, Stage 3") |

- **Wrappers.**
  - `AssetCache` keys on `${kind}:${assetId}`, caches only `ready`, evicts on `expiresAt`, no size cap, no LRU.
  - `CachingAssetResolver` does cache-then-delegate, with no in-flight de-duplication.
  - `PlaceholderAssetResolver` turns rejections and errors into a visible placeholder descriptor, with manual `retry()`.
- **App wiring.** `src/viewport/assetResolution.ts` composes `Placeholder(Caching(Fallback(Primitive, LocalCatalog)))`
  and keeps a per-object descriptor map with `subscribeAssetResolution`. The local catalog map is empty. It is
  consumed for badges and pickability, not for rendering.

Two consequences matter for new attachment types:

1. `LocalCatalogResolver` and `RemoteMediaResolver` already handle any content type. Only the **type system** (`AssetKind`) and
   the **app routing** (`FallbackResolver`) stop a non-primitive asset from resolving.
2. Nothing tracks reference counts, byte budgets, blob-URL revocation or in-flight requests. Every attachment type would
   otherwise reimplement these.

## 3. Per-type detail

Each subsection gives what the attachment is, how it should be loaded, what the descriptor is used for, and the
type-specific risks. "Recommended" means a proposal, not a decision made in code.

### 3.1 3D primitive (working)

Placed objects with `assetKind` in `cube | sphere | cylinder`. Geometry comes from `createGeometry` and is disposed
by `disposeObjectResources` on every rebuild (`syncArtefacts.ts:40-52`). The resolver is used only to report
status. Nothing to change except that the `FallbackResolver` routing must keep matching `primitive-${kind}` ids.

### 3.2 3D model, GLB (partial)

- **Today.** `GLTFLoader` for environment scenes, with progress reporting. `disposeGroup` (`environments.ts:73-81`)
  disposes geometry and materials but not textures, despite its own comment.
- **Missing.** Placing a GLB as a scene object (no `SceneObject` field or `AssetKind` for it), a GLTF cache so the
  same model is not fetched and parsed twice, texture disposal, and routing environments through the resolver.
- **Recommended.** Keep `GLTFLoader` (three 0.177). Resolve the URL through `LocalCatalogResolver` or
  `RemoteMediaResolver`, then load. Cache parsed scenes by `assetId` with reference counts, and clone per instance.
  `UNDATED--CURRENT--asset-library-contract.md` (curated inventory, license, pivot) is the intended approval layer.

### 3.3 Image (proposed)

- **Use cases.** A picture on a panel or plane in the scene, a texture, a thumbnail in the editor.
- **Recommended loader.** `fetch` the resolved URL, then `createImageBitmap(blob)` (off-main-thread decode, fixed
  memory cost of `width * height * 4` bytes). For a scene texture, hand the bitmap to `THREE.Texture` (or use
  `TextureLoader` for the simple path).
- **Descriptor use.** `url` or `blob`, `contentType` in `image/png | image/jpeg | image/webp`.
- **Lifecycle.** Call `ImageBitmap.close()` and `Texture.dispose()` on release. Downscale on load above a working
  dimension (proposed 2048, hard cap 4096) to bound GPU memory.
- **Design.** [`image-system.md`](image-system.md).
- **Risks.** Large images are the largest memory hitter in VR-class scenes. SVG is excluded from the allowlist
  because it can carry script.

### 3.4 Text (proposed)

- **Use cases.** A caption or panel of text attached to an object, a dialogue line, a rule-driven `showPanel`.
- **Recommended.** Text is small and is often authored inline in the project, not stored as a file. Support both:
  inline text in the attachment record, and a `text/plain` (or `text/markdown`) asset resolved through the manager
  and read with `Response.text()`.
- **Rendering.** DOM overlay for UI panels (React), or a canvas texture for in-world text. Never `dangerouslySetInnerHTML`
  with author content. If rich text is allowed, sanitise it (`when-do-dispatch-engine.md` L190 already flags this).
- **Limits.** Cap length (proposed 64 KB per text, 512 KB total inline), reject invalid UTF-8, and keep it inside the 2 MB
  project-file cap (`src/serializer.ts:34`) when inline.
- **Backend gap.** `media_assets.kind` has no `text` value; either add it in a migration or store text as `other`.
- **Design.** [`text-system.md`](text-system.md).

### 3.5 Video (proposed)

- **Use cases.** A video panel in the scene or a full-screen cutscene.
- **Recommended loader.** An `HTMLVideoElement` fed the resolved URL (streamed, not decoded up front), shown as a DOM
  element or as a `THREE.VideoTexture` on a plane. Range requests come from the media server; the presigned URL
  must allow them.
- **Lifecycle.** One element per playing video, `pause()`, `removeAttribute('src')` and `load()` to release it, and
  register a disposer with `EffectRegistry` so `resetRuntime` cleans it up.
- **Risks.** Autoplay is blocked without a user gesture (start muted, or wait for one). Mobile browsers limit the
  number of simultaneous video elements. Codec support varies (H.264/MP4 and VP9/WebM are the safe pair). Video and
  audio share one clock policy if the video carries its own sound: [`video-system.md`](video-system.md) proposes
  routing the element's soundtrack through the audio system so master volume and mute apply.
- **Design.** [`video-system.md`](video-system.md).

### 3.6 Audio (proposed, fully designed)

Loaded by the Web Audio API (decode into `AudioBuffer` for short sounds, stream through `HTMLAudioElement` for
long ones). It has enough moving parts (channels, mixing, spatial audio, captions, memory budget) that it is
specified separately in [`audio-system.md`](audio-system.md). From this doc's side, the requirements on the
Asset Manager are only:

- `AssetRef.kind` must be able to say `'audio'`.
- The app routing must send `kind: 'audio'` to a catalog or remote resolver, with an `audio/*` content-type check.
- The descriptor should carry `sizeBytes` so the audio cache can decide buffer vs stream before downloading.
- Concurrent resolves of one asset must share one request.

## 4. Proposed model changes (shared by every new type)

### 4.1 Widen the reference type without touching `AssetKind`

`AssetKind` doubles as "what primitive can be placed in the scene". Everything that switches on it
(`restingHeight`, `ASSET_COLORS`, `createGeometry`, `serializer.ts:171`) assumes primitives. Adding `'audio'` to it
would break all of those. Instead, in `@vthere/project`:

```ts
/** Attachment content types that are not placeable primitives. */
export type MediaKind = 'audio' | 'image' | 'video' | 'text'
/** What an AssetRef may point at. AssetKind stays the placeable-primitive set. */
export type AssetRefKind = AssetKind | MediaKind
```

`AssetRef.kind` becomes `AssetRefKind`. `AssetCache` keys on `kind:assetId` and is unaffected. `PrimitiveResolver`
keeps rejecting non-primitive kinds. Existing saves and code paths are unchanged.

### 4.2 Per-type meta records on the project

Each attachment type keeps its authored settings in a typed, optional array on `ProjectData`, keyed by `assetId`,
so old project files still load (the same additive pattern used for `rules` and `zones`):

```ts
interface MediaMetaBase { assetId: string; name: string }
// ProjectData.audioAssets?: AudioAssetMeta[]    (see audio-system.md)
// ProjectData.imageAssets?: ImageAssetMeta[]    (future)
// ProjectData.videoAssets?: VideoAssetMeta[]    (future)
// ProjectData.textAssets?:  TextAssetMeta[]     (future; may hold inline text)
```

This replaces the idea of sidecar meta files: the settings save and sync with the project JSON and need no extra
storage handling. The media *bytes* still live in media storage, referenced by `assetId`.

### 4.3 How an attachment is used

Two routes, both already implied by the codebase:

- **Bound to an object or zone.** The object or zone carries an `attachments` list (the object's own `assetId` stays
  its visual primitive). Proposed shape and rationale: [`attachment-integration.md`](attachment-integration.md) sections 3 and 4.
- **Triggered by a rule.** A rule's `ActionSpec` carries `params.assetId` (`packages/project/src/index.ts:118-125`).
  `playAudio` and a future `showPanel` and `showImage` use this. Rules must reference the media by `assetId`, never a
  raw URL (`when-do-dispatch-engine.md` L188-190).

## 5. Cross-cutting rules for every attachment type

These are requirements on any type subsystem and on the Asset Manager.

| Concern | Rule | Where it lives |
|---|---|---|
| Never throw | A failed resolve, load or decode yields an error state and an event, never an exception into the dispatcher | Manager: error descriptor. Type subsystem: error state. |
| Visible failure | Errors show a placeholder and allow retry, with backoff (the manager has manual `retry()` only) | `PlaceholderAssetResolver` plus the type UI |
| In-flight de-duplication | Two resolves or loads of the same `assetId` share one request | Add to `CachingAssetResolver`; each type cache also dedupes decode |
| Ownership of decoded memory | The type subsystem owns its decoded data (AudioBuffer, ImageBitmap, GLTF scene, video element) and its byte budget. The manager owns only descriptors. | Type subsystem |
| Reference counting and eviction | Decoded data is ref-counted and evicted least-recently-used against a byte budget. Playing or visible items are pinned. | Type subsystem |
| Disposal | Anything created outside the Three.js scene graph registers a disposer with `EffectRegistry.add` so `resetRuntime()` releases it | `packages/interaction/src/actions/registry.ts:105-163` |
| Signed-URL expiry | The manager sets `expiresAt` from the presigned TTL. A type subsystem re-resolves before a long playback would outlive it. | `RemoteMediaResolver` (Stage 3) |
| Content-type allowlist | Per kind: image `png/jpeg/webp`; audio `mpeg/ogg/wav/mp4/webm`; video `mp4/webm`; text `plain/markdown`. Reject SVG and anything unlisted. | Shared helper in `packages/assets`, enforced on upload and on resolve |
| Size limits | Per-kind maximum upload size, checked by the backend and again client-side from `sizeBytes` | Backend (Stage 3) plus descriptor |
| Autoplay | Audio and video may not start until a user gesture. Requests before it are queued or muted. | Type subsystem, gesture hook in `interactionController.ts` |
| Author content is untrusted | Text is escaped, filenames are never used as paths or HTML, URLs come only from the manager | Type subsystem |
| Editor vs play | Auditioning a piece of content in the editor must not fire rules or create runtime effects | Type subsystem |

## 6. Backend and storage state

- **Schema.** `MediaAsset` (`apps/api/app/models.py:138-166`): `kind`, `storage_key`, `content_type`, `size_bytes`,
  `status` (`pending|uploaded|failed`), unique on `(project_id, storage_key)`. No `text` kind, no duration or
  dimensions columns.
- **Storage.** boto3 presigned PUT/GET against MinIO, bucket `vthere-media`, default TTL 900 s
  (`apps/api/app/storage.py`, `app/config.py:126-129`).
- **Routes.** `GET/POST /projects/{id}/media`, `GET/DELETE /projects/{id}/media/{media_id}`. Models exist
  (`MediaUploadRequest`, `MediaUploadResponse`, `MediaAssetResponse`); every handler raises 501.
- **Missing.** MIME allowlist, size limits, an upload flow in the client, `RemoteMediaResolver` body, and
  `expiresAt` population. Media size and retention limits are listed as undefined in
  `UNDATED--FOUNDATION--tech-stack.md:84`.
- **Consequence for the first non-primitive type.** Until Stage 3 media works, an attachment can only come from a
  bundled or local catalog (`LocalCatalogResolver`, files in `public/`), or from a session-only object URL the user
  picks. Project JSON is capped at 2 MB, so media cannot be embedded in it.

## 7. Changes needed in `packages/assets` and the app (Proposed)

| Change | File | Needed by |
|---|---|---|
| Add `MediaKind`, `AssetRefKind`; widen `AssetRef.kind` | `packages/project/src/index.ts`, `packages/assets/src/AssetRef.ts` | All new types |
| Route non-primitive kinds to `LocalCatalogResolver` / `RemoteMediaResolver`, with content-type checks | `src/viewport/assetResolution.ts` (`FallbackResolver`) | All new types |
| Add `sizeBytes?` to `AssetDescriptor` and the `ready` constructor | `packages/assets/src/AssetDescriptor.ts` | Audio (buffer vs stream), Image (limits) |
| In-flight de-duplication | `packages/assets/src/CachingAssetResolver.ts` | All types |
| `isAllowedContentType(kind, contentType)` helper | new, in `packages/assets/src` | All types, backend parity |
| Add `audio`, `image`, `video`, `text` cases to `resolverContract.test.ts` | `packages/assets/src/resolverContract.test.ts` | All types |
| Real `RemoteMediaResolver` body with `expiresAt` | `packages/assets/src/resolvers/RemoteMediaResolver.ts` | Stage 3 |
| `text` kind and optional `duration_ms`, `width`, `height` columns | `apps/api/app/models.py` + Alembic migration | Text, Image, Video |

## 8. Suggested order

| Order | Type | Why |
|---|---|---|
| 1 | Audio | Hooks already exist (`playAudio`, `EffectRegistry`), it has no rendering dependency, and it exercises the whole path: type widening, routing, cache, disposal, autoplay. Specified in [`audio-system.md`](audio-system.md). |
| 2 | Image | Reuses the same routing and cache pattern. Adds GPU texture lifecycle. |
| 3 | Text | Small, mostly a UI and sanitisation problem. Needs the `showPanel` executor. |
| 4 | Video | Heaviest: streaming, autoplay, element limits, shared clock. Builds on the audio and image patterns. |

GLB placement for scene objects is independent of this order and follows the asset-library contract.

## Owns

- The map of attachment types, their status and their required loaders
- The cross-cutting rules every attachment type follows
- The proposed shared model changes (`MediaKind`, per-type meta records)

## Does not own

- The resolver contract itself (see [`asset-manager.md`](asset-manager.md))
- Any one type's playback or rendering design (audio is in [`audio-system.md`](audio-system.md); others are undesigned)
- The backend media API implementation (Stage 3)
- The curated asset inventory and licensing (see `UNDATED--CURRENT--asset-library-contract.md`)

## Considerations and limits

- **This is a proposal for everything non-primitive.** Only the primitive and environment-GLB rows describe working code.
- **The status matrix is a snapshot.** It was taken from the code on 2026-09-21. Re-check it against `packages/assets`
  and `src/viewport/assetResolution.ts` before relying on it.
- **`asset-manager.md` is partly stale.** `docs/README.md` notes it still describes itself as planned. Its "Limits" section
  is still accurate about the resolver and is the source for the gaps repeated here.
- **Memory budget is per type, not global.** A single shared budget across audio, image, video and GLB would be
  better for a constrained device, but needs a shared registry that does not exist. Start with per-type budgets and
  revisit when two types compete.
- **Attachment binding is proposed, not decided.** [`attachment-integration.md`](attachment-integration.md) section 4
  recommends an `attachments` array on `SceneObject` and `ZoneDefinition`, and lists the alternatives it rejected.
- **Persistence.** No cache survives a reload. Large media are re-fetched on every session until a persistent cache
  (Cache Storage or IndexedDB) is designed.

## Build sequence

1. Land the shared model and routing changes in section 7, with `audio` first, behind tests. No behavior changes for
   existing primitives.
2. Build the audio subsystem against that base ([`audio-system.md`](audio-system.md)).
3. Repeat the pattern for image, then text, then video, each with its own subsystem doc.
4. Replace the `RemoteMediaResolver` skeleton once the Stage 3 media routes are real, and populate `expiresAt`.
