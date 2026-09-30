# Attachment Integration

**Status:** Design specification (2026-09-21). Nothing in this doc is implemented yet. Statements about current code were checked against the source on that date and cite the file.
**Baseline phase:** Post-baseline. Builds on the project model (Stage 1), the Asset Manager (Stage 4a/6) and the When-Do runtime (Stage 4b/7). See [8-stage baseline overview](../FOUNDATION--baseline-phases.md).
**Companions:** [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) is the status map of each content type. [`media-policy-and-cloud-download.md`](CURRENT--media-policy-and-cloud-download.md) documents the parts of sections 5–6 that were built: the `MEDIA_KIND_SPECS` table, `ContentGuardResolver`, and how cloud download of large assets is controlled. The four type designs are [`audio-system.md`](audio-system.md), [`image-system.md`](image-system.md), [`text-system.md`](text-system.md) and [`video-system.md`](video-system.md). This doc is the part they share: how an attachment is stored in the project, how it hangs off a scene object, what kind of asset it points at, how that asset is resolved, and which libraries load each kind.
**Architecture decision:** [`repository.md`](../architecture/FOUNDATION--repository.md) L67-69 treats a new canonical subsystem as an architectural change. The four type docs each propose one; this doc is the shared proposal they depend on.

## Purpose

An author attaches audio, images, text and video to things in a scene. Four questions have to be answered once, not
four times:

1. **Where does it live in `ProjectData`,** so it saves, loads, undoes and syncs like everything else?
2. **How does it relate to a `SceneObject`** (and a zone), so duplicating, deleting, reparenting and copying a scene do the right thing?
3. **What kind of asset is it,** so the Asset Manager can route, validate and size-check it?
4. **How is it resolved and loaded,** with which resolvers and which libraries, without each type inventing its own loading, caching and failure handling?

## Boundary

```text
ProjectData  (packages/project, serialised by src/serializer.ts)
  audioAssets[] imageAssets[] videoAssets[] textAssets[]     <- media meta: authored settings per asset
  scenes[].objects[].attachments[]   scenes[].zones[].attachments[]   <- the binding to a host
  rules[]  --- actions carry params.attachmentId / assetId
        |
        | Attachment { id, kind, assetId, ... }      AssetRef { assetId, kind }
        v
Attachment resolution (app layer, src/viewport/)         packages/assets
  findAttachment(project, id) -> host + attachment  --->  AssetResolver chain
                                                          Placeholder > Caching(dedupe) > ContentGuard > KindRouter
                                                                          |- PrimitiveResolver
                                                                          |- InlineTextResolver
                                                                          |- LocalCatalogResolver / ObjectUrlResolver
                                                                          '- RemoteMediaResolver (Stage 3)
        | ready AssetDescriptor { url|blob, contentType, sizeBytes, ... }
        v
+--------------+ +--------------+ +--------------+ +--------------+
| packages/    | | packages/    | | packages/    | | packages/    |
| audio        | | image        | | text         | | video        |   decode, own memory, own state store
+------+-------+ +------+-------+ +------+-------+ +------+-------+
       |                |                |                |
   Web Audio      src/viewport/ (Three.js surfaces)   DOM overlay (React)    <- presentation
```

Rule that shapes everything: **the Asset Manager resolves; the type package decodes and owns state; the app layer
(`src/`) presents.** Type packages never import React or Three.js. Anything that needs Three.js (a texture on a quad,
a `VideoTexture`) lives in `src/viewport/`, fed by the type package's state.

## Where to find things (planned)

| Concern | Planned owner |
|---|---|
| Attachment, media-meta and kind types | `packages/project/src/index.ts` |
| Serializer validation and backfill | `src/serializer.ts` |
| Duplicate / remove / copy behaviour for attachments | `packages/authoring-engine/src/index.ts` |
| Attachment lookup helpers (`findAttachment`, `collectAttachments`) | `packages/project/src/attachments.ts` |
| Media kind specs (MIME allowlist, size limits), content-type guard, shared decoded cache | `packages/assets/src/mediaKinds.ts`, `ContentGuardResolver.ts`, `DecodedCache.ts` |
| Kind router, inline text, session object URLs | `packages/assets/src/resolvers/` |
| Resolver chain wiring and the per-attachment status store | `src/viewport/assetResolution.ts` |
| Type systems | `packages/audio`, `packages/image`, `packages/text`, `packages/video` |
| Three.js surfaces (image/video/text on a quad) | `src/viewport/mediaSurfaces.ts` |
| Overlay UI (panels, lightbox, video overlay, mixer) | `src/` (React) |

## 1. How this fits the architecture

The current module table is [`architecture.md`](../architecture/FOUNDATION--architecture.md) L20-41. What
changes, and what does not:

| Module | Change |
|---|---|
| ProjectModel (`packages/project`) | Gains `MediaKind`, `Attachment`, per-kind meta records, and `attachments` on `SceneObject` and `ZoneDefinition`. Still no imports. |
| AuthoringEngine | `duplicateObject` and `scene copy` must deep-copy and re-id attachments (see section 4). No other change; attachments ride along with the object. |
| Assets | Gains `MEDIA_KIND_SPECS`, a content guard, in-flight de-duplication, a kind router and a shared `DecodedCache`. Still descriptors only; still never decodes or plays. |
| Interaction | No change to `dispatch()`. New action kinds are registered by each type package. `resetRuntime` already disposes effects. |
| New: Audio, Image, Text, Video | One package each, one doc each (rows added to the module table when built). Each depends on `@vthere/project` and `@vthere/assets` and on nothing else, including each other. |
| Viewport | New `mediaSurfaces.ts`. `syncArtefacts` keeps rebuilding the artefact group; surfaces are created inside that rebuild, backed by caches that live outside it. |
| Editor UI | Inspector section for a selected object's attachments. This is a separate authoring slice. |
| RuntimeView | Hosts the overlay layer (panels, lightbox, video overlay, captions, mixer). |
| API | No change until Stage 3, except a `text` kind and media dimensions (section 5). |

**Dependency direction** (must stay acyclic): `apps and src -> type packages -> assets -> project`. Today no package
depends on another except on `@vthere/project` (`architecture.md` L189). This design adds `type package -> assets`
as a runtime import (for `DecodedCache` and the kind specs), in one direction only.

**Shared code rule.** Code needed by two type packages goes in `packages/assets` if it is about assets and memory, or
is extracted to a new tiny package when it is not. The one known case is captions (timed text used by audio and video):
it starts inside `packages/audio` and is extracted to `packages/captions` when video becomes the second consumer.

## 2. Vocabulary: three layers

| Layer | What it is | Where it lives | Example |
|---|---|---|---|
| **Media asset** | The bytes: an audio, image or video file, or a text file | Media storage or local catalog; referenced by `assetId` | `door-creak.ogg` |
| **Media meta** | Authored, reusable settings for that asset | `ProjectData.<kind>Assets[]`, keyed by `assetId` | Default volume, channel, alt text, poster, a reference to a caption asset |
| **Attachment** | A binding of one asset to one host, with settings that apply to that binding | `SceneObject.attachments[]`, `ZoneDefinition.attachments[]` | "The door object plays `door-creak` positionally" |

Behaviour is not in any of these. **An attachment declares that content belongs to a host; a rule says when it
happens.** A rule action names an attachment (`playAudio { attachmentId }`) or, for content with no host such as a
scene soundtrack, an asset (`playAudio { assetId }`). This keeps one behaviour engine. The authoring UI may create a
default rule when an author attaches something ("play on click"), but that is a convenience, not a second trigger system.

Resolution order for any setting: **rule action `params` > attachment overrides > media meta > type default.**

## 3. Project data

All additions are optional and backfilled on load, so `schemaVersion` stays 1 and old files open. This is the same
additive pattern used for `parentId`, `zones` and `rules` (`packages/project/src/index.ts:34-41`, `serializer.ts:59-76`).
Undo, redo and sync cover them for free because they are ordinary `ProjectData` fields.

```ts
// packages/project/src/index.ts
export type MediaKind = 'audio' | 'image' | 'video' | 'text'
export type AssetRefKind = AssetKind | MediaKind      // AssetRef.kind widens to this; AssetKind is unchanged

export interface AttachmentBase {
  id: string                 // unique across the whole project (objects and zones alike), like object ids
  name?: string              // author label in the inspector
}
export interface AudioAttachment extends AttachmentBase { kind: 'audio'; assetId: string; overrides?: AudioAttachmentOverrides }
export interface ImageAttachment extends AttachmentBase { kind: 'image'; assetId: string; presentation: ImagePresentation }
export interface VideoAttachment extends AttachmentBase { kind: 'video'; assetId: string; presentation: VideoPresentation; overrides?: VideoAttachmentOverrides }
export interface TextAttachment  extends AttachmentBase { kind: 'text';  assetId: string; presentation: TextPresentation }
export type Attachment = AudioAttachment | ImageAttachment | VideoAttachment | TextAttachment

// SceneObject gains   attachments?: Attachment[]
// ZoneDefinition gains attachments?: Attachment[]
// ProjectData gains   audioAssets?: AudioAssetMeta[]; imageAssets?: ImageAssetMeta[]
//                     videoAssets?: VideoAssetMeta[]; textAssets?: TextAssetMeta[]
```

The per-kind types (`AudioAssetMeta`, `ImagePresentation`, `TextAssetMeta`, and so on) are defined in each type doc.
`AssetKind` (`'cube' | 'sphere' | 'cylinder'`) is not touched: it is switched on by `restingHeight`
(`packages/project/src/index.ts:181`), `ASSET_COLORS` (`src/viewport/viewportTypes.ts:20`), `createGeometry`
(`syncArtefacts.ts:34`) and the serializer allowlist (`serializer.ts:171`), all of which assume placeable primitives.

### Serializer rules (proposed, in `validateProject`)

| Rule | Limit or behaviour |
|---|---|
| Attachments per host | At most 16 (`MAX_ATTACHMENTS_PER_HOST`). Total at most 5,000. |
| Attachment id | Non-empty string, at most 200 characters (`MAX_LABEL_LENGTH`), unique across the project. Collected into a set the same way `objectIds` and `zoneIds` are. |
| `kind` | One of `audio`, `image`, `video`, `text`. Unknown kinds are rejected. |
| `assetId` | Non-empty string, at most 200 characters. It need not exist in the catalog: an unknown asset is a runtime placeholder, not a load failure, because the catalog is not known to the serializer. |
| Meta arrays | Unique `assetId` per kind. Each record is validated by a per-kind function so one file can hold all four. |
| Inline text budget | Total inline text across `textAssets` at most 512 KB, so text cannot crowd out scenes inside the 2 MB project cap (`MAX_PROJECT_FILE_BYTES`, `serializer.ts:34`). |
| Rule references | An action's `params.attachmentId` is **not** validated at load; see below. |

**Why rule references to attachments are not rejected at load.** `validateRules` rejects a rule that points at a missing
object or zone (`serializer.ts:148-149`). `removeObject` (`packages/authoring-engine/src/index.ts:215-241`) now drops
every rule whose `objectId` falls inside the removed subtree and returns them as `removedRules` on the result, so a
saved project always round-trips through `deserializeProject(serializeProject(project))`; see "Latent orphan-rule bug"
under Considerations and limits for the fix. There is no zone-removal operation yet, so the equivalent `zoneId` cascade
has nothing to attach to until one is added. This design does not need to extend that cascade to attachments: an
unknown `attachmentId` at runtime is a logged no-op (consistent with "unknown params are ignored"), and the editor
should lint dangling references rather than have the serializer reject them.

## 4. Scene objects and attachments

### Options considered

| Option | Where the binding lives | Lifecycle | Cost |
|---|---|---|---|
| **A. On the host** (recommended) | `SceneObject.attachments[]`, `ZoneDefinition.attachments[]` | Delete, duplicate, undo, scene copy carry attachments with the host. No orphan state is possible. | Two host types need the same field. `duplicateObject` must deep-copy and re-id. |
| B. Project-level table | `ProjectData.attachments[]` with `{ hostKind, hostId }` | One field, one validator, any host type. But every delete and duplicate must be told to cascade. | Recreates the orphan problem described above. |
| C. Rule-only | No stored binding; media appear only via actions | Nothing to keep in sync | Cannot express "this door has a sound"; the inspector has nothing to show; no emitter position for spatial audio |
| D. Media as scene objects | Widen `AssetKind` to `image`, `video`, `text` | Gets transform, gizmo, selection, parenting for free | Ripples through the four `AssetKind` switch sites; audio has no body to place; forces one object per media item |

**Recommendation: A, plus one new primitive for world-placed media (section 4.3).** It matches how the rest of the
model already works (transform, `visible`, `enabled` and `parentId` all live on the object) and cannot produce the
orphan state that B does.

### 4.1 What the code has to change for option A

| Site | Today | Change |
|---|---|---|
| `duplicateObject` (`authoring-engine/src/index.ts:176-211`) | Copies with `{ ...item, id, transform }`. Any array on the object, such as `attachments`, would be shared by reference between the original and the copy inside the cloned project, and ids would collide. | Deep-copy `attachments` and give each copy a new id from the id factory. Add `nextAttachmentId` beside `nextId`. |
| `createScene` (`index.ts:315-336`) | Copies objects with a transform deep copy only. | Same deep copy of `attachments`. |
| `removeObject` (`index.ts:215-241`) | Filters the subtree and drops rules referencing it (`removedRules` on the result; see Considerations). | No change for attachments (they vanish with the object). Stop any live voice, video or panel on a removed host at runtime via effect disposal, not in the engine. |
| `reparentObject`, `updateObjectTransform`, `renameObject` | Touch other fields. | No change. |
| `setObjectAssetId` (`index.ts:294-302`) | Sets `assetId` with no kind check. | No change. It changes the object's own visual asset, not its attachments. |
| `SceneObject` type and `makeObject` | No attachments. | Field is optional; `makeObject` leaves it undefined. |
| Serializer | No attachments. | Validation above. `backfillScenes` sets `attachments = []` only when the array is absent and the host is being edited; leave `undefined` otherwise to keep files small. |
| Scene tree and inspector | Show objects. | Show an "Attachments" list for the selected object (authoring slice). |

New authoring operations, pure functions in the same style as the existing ones (each returns a new `ProjectData`):
`addAttachment`, `removeAttachment`, `updateAttachment`, `reorderAttachments`, and the same four for zones.

### 4.2 How a host and its attachments behave at runtime

| Question | Proposed rule |
|---|---|
| How does the runtime see attachments? | The viewport is fed the **active scene only**: `dataRef.current.objects` and `.zones`, and it builds a minimal `ProjectData` for the dispatcher (`Viewport.tsx:305-319`). Attachments on hosts arrive with the objects and zones with no new plumbing, which is a practical advantage of option A. Project-level data (the four meta arrays, `audioSettings`) is not in that feed and needs new props, the way `rules` has one (`Viewport.tsx:318`). |
| Where is a spatial attachment? | At the host's world transform, looked up **by object id each frame** through `composeWorldTransform` (`transformMath.ts:143`). Never attach a node to a mesh: `syncArtefacts` disposes and rebuilds every mesh on each sync (`syncArtefacts.ts:49-52`). |
| Host has `visible: false` | Visual attachments (image, video, text surfaces) are not shown. Audio is unaffected. |
| Host has `enabled: false` | The host takes no interaction, so rules on it do not fire and its attachments cannot be started by clicking it. Already-playing content is not stopped by the flag alone. |
| Host is removed or the scene changes | All content started for that host is released through `EffectRegistry` (`resetRuntime` calls `disposeAll()`). |
| Host is a zone | Attachments have no transform of their own; the zone's `position` and shape apply. A zone audio attachment plays at the zone position (positional) or non-spatially (ambient). Visual kinds on a zone use `overlay` presentation only. |
| Editor vs play | In edit mode an attachment can be auditioned in isolation (its own voice or preview panel). That path creates no runtime effects and fires no rules. |

`visible` and `enabled` semantics for attachments are recommendations, listed as an open question.

### 4.3 World-placed media: the `panel` primitive

An image, video or text panel is something an author places, moves and rotates like any object. Option D wanted that.
Instead of widening the media kinds into `AssetKind`, add **one** primitive: `panel`, a flat quad. A placed panel is an
ordinary `SceneObject` with `assetKind: 'panel'` and one image, video or text attachment whose presentation is
`surface`. Without it an author must attach a picture to a cube, which works but looks wrong.

Adding `'panel'` to `AssetKind` touches seven places, all mechanical: `restingHeight`, `makeObject` naming,
`ASSET_COLORS`/`colorFor`, `createGeometry`, the inline geometry switch in `ReferenceViewport.tsx:124`,
`PrimitiveResolver`'s kind list and the serializer allowlist. Two renderers build meshes independently
(`syncArtefacts.ts` and `ReferenceViewport.tsx`), so both need the change. This is specified in
[`image-system.md`](image-system.md), the first consumer, and is a T2 item there. Everything else works without it.

## 5. Asset types

Every attachment points at an asset, and every asset has a **kind** that decides how it is routed, validated and sized.
That knowledge is table-driven and shared, not scattered across resolvers.

```ts
// packages/assets/src/mediaKinds.ts
export interface MediaKindSpec {
  kind: MediaKind
  contentTypes: readonly string[]      // exact allowlist
  maxBytes: number                     // upload and resolve limit
  owner: 'audio' | 'image' | 'text' | 'video'    // which package decodes it
  decodedBudgetBytes: number           // starting budget for that package's DecodedCache
}
export const MEDIA_KIND_SPECS: Readonly<Record<MediaKind, MediaKindSpec>>
export const kindForContentType: (contentType: string) => MediaKind | undefined
export const isAllowedContentType: (kind: MediaKind, contentType: string) => boolean
```

Proposed starting values (all are tuning numbers, not decisions):

| Kind | Allowed content types | Max file size | Decoded budget | Notes |
|---|---|---|---|---|
| audio | `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`, `audio/webm` | 20 MB | 64 MB | Budget is decoded PCM, not file size. See `audio-system.md`. |
| image | `image/png`, `image/jpeg`, `image/webp` | 10 MB | 128 MB | `image/svg+xml` excluded (script). `image/avif` is a T2 addition once browser support is checked. |
| video | `video/mp4`, `video/webm` | 200 MB | not decoded; slot-limited | Streamed. Limited by playing slots, not bytes. See `video-system.md`. |
| text | `text/plain`, `text/markdown` | 64 KB per text | n/a | Inline text is capped separately (section 3). |

`AssetDescriptor` gains optional fields the type packages use before downloading anything:

| Field | Set by | Used for |
|---|---|---|
| `sizeBytes?` | Resolver (catalog entry, or backend `size_bytes`) | Audio buffer-vs-stream decision, size limit check, progress |
| `width?`, `height?` | Backend record (Stage 3) or meta | Image layout before decode, decompression-bomb check |
| `durationMs?` | Backend record or meta | Video and audio scrub bars before load |

`LocalCatalogEntry` gains the same optional fields. The backend `media_assets` table (`apps/api/app/models.py:138-166`)
has `kind`, `content_type` and `size_bytes` but no `text` kind and no dimensions or duration columns; add them in one
Alembic migration when Stage 3 media work starts. Until then the catalog and the meta record carry them.

**Parity.** The client allowlist and the backend allowlist must be the same list. Export it once (a JSON fixture read by
both a vitest test and a pytest test) rather than maintaining two copies.

## 6. Attachment resolvers

Two things are called "resolve" and they are different:

- **Asset resolution:** `AssetRef -> AssetDescriptor`. Already exists (`AssetResolver`). Answers "where are the bytes and what type are they".
- **Attachment resolution:** `attachmentId -> { host, attachment, meta, descriptor }`. New. Answers "what is this binding and can I use it now".

### 6.1 The asset resolver chain (packages/assets)

Today: `Placeholder( Caching( Fallback( Primitive, LocalCatalog )))` (`src/viewport/assetResolution.ts:52-55`).
`FallbackResolver` sends an id shaped `primitive-<kind>` to the primitive resolver and everything else to the catalog,
so it cannot route by media kind. Proposed:

```text
PlaceholderAssetResolver                 error -> visible/audible placeholder, retry
  CachingAssetResolver                   cache + in-flight de-duplication (new)
    ContentGuardResolver                 kind/contentType/size allowlist (new)
      KindRouterResolver                 routes on ref.kind (replaces FallbackResolver)
        primitives      -> PrimitiveResolver
        text (inline)   -> InlineTextResolver        (new; reads ProjectData.textAssets through an injected lookup)
        audio|image|video|text(file)
                        -> first hit of: ObjectUrlResolver (session imports) > LocalCatalogResolver > RemoteMediaResolver
```

| Resolver | Status | Behaviour |
|---|---|---|
| `PrimitiveResolver` | Exists | Unchanged. Keeps rejecting non-primitive kinds. |
| `LocalCatalogResolver` | Exists, content-agnostic | Gains optional `sizeBytes`, `width`, `height`, `durationMs` on entries. Default content type stays `model/gltf-binary` for models; media entries must state theirs. |
| `RemoteMediaResolver` | Skeleton | Stage 3 body: `GET /projects/{id}/media/{assetId}` to a presigned URL, sets `expiresAt` from the TTL (900 s default, `storage.py`). |
| `KindRouterResolver` | New | Table-driven by `ref.kind`. Replaces `FallbackResolver` and keeps its `primitive-<kind>` rule. |
| `ContentGuardResolver` | New | After the delegate returns `ready`, checks `contentType` against `MEDIA_KIND_SPECS` and `sizeBytes` against `maxBytes`; on a mismatch returns an `error` descriptor. Never trusts an extension. |
| `ObjectUrlResolver` | New | Holds `blob:` URLs for files the user imported this session. Owns `URL.revokeObjectURL` on removal and on `dispose()`. Session-only; nothing persists. |
| `InlineTextResolver` | New | For a text asset whose meta is inline, returns a `ready` descriptor with a `text/plain` `blob`, so text uses the same path as every other kind. |
| `CachingAssetResolver` | Exists | Add an in-flight map so concurrent resolves of one `kind:assetId` share one request. |
| `PlaceholderAssetResolver` | Exists | Unchanged contract; each type package decides what its placeholder looks and sounds like (below). |

All resolvers keep the existing contract: **never reject; a failure is an `error` descriptor.**

### 6.2 What a placeholder is, per kind

| Kind | On error |
|---|---|
| Audio | Silent voice in `error` state, an `audioError` event, retry with backoff |
| Image | A visible "missing" texture (checkerboard) at the intended size, with a retry affordance in the editor |
| Text | The panel shows "Content unavailable" in place of the text |
| Video | Poster if it resolved, otherwise a dark frame with an error badge |
| 3D | The existing placeholder descriptor flow |

### 6.3 Attachment resolution (app layer)

`src/viewport/assetResolution.ts` keeps one descriptor per **object id** and lets the UI subscribe to it
(`descriptors`, `subscribeAssetResolution`, lines 66-99). Attachments need the same, keyed by attachment id. Proposed:

```ts
// packages/project/src/attachments.ts  (pure)
findAttachment(project, attachmentId): { sceneId: string; host: { kind: 'object'|'zone'; id: string }; attachment: Attachment } | undefined
collectAttachments(scene): { host, attachment }[]
assetRefForAttachment(attachment): AssetRef            // { assetId, kind: attachment.kind }

// src/viewport/assetResolution.ts  (app)
resolveAttachment(attachment): Promise<AssetDescriptor>
getAttachmentDescriptor(id) / subscribeAttachmentResolution(id, listener)     // same shape as the object versions
```

The per-id store is generalised, not duplicated: keys are prefixed (`object:<id>`, `attachment:<id>`) so the two id
spaces cannot collide. When a type package needs bytes it is handed the same `AssetResolver` instance and asks it
directly; the store exists for UI badges, not for playback.

**Refresh.** A descriptor with `expiresAt` is re-resolved by the type package before a long playback would outlive it.
The cache already evicts expired descriptors (`AssetCache`); the type package must not cache the URL past `expiresAt`.

**Preload.** On scene load, `collectAttachments(scene)` gives the set of assets to warm. Each type package decides
what "warm" means (audio: decode short sounds; image: decode visible surfaces; video: fetch metadata only). Nothing is
fetched for a host in another scene.

## 7. Libraries by attachment type

Policy from [`tech-stack.md`](../architecture/FOUNDATION--tech-stack.md): dependencies are pinned to exact
versions, recorded in the lockfile, and license-compatible; unreviewed convenience dependencies are forbidden; packages
must not import React, Three.js or FastAPI (L155-158). So the default is **browser-native APIs behind an interface**, and
a library is added only when it removes real work.

> **Verification status.** The Web API and Three.js entries below are standard and stable. Third-party package names,
> licenses, maintenance state and browser-support statements come from general knowledge, not from this repo, and are
> marked **verify**. Check the current version, license and support before adopting any of them, and record the result
> in the lockfile PR.

| Kind | Loads with (recommended) | Alternatives | Why / why not |
|---|---|---|---|
| **3D primitive** | `THREE.*Geometry` (in the app) | none | Already built |
| **3D model (GLB)** | Three.js `GLTFLoader` (already used, `environments.ts:93`) | `DRACOLoader`, `MeshoptDecoder` for compressed meshes; `KTX2Loader` for GPU-compressed textures | All ship inside `three`. Add only when asset sizes demand it. Runs in `src/`, not a package. |
| **Audio** | Web Audio API: `decodeAudioData`, `AudioBufferSourceNode`, `MediaElementAudioSourceNode`, `PannerNode`, `DynamicsCompressorNode` | Howler.js, Tone.js, Three.js `PositionalAudio`, Resonance Audio, Omnitone, JSAmbisonics (**verify** all) | Raw Web Audio was chosen (decision recorded in `audio-system.md`). Howler and Tone bring their own state and mix model. `PositionalAudio` needs Three.js in the package. Resonance and Omnitone are ambisonic renderers worth reading before writing the decoder, but their maintenance state is unknown (**verify**). |
| **Image** | `fetch` + `createImageBitmap(blob, options)`; upload via `THREE.Texture` (or `ImageBitmapLoader`) in `src/` | `HTMLImageElement.decode()`, `THREE.TextureLoader`, `KTX2Loader`, `pica` for high-quality resize (**verify**) | `createImageBitmap` decodes off the main thread and gives a fixed memory cost. `TextureLoader` is fine for the simple path but hides the decode. No dependency is needed for resize: `createImageBitmap` accepts `resizeWidth`, `resizeHeight`. |
| **Text** | Plain string or a small markdown subset parsed to a node tree and rendered by React. In-world text: 2D canvas to `THREE.CanvasTexture`. | `marked` or `markdown-it` with DOMPurify (**verify**); `troika-three-text` for SDF text in world (**verify**); `three-mesh-ui` (**verify**) | A subset parser removes the need for an HTML sanitiser, because it never produces HTML. Canvas text needs no dependency and uses the browser's shaping for complex scripts. An SDF library is an optional upgrade in `src/` if canvas text is too soft at distance. |
| **Video** | `HTMLVideoElement` + `THREE.VideoTexture` (in `src/`), `requestVideoFrameCallback` where available | `hls.js` for HLS on non-Safari, `dash.js`, `shaka-player` (**verify**); WebCodecs `VideoDecoder` (limited support, **verify**); `video.js`, `plyr` for controls | Progressive MP4/WebM over range requests is enough for the MVP. Add `hls.js` only if adaptive streaming is required. Custom controls are simple enough to skip a player library. |
| **Captions** | WebVTT parsed by a small pure function | `<track>` and the `TextTrack` API, SRT parsers (**verify**) | One parser shared by audio and video keeps overlay and in-world captions identical. |
| **Server side** | Python: Pillow to read image dimensions and re-encode; `ffprobe` (ffmpeg) for audio/video duration and codec; a magic-byte check for MIME | `python-magic`, `mutagen` (**verify**) | Runs at upload in Stage 3 to fill `width`, `height`, `duration_ms` and to strip EXIF (GPS) from images. Not built. |

## 8. Shared runtime infrastructure

What every type package reuses instead of rewriting:

| Piece | Home | Notes |
|---|---|---|
| Byte-budgeted, ref-counted, LRU cache with pinning, in-flight de-duplication and stats | `packages/assets/src/DecodedCache.ts` (generic in the value type) | `AudioBufferCache` and `ImageCache` are thin wrappers. It counts bytes the caller reports, so an `AudioBuffer`, an `ImageBitmap` and a texture each supply their own estimate. |
| Global media budget | Same file: `MediaBudget` with one ceiling and per-cache shares | Resolves the "shared budget" open question by making it opt-in: each cache takes a share, and a single number can be tuned for a device. |
| Autoplay unlock | One `onUserGesture` hook in `interactionController.ts` that calls each system's `unlock()` | Audio and video both need it. |
| Disposal | `EffectRegistry.add(dispose)` (`packages/interaction/src/actions/registry.ts`) | Every executor that starts something registers a disposer; `resetRuntime` calls `disposeAll()`. |
| State store pattern | `snapshot()`, `subscribe(listener) -> unsubscribe`, typed queries, typed events | Same shape as `subscribeAssetResolution`, so React can use `useSyncExternalStore`. Each package has its own store. |
| Events back into rules | A small bridge per package that calls `emitRuntimeEvent` (`Viewport.tsx:287`) with a loop guard | `audioEnded`, `videoEnded`, `panelClosed`. |
| Backend seam | An interface plus a `Fake...` implementation | `AudioBackend`, `ImageBackend`, `VideoBackend`, `TextMeasurer`. jsdom has no `AudioContext`, no real video decode and no font metrics, so all logic is tested against fakes. |
| Fixed clock | Injected `now()` and `rng()` | Deterministic tests for timing and random variation. |

## 9. Action vocabulary across types

Action kinds are open strings (`contracts.md`); an unregistered kind is a no-op. Each package registers its own with
`ActionRegistry.register` and a disposer per started effect. Every action accepts `attachmentId` or `assetId`; the
attachment form is preferred because it carries the host and the overrides.

| Type | Kinds (full specs in each doc) |
|---|---|
| Audio | `playAudio`, `stopAudio`, `pauseAudio`, `resumeAudio`, `resetAudio`, `seekAudio`, `setChannelVolume`, `muteChannel`, `setMasterVolume`, `applyMixSnapshot` |
| Image | `showImage`, `hideImage`, `toggleImage` |
| Text | `showPanel`, `hidePanel`, `advancePanel` |
| Video | `playVideo`, `pauseVideo`, `resumeVideo`, `stopVideo`, `seekVideo`, `showVideo`, `hideVideo` |

Two naming points to settle:

- `contracts.md` lists `playAudioOrVideo` as an example, but code and tests use `playAudio`
  (`packages/interaction/src/actions/registry.test.ts:42`). These docs use separate audio and video kinds; align `contracts.md` when the first executor lands.
- The `ActionSpec` doc comment names `componentId` as the `showPanel` argument (`packages/project/src/index.ts:119-121`).
  `text-system.md` uses `attachmentId` and accepts `componentId` as an alias so existing example rules keep working.

## Owns

- The shape of an attachment, its media meta and its asset kind in `ProjectData`, and how they validate
- The rule that attachments live on their host, and the authoring operations that keep that true
- The shared asset-side machinery: kind specs, content guard, kind router, in-flight de-duplication, decoded cache and budget
- The attachment resolution helpers and the per-attachment status store
- The per-type library recommendations and the dependency policy for them

## Does not own

- How any one type is decoded, mixed, laid out or played (each type doc)
- Rendering and overlay UI (`src/`)
- The resolver contract itself ([`asset-manager.md`](CURRENT--asset-manager.md))
- Backend media storage and the upload flow (Stage 3)
- The curated 3D asset inventory (`CURRENT--asset-library-contract.md`)

## Considerations and limits

- **Whole-project rebuilds.** `syncArtefacts` disposes and rebuilds every mesh on each sync (`syncArtefacts.ts:49-52`,
  and `disposeObjectResources` covers only meshes and line segments, disposing geometry and materials but not
  textures). That is good for shared textures, which survive it, and bad for anything a rebuild would restart. Decoded
  images, video elements and audio voices must live in caches owned outside the group and be referenced from it.
- **Two renderers.** `ReferenceViewport.tsx` builds meshes separately from `syncArtefacts.ts`. Decide whether it shows
  media surfaces or deliberately does not, and document which.
- **Orphan-rule bug: fixed.** `removeObject` (`packages/authoring-engine/src/index.ts:215-241`) now drops every rule
  whose `objectId` is in the removed subtree and returns them as `removedRules: InteractionRule[]` on the
  `ObjectOperationResult`, so a saved project no longer fails `validateRules` on the next load. Undo restores dropped
  rules for free because it replays the whole `ProjectData` snapshot through `createCommandTimeline`, not `removedRules`
  itself. Tests: `packages/authoring-engine/src/index.test.ts` and the round-trip test in `src/serializer.test.ts`.
  There is no zone-removal operation in the codebase yet, so the same `zoneId` cascade has nothing to attach to; add it
  alongside whichever operation first removes a zone.
- **Project size.** Only meta and inline text are in the project JSON. Media bytes never are. Inline text has its own
  512 KB ceiling so a text-heavy scene cannot push the file past 2 MB.
- **Storage is not real yet.** Until Stage 3, media come from a bundled `public/` catalog or session-only object URLs.
  An attachment saved in the project can point at an asset that is missing on the next load; that must show a
  placeholder, not fail the load.
- **Copying between projects.** An attachment refers to an `assetId` and meta by id. Copying an object into another
  project also has to copy the meta records it needs. Not designed here.
- **Undo granularity.** Adding an attachment and importing its file are two steps. Undo covers the project change; the
  imported bytes (session object URL) stay until the session ends.
- **Privacy.** Uploaded images carry EXIF (including GPS). Strip on upload server-side; the client cannot be trusted to.
- **Accessibility.** Every visual attachment needs alt text and every timed one needs captions. The meta records carry
  the fields and the editor lints missing ones.
- **Third-party embeds are out.** No iframes to YouTube or similar in the MVP: they break the CSP, leak visitor data
  and cannot be resolved through the Asset Manager.

## Open questions

**Decision (2026-09-22): Attachment on host, not a project-level table.** Option A (section 4) is confirmed:
`SceneObject.attachments[]` and `ZoneDefinition.attachments[]`. Delete, duplicate, undo and scene copy carry
attachments with the host automatically. `duplicateObject` and `createScene` deep-copy `attachments` per section 4.1.

**Decision (2026-09-22): Add the `panel` primitive, scheduled as T2.** Section 4.3's `panel` `AssetKind` is confirmed
for world-placed media. It ships after the T1 attachment model (host binding, resolvers, first type system), not with
it — see the `panel` line in each type doc's T2 list. Both renderers (`syncArtefacts.ts` and `ReferenceViewport.tsx`)
must show it once built.

**Decision (2026-09-22): Captions are separate caption assets, not inline.** Reverses the inline-first lean this doc
and `audio-system.md` previously carried. A caption is its own asset kind, referenced by id from `AudioAssetMeta`/
`VideoAssetMeta`, resolved through the same Asset Manager path as other media rather than embedded in project JSON.
This needs a `caption` (or similarly named) entry in `MediaKindSpec`/`MEDIA_KIND_SPECS` (section 5) and a resolver
route (section 6.1) before audio or video captions can ship; update those sections when this is implemented.

**Decision (2026-09-22): `showPanel` takes `attachmentId`, with `componentId` accepted as an alias.** Matches every
other proposed action kind (`playAudio`, `showImage`, ... all take `attachmentId`). Existing example rules that use
`componentId` (per the doc comment at `packages/project/src/index.ts:119-121`) keep working through the alias.
`contracts.md` should be updated to match when the `showPanel` executor is built.

The following are lower-impact and take the stated default; flag if any should change:

- **`visible` and `enabled` semantics** for attachments (section 4.2) — default: as specified there (visual kinds hidden
  when `visible: false`; disabled hosts block new starts but do not stop already-playing content).
- **Meta on the attachment vs. the asset** (section 2, two layers) — default: keep both; revisit only if authors find it
  confusing in practice.
- **Shared media budget default** (section 8, `MediaBudget`) — default: one fixed number to start, tuned from device
  testing rather than per device class, since no device-tier detection exists yet.

## Build sequence

1. **Approve this doc and the four type docs.** Decide open questions 1 to 3.
2. **Types and serializer.** Add `MediaKind`, `AssetRefKind`, `Attachment`, the four meta types and the host fields. Validation, backfill and round-trip tests in `serializer.test.ts`. Widen `AssetRef.kind`. No behaviour change.
3. **Authoring operations.** Attachment add, remove, update, reorder for objects and zones. Fix `duplicateObject` and `createScene`. Tests in `packages/authoring-engine/src/index.test.ts` that a duplicated object gets new attachment ids and no shared arrays.
4. **Assets package.** `MEDIA_KIND_SPECS`, `ContentGuardResolver`, `KindRouterResolver`, in-flight de-duplication, `DecodedCache` and `MediaBudget`, `sizeBytes` on descriptors. Add all four kinds to `resolverContract.test.ts`.
5. **App wiring.** Replace `FallbackResolver`, add `resolveAttachment` and the generalised store, add `ObjectUrlResolver` and `InlineTextResolver`.
6. **Type systems in order:** audio ([`audio-system.md`](audio-system.md)), image, text, video. Each ends with its own docs sync.
7. **Backend (Stage 3).** `text` kind, dimensions and duration columns, allowlist parity test, upload probing, `RemoteMediaResolver` body.
8. **Docs sync.** `architecture.md`, `repository.md`, `development-guide.md`, `contracts.md`, `asset-manager.md`.

### Verification

- Serializer: a file with every attachment kind round-trips; a file with none loads unchanged; duplicate attachment ids, unknown kinds, over-limit counts and oversized inline text are rejected; an unknown `assetId` loads.
- Authoring engine: duplicating an object and its subtree yields unique attachment ids and independent arrays; `createScene` copies do too; removing an object leaves no attachment anywhere in the project.
- Resolvers: `resolverContract.test.ts` runs every resolver against every kind; the guard rejects a wrong content type and an oversized descriptor; two concurrent resolves of one asset call the delegate once.
- Cache: `DecodedCache` tests for LRU, ref-count, pin, budget and in-flight sharing, with an injected clock.
- `npm test`, `npm run typecheck`, `npm run build`, and `npm install` to link each new workspace (commit `package-lock.json`; it was missed in `afc27cf`).
