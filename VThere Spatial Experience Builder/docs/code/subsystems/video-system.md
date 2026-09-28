# Video System

**Status:** Design specification (2026-09-21). Nothing in this doc is implemented yet. It becomes a description of built code as each build-sequence step lands.
**Baseline phase:** Post-baseline subsystem. Builds on the attachment model, the Asset Manager (Stage 4a/6) and the audio and image systems. See [8-stage baseline overview](../baseline-phases.md).
**Companions:** [`attachment-integration.md`](attachment-integration.md) defines the attachment, the host relationship and the resolver chain this system relies on. [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) is the status map. Sibling designs: [`audio-system.md`](audio-system.md), [`image-system.md`](image-system.md), [`text-system.md`](text-system.md).
**Architecture decision:** [`repository.md`](../architecture/UNDATED--FOUNDATION--repository.md) L67-69 treats a new canonical subsystem as an architectural change. This doc is the proposal for `packages/video`; the package is created only after approval.

## Purpose

Play video in a scene and in the UI: a screen on a wall, a looping ambient display, a full-screen cutscene, a texture on
any object, and (later) a 360-degree video behind the viewer. It owns the lifecycle of the `HTMLVideoElement`s that do
the playing, a small pool that keeps the number of live decoders under what devices tolerate, transport (play, pause,
seek, loop), and a queryable state so other systems can ask what is playing.

Video is the heaviest attachment: it streams instead of decoding up front, it is limited by hardware decoders rather
than bytes, it needs a user gesture to start with sound, and it usually carries its own soundtrack that must obey the
master volume.

Today there is nothing. No `HTMLVideoElement` or `VideoTexture` exists in the repo, the `playAudio` family has no
executor (`Viewport.tsx:278` creates an empty registry), and `media_assets.kind = 'video'` is accepted by the backend
(`apps/api/app/models.py:163`) with the media routes returning 501.

## Boundary

```text
Rule engine: playVideo / pauseVideo / seekVideo / showVideo ...        Editor: inspector, poster picker
        |                                                                   |
        v                                                                   v
+---------------------------------------------------------------------------+
| packages/video  (pure TypeScript; no React, no Three.js)                   |
|                                                                           |
|  registerVideoActions --> VideoSystem (facade)                             |
|                             |- VideoPool     N element slots, LRU reuse     |
|                             |- VideoPlayer x M  one per attachment; state machine
|                             |     |- element (from VideoBackend)           |
|                             |     |- CaptionTrack (optional)               |
|                             |     '- audio route (via AudioSystem)         |
|                             |- VideoVirtualizer  pause far / hidden        |
|                             |- VideoStateStore  -> subscribe / query       |
|                             '- VideoEventBridge -> rule triggers           |
|                                                                           |
|  VideoBackend (interface):  BrowserVideoBackend | FakeVideoBackend (tests)  |
+---------------------------------------------------------------------------+
        ^ AssetRef -> AssetDescriptor         | element + state
        | (packages/assets)                   v
   Asset Manager               src/viewport/mediaSurfaces.ts: THREE.VideoTexture on a quad
                               src/ overlay layer (React): cutscene overlay, controls, captions
        audio out: element -> AudioSystem.attachMediaElement -> channel bus (master, mute, duck)
```

`VideoBackend` creates and controls the elements (`document.createElement('video')`, `play()`, `currentTime`, events).
Tests use a fake with a manual clock. The package imports `@vthere/project` and `@vthere/assets`, and only the *type*
of the audio system's attach call. Three.js work (`VideoTexture`, quads) is in `src/viewport/`
([`tech-stack.md`](../architecture/UNDATED--FOUNDATION--tech-stack.md) L155-158).

## Where to find things (planned)

| Concern | Planned owner |
|---|---|
| Facade and public API | `packages/video/src/VideoSystem.ts` |
| Backend interface, real and fake | `packages/video/src/backend/VideoBackend.ts`, `BrowserVideoBackend.ts`, `FakeVideoBackend.ts` |
| Element pool | `packages/video/src/VideoPool.ts` |
| Player and its state machine | `packages/video/src/VideoPlayer.ts` |
| Virtualisation (pause far or hidden) | `packages/video/src/VideoVirtualizer.ts` |
| Captions | `packages/video/src/captions/` (extracted to `packages/captions` when shared) |
| Source selection (`canPlayType`, capabilities) | `packages/video/src/sources.ts` |
| State store and queries | `packages/video/src/VideoStateStore.ts` |
| Action executors and event bridge | `packages/video/src/actions/` |
| Types shared with the project file | `packages/project/src/index.ts` |
| Video texture and quad rendering | `src/viewport/mediaSurfaces.ts` |
| Asset resolution | `packages/assets/`, `src/viewport/assetResolution.ts` |
| Overlay, controls, captions UI | `src/` (React) |

## Owns

- The `HTMLVideoElement` lifecycle: create, load, play, release, and the pool that limits how many are live
- Transport per video: play, pause, resume, reset, stop, seek, scrub, loop, rate, mute
- The state machine per video and the state store other systems query
- Source selection from the alternatives an asset offers
- Captions for video (cue tracking against the video clock)
- Pausing videos that are far away, hidden or in a background tab
- Executors for the video actions, and the bridge that turns video events into rule triggers
- Routing the video's soundtrack into the audio system

## Does not own

- Turning an `assetId` into a URL, signed URLs, upload, transcoding and storage (Asset Manager and Stage 3)
- Creating `THREE.VideoTexture`, materials or meshes (`src/viewport/`)
- Drawing controls, the overlay or captions (React)
- Mixing: the soundtrack's gain, mute, ducking and spatialisation belong to the audio system
- Evaluating rules (`packages/interaction`)
- Live streaming, WebRTC and video calls (out of scope; the tech stack forbids real-time transport)
- Third-party embeds such as YouTube iframes

## Concepts

| Term | Meaning |
|---|---|
| **Video asset** | An MP4 or WebM file identified by `assetId`, resolved by the Asset Manager to a URL and content type. |
| **Meta** (`VideoAssetMeta`) | Reusable settings for one asset on the project: poster, dimensions, duration, projection, defaults, captions, alternative sources. |
| **Attachment** (`VideoAttachment`) | A binding of a video to a host with a `presentation` and optional playback overrides. Defined in `attachment-integration.md`. |
| **Player** | One video's playback instance and state machine. Exists per attachment that has been started or preloaded. |
| **Slot** | One live decoder-backed element in the pool. A player needs a slot to play; without one it shows its poster. |
| **Presentation** | `surface` (texture on a world quad), `billboard`, `overlay` (full-screen or windowed DOM), `background` (a 360 sphere). |
| **Poster** | A still image shown before play, when paused without a slot, or on error. It is an image asset. |

## Functionality

### 1. Loading and streaming

1. The caller asks `video.play(request)` (or `preload`). The system builds an `AssetRef { assetId, kind: 'video' }` and resolves it through the injected `AssetResolver`.
2. `sources.ts` picks the best source: `meta.sources[]` in order, filtered by `canPlayType` and, where available, the `MediaCapabilities` API (decoding support and smoothness). It falls back to the primary asset.
3. A slot is acquired (section 3). The element is configured: `preload = 'metadata'` (or `'auto'` for an imminent play), `playsInline = true`, `crossOrigin = 'anonymous'`, `src = descriptor.url`.
4. The element streams with HTTP range requests. Nothing is decoded into memory up front, which is why video has no decoded-byte budget, only a slot limit.
5. `loadedmetadata` provides `duration`, `videoWidth` and `videoHeight`; the store is updated. `canplay` moves the player to `ready`.

Loading is lazy: no element exists for a video until it is shown, played or preloaded, and `preload(ids)` on scene load
fetches **metadata only** for videos likely to play soon.

**Range requests and CORS.** The media server (MinIO or S3 behind a presigned URL) must support range requests and send
CORS headers. `crossOrigin = 'anonymous'` is required both for WebGL to accept the frame as a texture and for the audio
route (section 6); without matching headers the texture upload fails and the routed audio is silent. This is a Stage 3
infrastructure requirement, listed under considerations.

### 2. Transport and the state machine

```text
idle -> loading -> ready -> playing <-> paused -> ended
                     \         |  ^
                      \        v  |
                       '---- buffering
any state -> error        any state -> stopped (element released)
```

| Operation | Behaviour |
|---|---|
| `play` | Acquire a slot if none, then `element.play()`. Handles the returned promise: a rejection (autoplay policy) sets `blocked`, not `error`, and queues the play for `unlock()`. |
| `pause`, `resume` | Native. State follows the element's events, not the call, so the store never disagrees with the element. |
| `reset` | Seek to 0 and pause; the player stays ready and keeps its slot. |
| `stop` | Pause, release the slot (`removeAttribute('src')`, `load()`), state `stopped`. |
| `seek(t)`, `scrub(t)` | Set `currentTime`, clamped to `[0, duration]`. `scrub` is `seek` while the user drags: it coalesces updates and uses the element's `fastSeek` where available, then does a precise seek on release. |
| `setLoop`, `setRate` | Native `loop` and `playbackRate`. |
| `mute` | Sets the element `muted` when there is no audio route; otherwise mutes the routed voice (section 6). |
| Ended | `ended` sets state and emits `videoEnded`; a looping video never reaches it. |

`currentTime` and `duration` are read from the element on demand and cached in the store on `timeupdate` (about 4 Hz)
and on each rendered frame when a surface is showing it. The scrub bar polls `getTime(id)`, not the store, so it stays
smooth without flooding subscribers.

### 3. The pool and device limits

Browsers, especially on mobile, allow only a few simultaneous hardware video decoders, and creating more silently
freezes or blanks some of them. `VideoPool` caps the live elements.

| Setting | Starting value | Behaviour |
|---|---|---|
| `maxPlaying` | 2 on mobile-class devices, 4 on desktop | Number of players that may be `playing` at once |
| `maxSlots` | `maxPlaying + 2` | Number of elements alive, including paused ones kept warm |
| Reuse | LRU | When a play needs a slot and none is free, the least recently used paused or ready element is recycled: its player falls back to the poster and reports `released` |
| Priority | `overlay` > `surface` near the viewer > `surface` far | Decides which player is denied when `maxPlaying` is exceeded |

A player denied a slot does not fail: it shows its poster, reports `state: 'waiting'` and starts when a slot frees. These
are tuning numbers to set from a target device, not decisions.

### 4. Presentation

| Mode | Rendered by | Notes |
|---|---|---|
| `surface` | `THREE.VideoTexture` on a quad, child of the host mesh | Sized in world units; aspect from meta. Uses the poster while not playing. |
| `billboard` | The same quad, always facing the viewer | Small displays and icons. |
| `overlay` | React: a `<video>` styled as a full-screen cutscene or a window | Skip button, optional pause of interaction behind it. The pooled element is moved into the overlay DOM, not duplicated. |
| `background` (T2) | Inside-out sphere with an equirectangular `VideoTexture` | 360 video, viewed on screen (WebXR is out of scope per the tech stack). Heavy: keep at or under 4096 x 2048 and never on the mobile tier by default. |

```ts
export interface VideoPresentation {
  mode: 'surface' | 'billboard' | 'overlay' | 'background'
  fit?: 'contain' | 'cover' | 'stretch'
  size?: [number, number]              // world units, surface and billboard; omitted = derive from aspect
  offset?: [number, number, number]    // host-local, surface only
  rotation?: [number, number, number]
  showControls?: boolean               // overlay only
  skippable?: boolean                  // overlay only; shows a skip control
  blocksInteraction?: boolean          // overlay only: pause scene input while it plays
  opacity?: number
}
```

**Texture updates.** A `VideoTexture` re-uploads every frame by default. Where `requestVideoFrameCallback` exists the
renderer updates the texture only when the video produces a new frame, so a 24 fps video does not upload at the display
refresh rate. Colour space is sRGB. Mipmaps are off (they are costly to regenerate per frame).

**Poster.** The poster is an ordinary image asset resolved by the image system. It is what a surface shows before
playing, while waiting for a slot, when paused and released, and on error. Without a poster a paused, released surface
shows a dark frame.

### 5. Autoplay and user gestures

Browsers block playback with sound before a user gesture. Rules:

- A video may autoplay **muted**, with `playsInline`, without a gesture in most browsers. Meta `autoplayMuted: true` uses this for ambient screens.
- A video with sound waits for `unlock()`, which the interaction controller calls on the first `pointerdown` or `keydown`, the same hook the audio system uses ([`attachment-integration.md`](attachment-integration.md) section 8). Until then its state is `blocked` and the UI can show a "click to start" prompt from `unlocked: false`.
- A rule-triggered play that follows a click (an `objectClick` rule) is inside a gesture already and works.
- If `play()` is rejected the system does not retry in a loop; it waits for the next unlock.

### 6. The soundtrack and the audio system

The audio design left this open: a video's sound stays in the element and so ignores the master volume, channel mute
and ducking ([`audio-system.md`](audio-system.md) considerations). That would be noticed immediately, since a master
mute that leaves the video loud is a bug to a visitor.

**Proposal: route the element's audio through the audio system.**

- `AudioSystem` gains `attachMediaElement(el, opts) -> MediaVoiceHandle`, which wraps the element in a `MediaElementAudioSourceNode` (an element can be attached to the graph only once, so the pool keeps the node with the element) and connects it to a channel bus: default channel `video`, a new custom channel that inherits master volume and mute, with the same `ChannelBus` policy and ducking hooks as the built-in channels.
- The handle exposes only **mix** controls: `setVolume`, `mute`, `setChannel`, optional `spatial` (a positional screen, using the host's world transform looked up by id each frame). **Transport stays with the video element**, so there is no second clock to fight; the audio side follows the element.
- Meta `volume`, `channel` and `spatial` on `VideoAssetMeta` are the same concepts as on `AudioAssetMeta` and resolve in the same order (rule params > attachment overrides > meta > channel default).
- `VideoPlayer` releases the handle on stop, or when the pool recycles the slot.
- **Fallback:** if the audio system is absent or the route fails (for example no CORS on the media), the element keeps its native audio at `element.volume`, the store reports `audioRouted: false`, and a warning is logged. Nothing throws.

This is a proposal that changes the audio design; it is recorded there as well and listed under open questions.

### 7. Captions and subtitles

- Cue tracks are `CaptionTrack` and `parseWebVTT`, first built in `packages/audio` and extracted to `packages/captions` when video is the second consumer ([`attachment-integration.md`](attachment-integration.md) section 1). The active cue is derived from the video's `currentTime`, so it follows seek, pause and loop.
- Inline cues or a caption asset per language (`captions: CaptionTrackRef[]` on the meta), the same type as audio.
- Displayed through the overlay layer (React), not through the browser's native `<track>` rendering, so styling, position and the user's size and contrast settings apply the same way to audio and video. `TextTrack` is not used for display; it stays available if the team prefers native captions.
- Burnt-in subtitles cannot be turned off or restyled. Authors should prefer a caption track; the doc records this as guidance.
- Emits `captionChanged` to the store, like audio. It does not render.

### 8. State store (`VideoStateStore`)

```ts
interface VideoSnapshot { videos: VideoStatus[]; slots: { used: number; max: number }; unlocked: boolean }
interface VideoStatus { attachmentId: string; assetId: string;
  state: 'idle'|'loading'|'ready'|'waiting'|'playing'|'paused'|'buffering'|'ended'|'stopped'|'blocked'|'error'
  currentTime: number; duration?: number; muted: boolean; loop: boolean; rate: number
  width?: number; height?: number; audioRouted: boolean; activeCaption?: string; errorMessage?: string }
getSnapshot(): VideoSnapshot
subscribe(listener): () => void
isPlaying(attachmentIdOrAssetId): boolean
getVideo(attachmentId): VideoStatus | undefined
getTime(attachmentId): { currentTime: number; duration?: number }     // read on demand, not through the store
```

Events: `videoLoading`, `videoReady`, `videoStarted`, `videoPaused`, `videoResumed`, `videoEnded`, `videoBuffering`, `videoBlocked`, `videoError`, `captionChanged`, `unlocked`.

### 9. Events back into the rule engine

`videoStarted`, `videoEnded` and `videoMarker:<name>` (T2) are forwarded to `emitRuntimeEvent` (`Viewport.tsx:287`) by
`VideoEventBridge`, with the same loop guard as the audio bridge. An action with `wait: true` returns a promise that
resolves on end or stop, so an `ActionSequencer` step can wait ("play the intro video, then open the door"). This is
what stops video from being a dead end for the rule engine.

### 10. Lifecycle and cleanup

| Event | What happens |
|---|---|
| Play or show | Acquire a slot and a player; register `effects.add(() => player.stop())` |
| Hide (surface) | Pause and, if configured, release the slot; the surface shows the poster |
| Host removed or scene change | `resetRuntime` calls `disposeAll()`; every player stops and its slot is released |
| Tab hidden | All playing videos pause and are resumed on return (only those the system paused, not the ones the user paused) |
| Far from the viewer (surface) | `VideoVirtualizer` pauses the player beyond `maxDistance`, or when the host is off screen, and resumes it later; a looping ambient screen resumes where it was, not at a wall-clock position |
| Recycle | Element released: pause, `removeAttribute('src')`, `load()`, audio handle released, texture told to fall back to the poster |
| Dispose | `VideoSystem.dispose()` stops everything, empties the pool and unsubscribes |

Releasing an element correctly matters: setting `src = ''` triggers an error event in some browsers, so the sequence is
`pause()`, `removeAttribute('src')`, `load()`, and the error handler ignores events after a player is marked released.

### 11. Editor use

- **Inspector.** Poster picker, presentation, loop, autoplay-muted, channel and volume, captions, and the projection (`flat` or `equirect360`).
- **Preview.** Selecting a video attachment previews it in the inspector with its own element and no runtime effects or rules. It counts against the pool while open.
- **Import.** A file becomes a session-only `blob:` URL until Stage 3. A large file is refused at the size limit; the doc records that browser-side transcoding is not planned.
- **Poster generation (T2).** Capture a frame with a canvas at a chosen time and store it as an image asset. Requires CORS for the same reason as textures.
- **Lint.** Missing poster, missing captions on a video with audio, resolution above the tier's cap, and unsupported codec.

### 12. Accessibility and comfort

- **Captions** for any video with speech; the editor lints when a video has audio and no track.
- **No flashing content.** Authors are responsible, but the editor can warn on very short loops of high-contrast footage (not automated in T1).
- **Reduced motion.** With `prefers-reduced-motion`, autoplaying ambient videos are shown paused on the poster until the visitor starts them.
- **Controls** in overlays are keyboard-reachable buttons with labels; Space toggles play and Escape skips a skippable cutscene.
- **Audio description** as an alternative track is a T3 item.
- **Data use.** Video is the largest download. A visitor setting "reduce data" (T2) disables autoplay and preload.

### 13. Security and privacy

- **Assets only from the manager.** No raw URLs from authors, no third-party embeds (iframes to YouTube or Vimeo would break the CSP, leak visitor data and bypass the manager).
- **Allowlist:** `video/mp4` and `video/webm`. The backend checks magic bytes and, in Stage 3, probes with `ffprobe` for real duration, codec and dimensions; the client does not trust an extension.
- **Metadata privacy.** Uploaded video may contain GPS and device metadata; strip at upload (Stage 3).
- **Element hygiene.** Elements are created only by the pool, never from author-supplied markup.
- **Analytics.** If playback events are ever sent to the analytics API, they carry attachment ids and coarse progress, never file names or author text.

## Feature tiers

| # | Feature | Why | Tier |
|---|---|---|---|
| 1 | Element pool, player state machine, lazy load, poster | Core and stability | T1 |
| 2 | `surface` and `overlay` presentation, `VideoTexture` updates | Core | T1 |
| 3 | Transport: play, pause, resume, reset, stop, seek, scrub, loop, rate | Requested behaviour, matches audio | T1 |
| 4 | Autoplay handling: muted autoplay, unlock queue, `blocked` state | Browser policy | T1 |
| 5 | Soundtrack routed through the audio system (`attachMediaElement`) with native fallback | Master volume and mute apply to video | T1 |
| 6 | State store, events, event bridge, `wait: true`, disposal through `EffectRegistry` | Integration | T1 |
| 7 | Tab-hidden pause, distance and visibility virtualisation | Stability and battery | T1 |
| 8 | Captions from cue tracks, language | Accessibility | T1 |
| 9 | Error state, retry with backoff | Stability | T1 |
| 10 | `billboard` presentation | Icons and small displays | T2 |
| 11 | `requestVideoFrameCallback` texture updates | Less GPU upload | T2 |
| 12 | Alternative sources with capability probing | Cross-browser codec support | T2 |
| 13 | Markers and cue points (`videoMarker:<name>`) | Rule hooks mid-video | T2 |
| 14 | `background` 360 video | Immersive content | T2 |
| 15 | Poster generation from a frame; "reduce data" setting | Editor and data use | T2 |
| 16 | Adaptive streaming (HLS) via `hls.js` | Bandwidth adaptation | T3 |
| 17 | Audio description track, multiple audio tracks | Accessibility | T3 |
| 18 | Spatial video screens with the soundtrack positional at the host | Realism | T3 (audio route supports it; authoring UI later) |

## Data model (additions to `@vthere/project`)

Additive and optional. `VideoAttachment` and the host fields are in `attachment-integration.md` section 3.

```ts
export interface VideoAssetMeta {
  assetId: string
  name: string
  posterAssetId?: string               // an image asset
  width?: number; height?: number      // pixels; layout and tier check before load
  durationMs?: number
  projection?: 'flat' | 'equirect360'
  hasAudio?: boolean
  autoplayMuted?: boolean
  loop?: boolean
  volume?: number                      // relative to its channel, 0..1 (same meaning as AudioAssetMeta)
  channel?: ChannelId                  // default 'video'
  spatial?: SpatialConfig              // same type as audio; positional screens
  captions?: CaptionTrackRef[]         // same type as audio
  markers?: { name: string; time: number }[]
  sources?: { assetId: string; contentType: string; width?: number; bitrate?: number }[]   // alternatives
  credit?: string
}
export interface VideoAttachmentOverrides {
  loop?: boolean; volume?: number; muted?: boolean; rate?: number; startAt?: number; captions?: boolean | string
}
// ProjectData.videoAssets?: VideoAssetMeta[]      SceneObject.attachments and ZoneDefinition.attachments may hold VideoAttachment
```

Video reuses `ChannelId`, `SpatialConfig` and `CaptionTrackRef` from the audio types rather than defining parallel ones.

## Class design (`packages/video/src`)

```ts
class VideoSystem {                                          // the only object other code holds
  constructor(opts: { backend: VideoBackend; assets: VideoAssetLibrary; resolver: AssetResolver;
                      audio?: MediaAudioPort; clock?: () => number; limits?: Partial<VideoLimits> })
  unlock(): Promise<void>
  dispose(): void
  preload(atts: VideoAttachment[]): Promise<void>              // metadata only
  play(req: VideoPlayRequest): VideoHandle                     // returns at once; may be 'loading' or 'waiting'
  stop(sel: VideoSelector): void
  pause(sel): void;  resume(sel): void;  reset(sel): void;  seek(sel, t: number): void
  show(attachmentId: string): void;  hide(attachmentId: string): void
  setVisibilityHint(attachmentId: string, hint: { distance: number; onScreen: boolean }): void   // per frame, from src/
  readonly store: VideoStateStore
  getStats(): VideoStats
}
interface VideoPlayRequest { attachmentId?: string; assetId?: string
  loop?: boolean; volume?: number; muted?: boolean; rate?: number; startAt?: number; captions?: boolean | string
  presentation?: Partial<VideoPresentation>; wait?: boolean; audition?: boolean }
interface VideoHandle { readonly id: string; readonly state: VideoStatus['state']
  readonly element?: unknown                                    // opaque to the package; src/ passes it to VideoTexture
  pause(): void; resume(): void; reset(): void; stop(): void
  seek(t: number): void; scrub(t: number): void; setLoop(b: boolean): void; setRate(r: number): void; mute(b: boolean): void
  readonly ended: Promise<void> }                               // resolves on end or stop; used by wait: true
// The audio dependency is an interface, so this package needs no runtime import of packages/audio:
interface MediaAudioPort { attachMediaElement(el: unknown, opts: MediaAudioOptions): MediaVoiceHandle }
```

| Class | Responsibility |
|---|---|
| `VideoBackend` (interface) | `createElement()`, `load(el, url)`, `play(el)`, `release(el)`, event subscription, `canPlayType`, capability probe, and a clock. |
| `BrowserVideoBackend` | Real `HTMLVideoElement` implementation, including the safe release sequence and `requestVideoFrameCallback`. Thin. |
| `FakeVideoBackend` | Deterministic, manual clock, scriptable events (`canplay`, `ended`, `error`), records calls. All unit tests use it. |
| `VideoPool` | Slots, `maxPlaying`, LRU reuse, priority, `waiting` queue. |
| `VideoPlayer` | One video's state machine and transport; owns its caption cursor and its audio handle. |
| `VideoVirtualizer` | Pauses and resumes players from visibility hints; remembers which pauses it caused. |
| `sources.ts` | Picks a source from `sources[]` using the backend's `canPlayType` and capability probe. |
| `VideoAssetLibrary` | `getMeta(assetId)`; merges defaults, meta and overrides. Reads `ProjectData.videoAssets`. |
| `CaptionTrack`, `parseWebVTT` | Shared with audio (see the captions note). |
| `VideoStateStore` | Snapshot, queries, subscribe, events (section 8). |
| `VideoEventBridge` | Forwards `videoStarted`, `videoEnded`, `videoMarker:*` to `emitRuntimeEvent` with the loop guard. |
| `registerVideoActions(registry, video, opts)` | Registers the executors below and the disposers. |
| **In `src/viewport/` (Three.js):** `VideoSurfaceRenderer` | `THREE.VideoTexture` from the handle's element, poster fallback, per-frame update, part of the shared `SurfaceRenderer`. |
| **In `src/` (React):** `VideoOverlay` | Cutscene and windowed overlay, controls, skip, and captions. |

## Action vocabulary

Every executor that starts a video registers a disposer with `context.effects.add`. Unknown or invalid params are ignored
with a logged warning, not thrown. Media are referenced by `attachmentId` or `assetId`, never a raw URL.

| Kind | `params` | Effect |
|---|---|---|
| `playVideo` | `attachmentId` or `assetId`; optional `loop`, `volume`, `muted`, `rate`, `startAt`, `captions`, `presentation`, `wait` | Start playing. With `wait: true` the action's promise resolves when the video ends or stops. |
| `pauseVideo`, `resumeVideo`, `stopVideo` | `attachmentId`, `assetId`, or `all: true` | Transport |
| `seekVideo` | selector plus `time` | Jump |
| `showVideo`, `hideVideo` | `attachmentId` | Show or hide the surface or overlay without changing playback intent |

`contracts.md` lists `playAudioOrVideo` as an example; these docs use separate audio and video kinds and `contracts.md`
should be aligned when the first executor lands ([`attachment-integration.md`](attachment-integration.md) section 9).

## Integration points

| Where | Change |
|---|---|
| `packages/project`, `src/serializer.ts` | `VideoAssetMeta`, `VideoAttachment`, validation and round-trip. See `attachment-integration.md`. |
| `packages/assets` | Video entries in `MEDIA_KIND_SPECS` (mp4, webm; slot-limited, not byte-budgeted), content guard, kind router. |
| `packages/audio` | Add `attachMediaElement` and the `video` channel default (recorded in `audio-system.md`). |
| `src/viewport/assetResolution.ts` | Route `kind: 'video'`; `resolveAttachment`. |
| `src/Viewport.tsx` near L278 | Create `VideoSystem` (with the audio port), `registerVideoActions`. Pass project-level `videoAssets` in as a new prop, like `rules` (`Viewport.tsx:318`). |
| `src/Viewport.tsx` `animate()` play-mode block (near `zoneTracker.tick`, L447) | Feed `setVisibilityHint` per surface video: distance to the camera and an on-screen test. |
| `src/viewport/interactionController.ts` | `video.unlock()` beside the audio unlock; raycast hits on video quads carry `userData.entityId` and `userData.attachmentId`. |
| `src/viewport/syncArtefacts.ts` | Surfaces are re-created on each rebuild, so the pooled element and `VideoTexture` must live outside the group and be referenced from it, or the video restarts on every edit. |
| Overlay layer | `VideoOverlay`, captions and a "click to start" prompt read `video.store`. |
| Backend / infrastructure (Stage 3) | Range requests and CORS on the media bucket, `ffprobe` probing for duration and dimensions. |

## Considerations and limits

- **Decoders, not bytes, are the constraint.** The pool caps live elements. A scene with many video screens works only because far or hidden ones are paused and show posters. Test on a real phone.
- **The element must survive a rebuild.** `syncArtefacts` disposes and rebuilds every mesh on each sync (`syncArtefacts.ts:49-52`). The pool owns elements and textures outside the group; if they were tied to a mesh the video would restart on every author edit and every selection change.
- **CORS is mandatory.** No CORS means no WebGL texture and silent routed audio. Same-origin `public/` demo files work; the Stage 3 bucket needs a CORS rule.
- **Autoplay is not reliable.** Treat `blocked` as a normal state with a visible prompt, not an error.
- **Codecs.** H.264 with AAC in MP4 is the safe baseline; VP9 or AV1 in WebM saves size where supported; HEVC is unreliable. Probe with `canPlayType` and `MediaCapabilities` and provide `sources[]` where it matters (verify current support tables before promising formats).
- **Resolution caps.** 1080p for surfaces, and less on the mobile tier; 4K only for 360 on capable devices. A 1920 x 1080 frame is about 8 MB as a GPU texture per playing video, plus the decoder's own buffers, which JavaScript cannot see.
- **Seeking depends on the file.** Fast, accurate seeking needs frequent keyframes; the doc recommends a keyframe interval of a couple of seconds for scrubbable content, and `fastSeek` is only a hint.
- **The routed soundtrack changes the audio design.** It adds a `video` channel and `attachMediaElement`, and an element can be attached to the audio graph only once. The pool therefore keeps the source node with the element for its whole life.
- **Two clocks.** The element is the clock master for video and its soundtrack. The audio system must not seek or pause a routed voice; it only mixes it.
- **Live and remote video are out of scope.** No streaming from URLs the author types in, no WebRTC.
- **Memory leaks are easy.** An unreleased element keeps a decoder. Every start registers a disposer, the pool asserts its slot counts in `getStats()`, and the disposal test in `resetRuntime` covers it.
- **Storage is not real yet.** Until Stage 3, video comes from `public/` or a session `blob:` URL, and a project that references a missing one must show the poster or a dark frame, not fail to load.
- **Two renderers.** `ReferenceViewport.tsx` builds its own meshes and would not show video surfaces unless decided otherwise.
- **Tests.** jsdom cannot decode or play video. All logic runs against `FakeVideoBackend`; the texture path and real playback are verified in the browser, including on a phone.

## Open questions

**Decision (2026-09-22): Route the soundtrack through the audio system.** Confirmed; see `audio-system.md`'s "Open
questions" decision log. The audio port (`attachMediaElement`) is a required dependency for video's soundtrack, not
optional — video's build sequence should not schedule ahead of the audio package landing.

**Decision (2026-09-22): An overlay/cutscene video pauses the runtime** (rules, zone tracker), not just input. See
`attachment-integration.md`'s "Open questions" decision log. This needs a pause hook exposed from `resetRuntime`/the
dispatcher (section on runtime wiring) before a cutscene executor can be built correctly; the dispatch engine doc
should record that hook when it exists.

**Decision (2026-09-22): Captions are separate caption assets, not inline.** Follows `audio-system.md`'s caption
decision, since video captions reuse `packages/captions`' cue types once extracted.

The following are lower-impact and take the stated default; flag if any should change:

1. **Slot limits per device tier** — default: no tier detection at first; one fixed `maxPlaying` number, tuned from
   testing, until a real need for tiering appears.
2. **Adaptive streaming** — default: progressive MP4/WebM is enough for the MVP, per this doc's recommendation; add
   `hls.js` only if a concrete long-clip case needs it.
3. **Poster source** — default: author-supplied image asset (this doc), with auto-generated frame deferred to T2.
4. **Native vs. custom captions** — default: custom overlay captions, as proposed, so overlay and in-world captions
   render identically; revisit only if the custom renderer proves harder to maintain than `<track>`.
5. **Where captions are extracted to** — not actually open: `packages/captions`, split from `packages/audio`'s
   `CaptionTrack`/`parseWebVTT` when video becomes the second consumer, per the shared-code rule in
   `attachment-integration.md` section 1. No decision needed; this is already the design.

## Build sequence

1. **Approve this doc** and the shared attachment model. Decide the soundtrack routing and cutscene questions.
2. **Shared work first** ([`attachment-integration.md`](attachment-integration.md) build steps 2 to 5): types, serializer, kind specs, router, guard. Audio and image systems land before video, so `attachMediaElement`, captions and the poster image path exist.
3. **Extract captions** to `packages/captions` (audio's `CaptionTrack` and `parseWebVTT`), with a re-export from audio.
4. **Core without a browser.** Create `packages/video` (`package.json` with `"exports": "./src/index.ts"`, depends on `@vthere/project` and `@vthere/assets`). `VideoPool`, `VideoPlayer` state machine, `VideoVirtualizer`, `sources.ts`, `VideoStateStore`, `FakeVideoBackend`, with co-located `*.test.ts` and an injected clock.
5. **Browser backend.** `BrowserVideoBackend`: element creation, safe release, autoplay handling, `canPlayType`.
6. **Rendering.** `VideoSurfaceRenderer` in `src/viewport/` with poster fallback; `VideoOverlay` in `src/`; per-frame visibility hints from `animate()`.
7. **Runtime wiring.** Executors and disposers, event bridge, unlock, project-level `videoAssets` prop, audio port.
8. **Dev surface.** A demo scene with a small looping muted screen, a cutscene overlay with sound and captions, and a scene with more screens than `maxPlaying` to prove the pool and virtualisation.
9. **T2 features** in this order: `requestVideoFrameCallback` updates, alternative sources, markers, `billboard`, 360 background, poster generation and reduce-data.
10. **Docs sync.** `asset-manager.md`, `audio-system.md`, `architecture.md`, `repository.md`, `development-guide.md`, `contracts.md`; mark this doc's status as implemented.

### Verification

- `npm test`. Unit tests cover: the state machine including `blocked`, `waiting` and `buffering`; pool slot limits, LRU reuse and priority with the fake backend; the release sequence (no events acted on after release); virtualiser pause and resume that resumes only its own pauses; source selection with scripted `canPlayType`; caption lookup across seek, pause and loop; store events; `wait: true` resolution on end and on stop; disposal through `resetRuntime`; the audio-route fallback when the port is absent or throws; serializer round-trip of `videoAssets` and video attachments.
- `npm run typecheck` and `npm run build`. `tsconfig.app.json` includes only `src`, so `packages/video` is type-checked once `src/` imports it (step 7). Run `npm install` to link the workspace and commit the lockfile.
- Manual browser check, including a phone: a surface video plays and follows its host; master mute silences it; scrubbing works; a click starts a video with sound while a muted ambient one autoplays; more screens than `maxPlaying` degrade to posters instead of freezing; walking away pauses far screens and returning resumes them; an author edit does not restart a playing video; restart scene stops everything and releases every slot (`getStats()`); a media URL without CORS fails visibly rather than as a black quad with silent audio.
