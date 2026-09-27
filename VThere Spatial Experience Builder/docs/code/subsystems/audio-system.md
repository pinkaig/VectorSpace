# Audio System

**Status:** Partially implemented (2026-09-27). The core playback slice — `AudioSystem`, buses, voices, the
`WebAudioBackend`/`FakeAudioBackend`, the six registered actions, bundled-catalog (Tier A) loading, and the two-tier
(Tier A/Tier B) loading model — is built and is the closing scope for this development pass. Everything else in this
doc (spatial/360 audio, captions, ducking, mixer snapshots, playlists, reverb/occlusion, the rule-engine event
bridge, autoplay/visibility handling, metering, and any authoring UI) is a design proposal, not built, and is
explicitly deferred past this pass. See "Purpose" below for the exact built/proposed line, and "Helper builders and
When-Do authoring plan" for what exists on top of the action vocabulary.
**Baseline phase:** Post-baseline subsystem. Builds on the Asset Manager (Stage 4a/6) and the When-Do action registry. See [8-stage baseline overview](../baseline-phases.md).
**Companions:** [`attachment-integration.md`](attachment-integration.md) is the shared attachment model (project data, scene-object binding, asset kinds, resolvers, libraries) that this doc builds on. [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) covers how audio fits with the other attachment types. Sibling designs: [`image-system.md`](image-system.md), [`text-system.md`](text-system.md), [`video-system.md`](video-system.md).
**Architecture decision:** [`repository.md`](../architecture/UNDATED--FOUNDATION--repository.md) L67-69 treats a new canonical subsystem as an architectural change. This doc is the proposal for that decision; the new package is created only after it is approved.

## Purpose

Give the runtime and editor one place that plays sound: background music, sound effects, narration and ambience,
on separate channels, at the same time, with a master volume, per-sound presets, spatial (distance-based) and
360-degree audio, scrubbing, captions, and a queryable state so any other system can ask what is playing. It also
owns keeping decoded audio within a memory budget and loading it only when needed.

**2026-09-27 update:** the core playback slice below is now implemented — `packages/audio` (`AudioSystem`,
`AudioVoice`, `WebAudioBackend`/`FakeAudioBackend`, `MasterBus`/`ChannelBus`) and `registerAudioActions` (`playAudio`,
`stopAudio`, `pauseAudio`, `resumeAudio`, `setChannelVolume`, `setMasterVolume`), wired into `Viewport.tsx` for both
the editor and runtime shells. See `packages/audio/src/AudioSystem.ts`'s header comment for exactly what this slice
deliberately excludes (spatial audio, captions, mixer snapshots, ducking, retrigger gating, the rule-engine event
bridge). **This is the closing scope for this development pass** — the features above are stable and tested; what
follows in this doc beyond that slice — spatial/360 audio, captions, snapshots, the event bridge, and any authoring
UI — remains a design proposal, deferred, not built code. See "Helper builders and When-Do authoring plan" below for
what's built on top of the action vocabulary today, and "Loading audio into the app" for the two-tier (URL / IndexedDB
cache) loading model.

What exists and is reused: the `EffectRegistry` disposer contract, the `ActionRegistry`, the
`ActionSequencer`, the Asset Manager resolver and the zone tracker.

## Boundary

```text
Rule engine (packages/interaction)              Viewport / RuntimeView (src/)
  dispatch(event) -> actions[]                    camera pose each frame, object transforms,
        |                                         user gestures (pointerdown / keydown)
        | ActionRegistry.execute('playAudio', ...)        |
        v                                                 v
+---------------------------------------------------------------------------+
| packages/audio  (pure TypeScript; no React, no Three.js)                   |
|                                                                           |
|  registerAudioActions --> AudioSystem (facade)                             |
|                             |- MasterBus -> MasterLimiter -> destination   |
|                             |- ChannelBus x N (bgm | sfx | narration | ambient | custom)
|                             |     '- AudioVoice x M  (one per playing sound)
|                             |            |- AudioSource (Buffer | Stream)  |
|                             |            |- SpatialEmitter (optional)      |
|                             |            '- CaptionTrack (optional)        |
|                             |- SpatialListener   <- camera pose            |
|                             |- AudioBufferCache  <- resolve, fetch, decode |
|                             |- AudioStateStore   -> subscribe / query      |
|                             '- AudioEventBridge  -> rule engine triggers   |
|                                                                           |
|  AudioBackend (interface):  WebAudioBackend | FakeAudioBackend (tests)     |
+---------------------------------------------------------------------------+
        ^                                   |
        | AssetRef -> AssetDescriptor       | state / events
        | (packages/assets)                 v
   Asset Manager                    UI: mixer, captions, status badges
```

The Web Audio API is reached only through the `AudioBackend` interface, so all logic is unit-testable with a fake
backend and an injected clock. `packages/audio` imports `@vthere/project` types, and type-only imports from
`@vthere/assets` and `@vthere/interaction`. Per `UNDATED--FOUNDATION--tech-stack.md` L155-158 and `architecture.md`
L187 it must not import React, Three.js or FastAPI. Web Audio is a browser API, not Three.js, so it is allowed behind
the interface.

## Where to find things (planned)

| Concern | Planned owner |
|---|---|
| Facade and public API | `packages/audio/src/AudioSystem.ts` |
| Backend interface, real and fake | `packages/audio/src/backend/AudioBackend.ts`, `WebAudioBackend.ts`, `FakeAudioBackend.ts` |
| Master and channel buses, ducking, limiter | `packages/audio/src/mix/` |
| Voice and its state machine | `packages/audio/src/AudioVoice.ts` |
| Sources (buffer, stream) | `packages/audio/src/sources/` |
| Spatial listener, emitter, ambisonic decoder | `packages/audio/src/spatial/` |
| Captions | `packages/audio/src/captions/` |
| Load, decode, cache, budget | `packages/audio/src/AudioBufferCache.ts` |
| State store and queries | `packages/audio/src/AudioStateStore.ts` |
| Action executors and event bridge | `packages/audio/src/actions/` |
| Persisted user settings | `packages/audio/src/AudioSettingsStore.ts` |
| Types shared with the project file | [`packages/project/src/index.ts`](../../packages/project/src/index.ts) |
| Asset resolution for audio | [`packages/assets/`](../../packages/assets/) and [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts) |
| Camera and emitter feed, gesture unlock | [`src/Viewport.tsx`](../../src/Viewport.tsx), [`src/viewport/interactionController.ts`](../../src/viewport/interactionController.ts) |
| Effect disposal on reset | [`packages/interaction/src/actions/registry.ts`](../../packages/interaction/src/actions/registry.ts) |

## Owns

- The audio graph and the single `AudioContext`, including autoplay unlock and suspend/resume
- Channels and the mix: master, per-channel volume and mute, voice policy, ducking, limiter
- Voices: play, pause, resume, reset, stop, mute, seek, loop, fades
- Spatial audio (distance-based) and 360-degree (ambisonic) playback
- Captions: cue parsing and active-cue tracking against the voice clock
- Decoded-audio memory: cache, reference counts, LRU, byte budget, stream-vs-buffer choice
- The state store other systems query, and the events audio raises
- Executors for the audio actions, and the bridge that turns audio events into rule triggers
- Persisted user audio settings (master, channel volume, mute)

## Does not own

- Turning an `assetId` into a URL, signed URLs, or upload and storage (Asset Manager and Stage 3)
- Evaluating rules and triggers (`packages/interaction`)
- Drawing captions or the mixer (UI subscribes to the store)
- The camera and object transforms (the app feeds positions in as tuples)
- Video transport, decoding and display (the audio system only mixes a video's soundtrack; see `video-system.md`)
- Text-to-speech, output-device selection, Doppler and higher-order ambisonics (roadmap only)

## Concepts

| Term | Meaning |
|---|---|
| **Asset** | An audio file identified by `assetId`, resolved by the Asset Manager to a URL and content type. |
| **Meta** (`AudioAssetMeta`) | Authored presettings for one asset, stored on the project: channel, volume, loop, spatial config, captions and so on. |
| **Channel** | A mix group with its own volume, mute and voice policy: `bgm`, `sfx`, `narration`, `ambient`, or a custom id. |
| **Voice** | One playing (or paused, or loading) instance of an asset on a channel. Has its own transport, gain and optional emitter. |
| **Bus** | The audio node graph for master and each channel. |
| **Source** | How a voice gets samples: a decoded `AudioBuffer`, or a streamed media element. |
| **Emitter / Listener** | A sound position in the world, and the visitor's ear position and orientation. |
| **Snapshot** | A named set of channel volumes that can be applied over time (a mix preset). |

## Functionality

### 1. Master and channel mix

- One `master` volume (0 to 1) and mute. Per-channel volume and mute.
- Effective gain of a voice: `master * channel * voicePreset * fade * duck`. All changes ramp over about 20 ms
  (`AudioParam` `setTargetAtTime`) to avoid clicks.
- Volume is stored as linear 0 to 1 in data, and shown in the UI as a percentage. `gainDb` in meta is an offset in
  decibels for normalising uneven source loudness.
- **Ducking.** While any voice on a trigger channel (default `narration`) is playing, listed target channels (default
  `bgm`, `ambient`) drop by `duckAmount` (default -12 dB) with an attack and release time. Configurable per channel.
- **Master limiter.** A `DynamicsCompressorNode` set as a brick-wall limiter sits before the destination so many
  simultaneous voices do not clip.
- **Effective mute.** A voice is silent if the master, its channel or itself is muted. Muting does not stop a
  voice: a muted voice keeps advancing so it stays in sync with captions and markers.

### 2. Per-audio meta ("remember the presettings")

Stored as `ProjectData.audioAssets?: AudioAssetMeta[]` (optional and additive, so older saves load; the serializer
validates and round-trips it like `rules` and `zones`). There is no sidecar file.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `assetId` | string | required | Asset this meta belongs to |
| `name` | string | required | Display name |
| `channel` | `ChannelId` | `'sfx'` | Channel it plays on |
| `volume` | 0..1 | 1 | Preset volume, before master and channel |
| `gainDb` | number | 0 | Loudness offset in dB |
| `loop` | boolean | false | Loop playback |
| `loopStart`, `loopEnd` | seconds | whole file | Loop points for gapless loops |
| `playbackRate` | number | 1 | Speed and pitch |
| `pitchRange`, `volumeRange` | `[min,max]` | none | Random variation per play |
| `startOffset` | seconds | 0 | Where playback starts |
| `fadeIn`, `fadeOut` | seconds | 0 | Envelope on start and stop |
| `format` | `'mono' \| 'stereo' \| 'ambisonic-foa'` | detected | Channel layout |
| `spatial` | `SpatialConfig` | none | Positional settings (section 4) |
| `loadStrategy` | `'buffer' \| 'stream' \| 'auto'` | `'auto'` | How to load (section 8) |
| `preload` | `'eager' \| 'lazy'` | `'lazy'` | Load with the scene or on first play |
| `maxInstances` | number | 4 | Concurrent voices of this asset |
| `minInterval` | seconds | 0 | Cooldown between plays |
| `onRetrigger` | `'ignore' \| 'restart' \| 'stack'` | `'stack'` | What a play does when at the limit or in cooldown |
| `markers` | `{name, time}[]` | none | Named cue points (section 12) |
| `captions` | `CaptionTrackRef[]` | none | Inline cues or a caption asset, by `lang` |
| `sources` | `{assetId, contentType}[]` | none | Alternative encodings for format fallback |
| `peaks` | number[] | none | Precomputed waveform peaks for scrub bars |
| `durationHint` | seconds | none | Length, so the loader can choose buffer vs stream before download |

**Resolution order for any setting** (first defined wins): per-play override in `ActionSpec.params`, then the
attachment's `overrides` (when the play names an `attachmentId`), then `AudioAssetMeta`, then the channel default, then
the global default. Master volume is never part of meta. It is a listener-side setting and always applied on top.

**Attachments.** An audio asset is bound to an object or zone by an `AudioAttachment` on that host
([`attachment-integration.md`](attachment-integration.md) sections 3 and 4). The attachment carries no trigger; a rule
starts it (`playAudio { attachmentId }`). A positional attachment takes its emitter from the host: `spatial.objectId`
defaults to the host object's id, so an author does not repeat it. A zone attachment plays at the zone position, or
non-spatially on the `ambient` channel. A rule may still play an asset with no host (`playAudio { assetId }`), which is
how a scene soundtrack works.

### 3. Channels and simultaneous playback

Any number of voices play at once, on separate channels, sharing one clock.

| Channel | Typical use | Default policy |
|---|---|---|
| `bgm` | Music | `exclusive`: starting a track crossfades out the previous one |
| `sfx` | One-shots (clicks, footsteps) | `polyphonic`, `maxVoices` 16, steal the oldest |
| `narration` | Voice-over, playback of recorded speech | `exclusive`, ducks `bgm` and `ambient` |
| `ambient` | Room tone, loops | `polyphonic`, `maxVoices` 4, steal the quietest |

- Channels are data, so a project can add custom ids. The four above always exist.
- **Voice policy:** `exclusive` (one voice, crossfade or cut) or `{ polyphonic, maxVoices, steal: 'oldest' | 'quietest' | 'none' }`.
- **Crossfade:** curve `linear` or `equalPower`, duration per play or per channel.

### 4. Spatial audio (distance-based)

- A voice with `spatial.mode: 'positional'` is routed through a Web Audio `PannerNode` (HRTF panning) at an emitter position.
- `SpatialConfig`: `distanceModel` (`linear | inverse | exponential`), `refDistance`, `maxDistance`, `rolloff`,
  optional `cone { innerAngle, outerAngle, outerGain }`, and an anchor: `objectId` (follow a scene object) or a fixed
  `position: [x,y,z]`.
- **Emitter follows objects.** The app resolves the object's **world** position each frame with
  `composeWorldTransform` (`packages/authoring-engine/src/transformMath.ts:143`) and calls
  `audio.setEmitterPosition(voiceId, tuple)`. It looks positions up **by object id**, never by holding a mesh:
  `syncArtefacts.ts:50-52` clears and rebuilds all meshes when the object signature changes, so a node attached to a mesh
  would be destroyed.
- **Listener.** `SpatialListener` holds position, forward and up. The app updates it from the active camera in play mode
  (same per-frame block as the zone tracker: `activeCameraRef.current.getWorldPosition`, `getWorldDirection`).
- **Non-spatial** voices (`mode: 'none'`) bypass the panner and play in stereo, for music and narration.
- **Voice virtualisation.** A positional voice farther than `maxDistance` is not processed (muted and its source
  paused or skipped). It keeps its logical position, and resumes correctly if it loops.

### 5. 360 audio

Two supported forms:

1. **Logically coded 360.** A mono or stereo asset with `spatial.mode: 'positional'` placed at a fixed azimuth and
   elevation around the listener, or at world positions. This is ordinary positional audio; nothing special in the file.
2. **Ambisonic 360 (first order).** A 4-channel file in ACN channel order with SN3D normalisation (`format: 'ambisonic-foa'`).
   The soundfield is **rotated by the inverse of the listener orientation** (a 4x4 gain matrix on the channels, using
   the listener's yaw, pitch and roll), then **decoded to binaural** through a fixed set of virtual speakers (for
   example the 8 corners of a cube), each an HRTF panner. The scene therefore stays fixed in the world while the
   visitor turns their head. `AmbisonicDecoder.setOrientation(forward, up)` is called from the same per-frame listener update.

Detection: a file is treated as ambisonic only when its meta says `format: 'ambisonic-foa'`. A 4-channel file with no
such meta is played as an ordinary multichannel file, because channel count alone is ambiguous.

### 6. Transport (per voice)

| Operation | Behaviour |
|---|---|
| `play` | Resolve, load if needed, start. Returns a `VoiceHandle` immediately, even while loading. |
| `pause` / `resume` | Freeze and continue at the same position. |
| `reset` | Seek to `startOffset`, keep the current state (stays paused if paused, keeps playing if playing). |
| `stop` | End and release the voice, optionally after `fadeOut`. |
| `mute` / `unmute` | Per-voice mute; the voice keeps advancing. |
| `seek(t)` | Jump to time `t` seconds. |
| `scrub(t)` | Continuous seek while the user drags; cheap, rate-limited, keeps state. |
| `setVolume`, `setLoop`, `setRate` | Live changes, ramped where audible. |

- `currentTime` and `duration` are always available on the voice.
- **Buffer sources** cannot seek (an `AudioBufferSourceNode` starts once), so `seek` recreates the node at the new
  offset. That is fine for short sounds. **Stream sources** (media element) seek natively, so long audio scrubs smoothly.
- **State machine:** `idle -> loading -> playing <-> paused -> stopped | ended | error`. `loading` may precede
  `playing` after an autoplay unlock. Illegal transitions are ignored, not thrown.

### 7. Captions

- A caption track is a list of cues `{ start, end, text, speaker? }` for a language `lang`, loaded from a caption
  asset (a `text/vtt` or `application/json` asset resolved through the Asset Manager and parsed by `parseWebVTT` or
  as JSON cues) — see the caption-source decision under Open questions. `CaptionTrackRef.cues` stays available for a
  caller that already has parsed cues in hand; it is not the authoring path.
- The **active cue is derived from the voice clock**, not from a timer. Seeking, pausing, resetting and looping
  therefore keep captions correct with no extra logic. Overlapping cues are supported (all active cues returned).
- The audio system emits `captionChanged { voiceId, cues }`. It does **not** render. The UI subscribes and draws
  (the same pattern as `subscribeAssetResolution`).
- Multiple language tracks per asset. The active language comes from a user setting, falling back to the first track.
- The caption on/off state, size and background are user settings owned by the UI, persisted through `AudioSettingsStore`.

### 8. Loading, stability and memory

**When to load.** `preload: 'lazy'` loads on first play. `preload: 'eager'` loads when `audio.preload([...])` is called,
typically at scene start for the assets a scene's rules reference. A play before the load finishes returns a voice in
`loading`, and starts when ready. Nothing is ever fetched for an asset that is never played.

**Buffer or stream (`loadStrategy: 'auto'`).**

| Condition | Strategy | Why |
|---|---|---|
| Known or estimated duration up to 30 s **and** size up to 5 MB | `buffer` (decode fully) | Low latency, exact loops, cheap retrigger |
| Longer or larger | `stream` (`HTMLAudioElement` into `MediaElementAudioSourceNode`) | No full decode, no large allocation |
| Ambisonic (4 channels) | `buffer` | Needs sample access for the rotate and decode graph; keep such files short |

The size comes from `AssetDescriptor.sizeBytes` (proposed) or `durationHint` in meta, so the choice is made before download.

**Memory arithmetic.** `decodeAudioData` returns samples at the context rate (usually 48 kHz), as 32-bit floats:
`bytes = seconds * sampleRate * channels * 4`. One minute of stereo is about 23 MB, and 30 s of stereo is about 11.5 MB.
The default budget is **64 MB of decoded audio**, which is roughly 2.8 minutes of stereo. This is why long files stream.

**`AudioBufferCache`.** A thin wrapper over the shared `DecodedCache<AudioBuffer>` in `packages/assets`
([`attachment-integration.md`](attachment-integration.md) section 8), which supplies the ref-counting, LRU, pinning,
in-flight sharing and stats; the audio wrapper supplies the byte estimate and the decode step. The bullets below are the
behaviour of the combination.

- Steps for a request: check cache, else join an in-flight request for the same asset, else resolve (Asset Manager),
  `fetch` the bytes, `decodeAudioData`, store.
- **In-flight de-duplication:** N simultaneous requests for one asset trigger one fetch and one decode.
- **Reference counting:** each voice holds a reference while it exists. Released when the voice stops or ends.
- **LRU eviction by bytes:** when over budget, evict unreferenced buffers, least recently used first. Buffers held by a
  playing or paused voice, or pinned (`pin(assetId)`, for BGM and eager preloads), are never evicted. If nothing can
  be evicted the new load still succeeds and the cache reports `overBudget` in stats (correctness over the budget).
- **Expiry.** If the descriptor has `expiresAt` and a stream voice is long enough to outlive it, the system
  re-resolves and swaps the URL for the next seek or restart. Decoded buffers are unaffected by expiry.
- **Failure.** A failed fetch or decode yields a voice in `error` and an `audioError` event. It never throws into the
  dispatcher. `retry(assetId)` re-attempts with exponential backoff (default 3 tries, then stops until called again).
- **Formats.** Before loading, `canPlayType` picks the first playable entry from `AudioAssetMeta.sources`. Supported set:
  mp3, ogg, wav, m4a (AAC), webm (Opus).

### 9. Lifecycle and cleanup

- Every voice started by an action registers `context.effects.add(() => voice.stop())`. `resetRuntime()`,
  scene restart and unmount then stop all audio through the existing `effects.disposeAll()`
  (`resetRuntime.ts:203`; the mount cleanup calls `stopRun(false)`, `Viewport.tsx:503`).
- Long-running fades and crossfades are `ActionSequencer` generators, so `sequencer.stopAll()` cancels them, with
  cleanup in `finally` blocks.
- After a reset, non-pinned buffers drop their references and become evictable. Pinned ones stay.
- `AudioSystem.dispose()` stops everything, closes the context and clears the store. It is safe to call twice.

### 10. State manager (`AudioStateStore`)

Other systems (UI, rules, debug tools) read audio state here and never touch voices directly.

```ts
interface AudioSnapshot {
  contextState: 'suspended' | 'running' | 'closed' | 'unavailable'
  unlocked: boolean
  master: { volume: number; muted: boolean }
  channels: ChannelState[]        // { id, volume, muted, voiceCount, ducked, level? }
  voices: VoiceState[]            // see below
  cache: CacheStats
}
interface VoiceState {
  id: string; assetId: string; channel: ChannelId
  status: 'loading' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error'
  currentTime: number; duration: number | null
  volume: number; muted: boolean; loop: boolean; rate: number
  spatial: boolean; distance?: number
  captions: string[]              // active caption texts for the current language
  errorMessage?: string
}
```

- **Read.** `getSnapshot()` (stable object identity between changes, safe for `useSyncExternalStore`),
  `isPlaying(assetId)`, `isChannelPlaying(channel)`, `getVoice(id)`, `getVoicesByChannel(ch)`,
  `getVoicesByAsset(assetId)`, `getActiveCaptions(voiceId)`.
- **Subscribe.** `subscribe(listener) -> unsubscribe`, and `on(eventType, handler)`. `currentTime` is **not** pushed
  every frame. Consumers that need a live playhead call `getVoice(id).currentTime` (read on demand) or subscribe to
  the throttled `voiceProgress` event (default 10 Hz).
- **Events:** `unlocked`, `contextStateChanged`, `masterChanged`, `channelChanged`, `voiceStarted`, `voicePaused`,
  `voiceResumed`, `voiceEnded`, `voiceStopped`, `voiceError`, `voiceProgress`, `markerReached`, `captionChanged`,
  `voiceStolen`, `voiceVirtualized`.

### 11. Audio events back into the rule engine

Audio is otherwise a dead end for rules. `AudioEventBridge` forwards selected events through the app's
`emitRuntimeEvent` (`Viewport.tsx:287`) so authors can write "when the narration ends, open the door".

- Trigger strings (open vocabulary, per `contracts.md`): `audioStarted`, `audioEnded`, `audioMarker:<name>`.
  Exact strings are fixed at implementation and added to the contract doc.
- The event carries `assetId`, `voiceId` and the anchor `objectId` when the voice is bound to one, so rules can match
  by object as for other triggers. **To verify at implementation:** the dispatcher's event shape, so the payload fits
  `dispatch(event, rules, project, state)` (`dispatcher.ts:97-130`).
- `playAudio` accepts `wait: true`, for use inside an `ActionSequencer` sequence: the sequence continues when the
  voice ends. By default `playAudio` is non-blocking (per the When-Do plan).
- **Loop guard.** Bridged events are rate-limited and never re-trigger the rule that produced them in the same tick,
  to avoid an `audioEnded` -> `playAudio` -> `audioEnded` feedback loop.

### 12. Loops, markers and cue points

- `loopStart` and `loopEnd` give sample-accurate gapless looping on buffer sources (`AudioBufferSourceNode.loopStart`
  and `loopEnd`). Stream sources loop the whole file only.
- `markers[]` are named times. `markerReached` fires when the voice clock crosses one (also after a seek forward, once).
  Markers drive the `audioMarker:<name>` trigger and can sync captions, animation or rule steps to the audio.

### 13. Retrigger control

Hover and zone events can fire many times per second. `RetriggerGate` applies, per asset, `maxInstances`,
`minInterval` and `onRetrigger`:

- `ignore`: drop the new play.
- `restart`: stop the oldest instance and start the new one.
- `stack`: allow up to `maxInstances`, then steal by the channel policy.

`playAudio` may also pass `voiceKey`, a caller-chosen id so a later `stopAudio { voiceKey }` or a repeated
`playAudio { voiceKey }` addresses the same voice instead of creating another.

### 14. Variation and sound containers

- `pitchRange` and `volumeRange` randomise each play (for example footsteps at 0.95 to 1.05 rate).
- A **sound container** is a named set of assets played by rule: `random`, `roundRobin` or `sequential`, never the same
  asset twice in a row. `playAudio { containerId }` picks one.
- Randomness is injected (a seedable RNG) so tests are deterministic.

### 15. Mixer snapshots

A snapshot is a named set of channel volumes (and optionally mutes), for example `explore` and `dialogue`.
`applyMixSnapshot { name, duration }` ramps the channels to it over `duration` seconds. A scene or zone can request a
snapshot (a rule action). Snapshots are stored in `AudioSettings.snapshots` on the project.

### 16. Playlists and crossfade

- Crossfade is built in for the exclusive `bgm` channel (linear or equal-power).
- A **playlist** is an ordered or shuffled list of BGM assets. It advances on `voiceEnded`, with optional crossfade
  and a repeat mode (`none | all | one`).

### 17. Reverb and occlusion (zones)

A `ZoneDefinition` (`packages/project/src/index.ts:111-116`) may carry an audio environment: `reverbPreset`
(`none | room | hall | cave | outdoor`, implemented with a `ConvolverNode` send per channel) and `occlusion` (0 to 1,
a low-pass filter cutoff). When the listener is inside a zone (the zone tracker already knows this), the matching send
and filter are applied to spatial voices. Only the listener's current zone is used in the first version.

### 18. Accessibility

- Captions on by default when the asset has a track. Language selection, size and background contrast are user settings.
- Optional **mono downmix** for users with single-sided hearing.
- A **narration boost**: the narration channel's volume can be raised independently of the others.
- The state store exposes "a sound is playing on channel X" so the UI can show a **visual indicator** for users who
  cannot hear it.
- Never rely on sound alone for essential information; an audio event that matters should have a caption or panel.

### 19. Autoplay, visibility and power

- Browsers keep the `AudioContext` suspended until a user gesture. `AudioSystem.unlock()` resumes it and is called
  from the existing pointerdown and keydown listeners (`interactionController.ts`, event sources near L472-500).
- **Play before unlock:** requests are queued (default policy `queueUntilUnlocked`) and flushed in order on `unlock()`.
  A `sceneStart` sound therefore starts on the visitor's first click or key. If no gesture ever comes it stays silent,
  and the store shows `unlocked: false` so the UI can prompt ("click to enable sound"). Alternative policies:
  `dropUntilUnlocked`.
- **Page visibility.** On `visibilitychange` to hidden, the context is suspended (audio and clock stop); on return it
  resumes. **Idle suspend:** after a set time (default 30 s) with no playing voices, the context is suspended to save
  power and resumed on the next play.

### 20. User settings persistence

`AudioSettingsStore` saves master, channel volumes and mutes, caption preferences and language to `localStorage` under
one key, with every access wrapped in try/catch (storage can be unavailable) and defaults if it fails. Authored
defaults come from `ProjectData.audioSettings`; the stored user values layer on top. The user's preference is never
written back into the project.

### 21. Edit-mode audition

The editor may play an asset to hear it while authoring. An **audition voice** is isolated: it bypasses rule bridging
and `EffectRegistry` (it is not a runtime effect), uses its own channel, and stops on selection change or when play
mode starts. It does not fire `audioEnded` triggers.

### 22. Metering and diagnostics

- `AudioMeter` (an `AnalyserNode`) gives a per-channel and master level for a mixer UI. Metering runs only while a
  subscriber asks for it.
- `AudioSystem.getStats()` reports voice counts (total and per channel), cache bytes, budget, hits, misses, evictions,
  in-flight loads, context state, base latency and `sampleRate`. An adapter for `packages/debugging` can surface it.
  Memory management has to be observable to be trusted.

### 23. Error policy

Follows `PlaceholderAssetResolver`: never a silent blank and never an exception into the dispatcher. A failed asset
gives a `VoiceState` in `error` with a message, a `voiceError` event, and `retry(assetId)`. An unavailable Web Audio
API gives `contextState: 'unavailable'` and every call becomes a safe no-op (voices report `error`).

## Feature tiers

| Tier | Meaning |
|---|---|
| **T1** | Built in the main implementation |
| **T2** | Designed here, built after T1 if time allows |
| **T3** | Roadmap only |

| # | Feature | Tier |
|---|---|---|
| 1 | Master and channel volume, mute, smoothed gain | T1 |
| 2 | Per-audio meta on the project (presets) | T1 |
| 3 | Channels with voice policy, simultaneous playback, crossfade | T1 |
| 4 | Positional audio with distance models | T1 |
| 5 | 360 audio (positional placement and first-order ambisonic) | T1 (positional), T2 (ambisonic decode) |
| 6 | Transport: play, pause, resume, reset, stop, mute, seek, scrub | T1 |
| 7 | Captions with language tracks, derived from the voice clock | T1 |
| 8 | Buffer/stream loading, cache, ref-count, LRU, budget, in-flight dedupe | T1 |
| 9 | Effect disposal via `EffectRegistry` and `resetRuntime` | T1 |
| 10 | State store, snapshot, subscribe, queries, events | T1 |
| 11 | Audio events back into the rule engine, `wait: true` | T1 |
| 12 | Loop points and markers | T1 |
| 13 | Retrigger control, `voiceKey` | T1 |
| 14 | Master limiter and `gainDb` | T1 |
| 15 | Voice virtualisation | T1 |
| 16 | Autoplay unlock, visibility and idle suspend | T1 |
| 17 | User settings persistence | T1 |
| 18 | Diagnostics and stats | T1 |
| 19 | Error policy and retry with backoff | T1 |
| 20 | Ducking | T1 |
| 21 | Variation and sound containers | T2 |
| 22 | Mixer snapshots | T2 |
| 23 | Playlists | T2 |
| 24 | Reverb and occlusion zones | T2 |
| 25 | Accessibility extras (mono downmix, narration boost, indicators) | T2 |
| 26 | Format fallbacks (`sources[]`) | T2 |
| 27 | Edit-mode audition | T2 |
| 28 | Metering | T2 |
| 29 | Waveform peaks | T3 |
| 30 | Text-to-speech narration | T3 |
| 31 | Output-device selection, headphone detection, Doppler, higher-order ambisonics | T3 |

## Data model (additions to `@vthere/project`)

All additive and optional, so existing project files still load.

```ts
export type MediaKind = 'audio' | 'image' | 'video' | 'text'
export type AssetRefKind = AssetKind | MediaKind   // AssetRef.kind widens to this; AssetKind is unchanged
export type ChannelId = 'bgm' | 'sfx' | 'narration' | 'ambient' | (string & {})
export type Vec3 = [number, number, number]

export interface SpatialConfig {
  mode: 'none' | 'positional'
  distanceModel?: 'linear' | 'inverse' | 'exponential'
  refDistance?: number
  maxDistance?: number
  rolloff?: number
  cone?: { innerAngle: number; outerAngle: number; outerGain: number }
  objectId?: string       // follow this scene object (world position)
  position?: Vec3         // or a fixed world position
}

export interface CaptionCue { start: number; end: number; text: string; speaker?: string }
export interface CaptionTrackRef { lang: string; cues?: CaptionCue[]; assetId?: string }

export interface AudioAssetMeta { /* fields per the meta table in "Functionality, section 2" */ }

export interface AudioSettings {
  master: number
  channels: Record<ChannelId, { volume: number; muted: boolean; policy?: VoicePolicy }>
  duck?: { trigger: ChannelId; targets: ChannelId[]; amountDb: number; attack: number; release: number }
  snapshots?: Record<string, Partial<Record<ChannelId, { volume?: number; muted?: boolean }>>>
  containers?: SoundContainer[]
}

// Per-binding overrides on an AudioAttachment (see attachment-integration.md section 3). Same names and meaning as the
// meta fields, all optional; they sit between the per-play params and the asset meta in the resolution order.
export interface AudioAttachmentOverrides {
  channel?: ChannelId; volume?: number; loop?: boolean; rate?: number; gainDb?: number
  spatial?: Partial<SpatialConfig>; captions?: boolean | string
}

// ProjectData gains:  audioAssets?: AudioAssetMeta[];  audioSettings?: AudioSettings
// SceneObject and ZoneDefinition gain:  attachments?: Attachment[]  (an AudioAttachment is one kind of Attachment)
// ZoneDefinition gains: audio?: { reverbPreset?: string; occlusion?: number }
```

`AssetKind` (the placeable primitive set) is not changed, which avoids changes to `restingHeight`, `ASSET_COLORS`,
`createGeometry` and the `serializer.ts:171` allowlist.

## Class design (`packages/audio/src`)

```ts
class AudioSystem {                                    // the only object other code holds
  constructor(opts: { backend: AudioBackend; assets: AudioAssetLibrary; resolver: AssetResolver;
                      clock?: () => number; rng?: () => number; settings?: AudioSettingsStore })
  unlock(): Promise<void>
  dispose(): void
  preload(assetIds: string[], opts?: { pin?: boolean }): Promise<void>
  play(req: PlayRequest): VoiceHandle                 // returns immediately; may be 'loading'
  stop(sel: VoiceSelector, opts?: { fadeOut?: number }): void   // by voiceId | voiceKey | assetId | channel
  pause(sel): void;  resume(sel): void;  reset(sel): void;  seek(sel, t: number): void
  setMaster(v: number): void;  muteMaster(b: boolean): void
  setChannelVolume(ch: ChannelId, v: number, rampSec?: number): void;  muteChannel(ch, b): void
  applyMixSnapshot(name: string, durationSec: number): void
  setListener(pos: Vec3, forward: Vec3, up: Vec3): void            // per frame, from the camera
  setEmitterPosition(voiceId: string, pos: Vec3): void            // per frame, per bound voice
  setZoneEnvironment(env: ZoneAudio | null): void
  readonly store: AudioStateStore
  getStats(): AudioStats
}

interface PlayRequest {
  assetId?: string; containerId?: string
  channel?: ChannelId; volume?: number; loop?: boolean; rate?: number
  startAt?: number; fadeIn?: number
  spatial?: Partial<SpatialConfig>; voiceKey?: string
  captions?: boolean | string           // on/off or a language
  wait?: boolean; audition?: boolean
}
interface VoiceHandle { readonly id: string; readonly state: VoiceState;
  pause(): void; resume(): void; reset(): void; stop(fadeOut?: number): void
  mute(b: boolean): void; seek(t: number): void; scrub(t: number): void
  setVolume(v: number): void; setLoop(b: boolean): void; setRate(r: number): void
  readonly ended: Promise<void> }         // resolves on end or stop; used by wait: true
```

| Class | Responsibility |
|---|---|
| `AudioBackend` (interface) | Create context, gain, panner, sources, analyser, compressor, convolver; decode; expose clock and state. |
| `WebAudioBackend` | Real Web Audio implementation, including the ambisonic rotate and decode graph and gain ramps. |
| `FakeAudioBackend` | Deterministic, manual clock, records every call. Every unit test uses it. |
| `MasterBus`, `ChannelBus` | Gain nodes plus volume, mute and voice policy. `ChannelBus` also owns ducking rules. |
| `MasterLimiter` | Compressor configured as a limiter, before the destination. |
| `AudioVoice` | One playback instance and its state machine (`idle -> loading -> playing <-> paused -> stopped \| ended \| error`). Owns one `AudioSource`, an optional emitter, a fade envelope and a caption cursor. |
| `AudioSource` (interface) | `start(offset)`, `pause()`, `seek(t)`, `stop()`, `currentTime`, `duration`, `onEnded`. |
| `BufferSource` | Decoded `AudioBuffer`. Seek recreates the node. Supports loop points. |
| `StreamSource` | Media element through `MediaElementAudioSourceNode`. Native seek. |
| `SpatialListener` | Position, forward, up. `setFromCamera`. |
| `SpatialEmitter` | `PannerNode` wrapper, distance model, cone, per-frame position. |
| `AmbisonicDecoder` | First-order rotate matrix and virtual-speaker HRTF decode. |
| `VoiceVirtualizer` | Mutes and pauses voices beyond `maxDistance` or over the voice cap, and restores them. |
| `CaptionTrack`, `parseWebVTT` | Cues, `activeAt(t)`. Pure functions. |
| `AudioBufferCache` | Wrapper over the shared `DecodedCache<AudioBuffer>`: resolve, fetch, decode, byte estimate from real decoded length. |
| `attachMediaElement` (on `AudioSystem`) | Route an externally owned media element (video) into a channel bus. Mix controls only; the owner keeps transport. |
| `AudioAssetLibrary` | `getMeta(assetId)`; merges defaults, meta and per-play overrides. Reads `ProjectData.audioAssets`. |
| `RetriggerGate` | Applies `maxInstances`, `minInterval`, `onRetrigger`. |
| `SoundContainer` | Picks from a set by `random`, `roundRobin` or `sequential` with an injected RNG. |
| `MixSnapshot` | Named channel-volume presets and timed transitions. |
| `AudioStateStore` | Snapshot, queries, subscribe, events (section 10). |
| `AudioEventBridge` | Forwards `audioStarted`, `audioEnded`, `audioMarker:*` into `emitRuntimeEvent`, with the loop guard. |
| `AudioMeter` | Level readout, on demand. |
| `AudioSettingsStore` | `localStorage` layer over authored defaults, with a safe fallback. |
| `AudioDiagnostics` | `getStats()` plus a `packages/debugging` adapter. |
| `registerAudioActions(registry, audio, opts)` | Registers the executors below and the disposers. |

## Action vocabulary

Action kinds are open strings (`contracts.md`). The executors registered by `registerAudioActions`, with their
`ActionSpec.params`. Every executor that starts a voice registers a disposer with `context.effects.add`. Unknown or
invalid params are ignored with a logged warning, not thrown. A rule references media by `assetId`, never a raw URL.

| Kind | `params` | Effect |
|---|---|---|
| `playAudio` | `assetId` or `containerId`; optional `channel`, `volume`, `loop`, `rate`, `startAt`, `fadeIn`, `spatial`, `voiceKey`, `captions`, `wait` | Start a voice |
| `stopAudio` | one of `voiceKey`, `assetId`, `channel`; optional `fadeOut` | Stop matching voices |
| `pauseAudio`, `resumeAudio`, `resetAudio` | selector as above | Transport |
| `seekAudio` | selector plus `time` | Jump |
| `setChannelVolume` | `channel`, `volume`, optional `duration` | Ramp a channel |
| `muteChannel` | `channel`, `muted` | Mute or unmute a channel |
| `setMasterVolume` | `volume`, optional `duration` | Ramp master |
| `applyMixSnapshot` | `name`, optional `duration` | Apply a snapshot |

Note: `contracts.md` previously listed `playAudioOrVideo` as the example name; this has been aligned to `playAudio`
to match code and tests (2026-09-27).

## Helper builders and When-Do authoring plan (2026-09-27)

`packages/audio/src/actions/audioActionBuilders.ts` adds typed constructors for the six action kinds
`registerAudioActions` already registers (`playAudioAction`, `stopAudioAction`, `pauseAudioAction`,
`resumeAudioAction`, `setChannelVolumeAction`, `setMasterVolumeAction`), plus `audioRule(...)` to assemble a full
`InteractionRule` from one or more of them. These are **only** builders — they construct the same `ActionSpec`
object literals a rule author would otherwise hand-roll, typed so a typo'd param name or wrong-typed value is a
compile error instead of a silent no-op at run time (per the registry's "invalid params are ignored, not thrown"
policy). No new action kind, executor, or registry behavior was added; nothing here is wired into any UI.

This is deliberately scoped as **builders only, not authoring**. The plan for the remaining, unbuilt piece:

1. **Rule storage already exists**: `ProjectData.rules?: InteractionRule[]` (`packages/project/src/index.ts`) is
   defined and round-trips through the serializer, but nothing in the editor writes to it yet — today `rules` is
   only ever populated in tests. A "When-Do" authoring feature's data layer is therefore already there; the gap is
   entirely UI.
2. **A rule inspector panel** (not built): pick a trigger (open string vocabulary — `click`, `zoneEnter`,
   `sceneStart`, ...; see `packages/interaction`'s `InteractionRule.triggers`), optionally a target `objectId` or
   `zoneId`, then one or more actions. For an audio action, the panel would call `playAudioAction`/etc. from
   `audioActionBuilders.ts` rather than construct `{kind, params}` literals by hand, and pass the result to
   `audioRule(...)` to produce the `InteractionRule` that gets pushed into `ProjectData.rules`.
3. **An asset picker for `assetId`** (not built): reads `audioAssetCatalog` (`src/audioAssets.ts`) — see the
   "Loading audio into the app" note below — to offer authors a dropdown instead of a free-typed string. Until a
   catalog has entries, this is moot; see the loading plan.
4. **No change needed in `packages/interaction`**: `dispatch()`, `ActionRegistry`, `EffectRegistry`, and
   `ActionSequencer` are generic over action kind and already handle audio the same as any other registered
   executor (see `changeColor` in `src/viewport/actions/changeColorAction.ts` for the other existing template —
   a same-tick mutation with no cleanup — versus `playAudio`'s effect-registering, cleanup-on-reset template).
   Authoring UI is therefore the entire remaining scope; the engine underneath does not need new work.

### Loading audio into the app (built 2026-09-27)

The architecture is cloud/bundle-hosted assets, resolved one of two ways depending on the clip: fetched by URL at
play time (no device persistence), or fetched once and cached on-device in IndexedDB so replays and reloads don't
re-hit the network. Which tier an asset uses is a per-asset choice, not a global one:

- **Tier A — URL, fetched on demand:** for long-form/streaming audio (ambient beds, VO, music) — large files
  typically played once per session, where device persistence buys little and costs storage. `AudioBackend.decode(url)`
  fetches and decodes on every cache-miss play.
- **Tier B — asset itself, cached in IndexedDB:** for small/frequent clips (SFX, UI chimes, short stingers) that get
  replayed constantly. These are cheap to store whole and benefit the most from zero re-fetch latency and offline
  resilience. Still sourced from the cloud/bundle on first use — this is a cache in front of the network, not a
  replacement for it, and not the same thing as `src/userAssets.ts`'s IndexedDB store (that one persists
  *user-authored, offline-editable* imports; this one is a transparent cache the app manages and can evict or
  repopulate at will).

**The seam both tiers share is `ResolvedAudio`** (`packages/audio/src/AudioResolver.ts`), a tagged union:

```ts
export type ResolvedAudio =
  | { kind: 'url'; url: string; contentType?: string }
  | { kind: 'buffer'; data: ArrayBuffer; contentType?: string }
```

`AudioSystem.loadBuffer` (`AudioSystem.ts`) branches on `resolved.kind` and calls one of two `AudioBackend` methods —
`decode(url)` (fetch + `decodeAudioData`) or `decodeBytes(data: ArrayBuffer)` (just `decodeAudioData`, no fetch).
Both `WebAudioBackend` and `FakeAudioBackend` implement both methods; `decode(url)` on `WebAudioBackend` is now
implemented in terms of `decodeBytes` (fetch, then delegate), so there is exactly one decode path.
`bufferCache`'s in-memory LRU eviction needs no special-casing — both tiers produce the same decoded `BackendBuffer`,
cached identically, keyed by `assetId`.

Built pieces:

- **`AudioResolver.ts`:** `ResolvedAudio` is the union above. `AudioResolver`'s method signature is unchanged
  (`resolve(assetId): Promise<ResolvedAudio | null>`) — only the shape of what it resolves to grew.
- **`AudioBackend.ts` / `WebAudioBackend.ts` / `FakeAudioBackend.ts`:** `decodeBytes(data: ArrayBuffer):
  Promise<BackendBuffer>`, sharing the same `BackendBuffer` wrapper `decode()` returns. `FakeAudioBackend` gained
  `decodeBytesCallCount` and a `failDecodeBytes` test option, mirroring `decodeCalls`/`failUrls`.
- **`AudioSystem.loadBuffer`:** branches on `resolved.kind` to call `decode` or `decodeBytes`. Covered by
  `AudioSystem.test.ts`'s "decodes buffer-kind resolutions via decodeBytes" and "surfaces a decodeBytes failure..."
  cases.
- **`src/viewport/audioByteCache.ts` (new):** the IndexedDB-backed byte cache. `readCachedClip(assetId)` /
  `writeCachedClip(assetId, data, contentType, maxBytes?)` / `evictCachedClip(assetId)` /
  `clearAudioByteCache()`. One object store (`vthere-audio-cache` DB, `clips` store, keyed by `assetId`), each record
  tracking `byteLength` and `lastAccessedAt`. `writeCachedClip` evicts least-recently-*accessed* entries (reads bump
  the timestamp, not just writes) once total bytes exceed the budget (default 32 MB) — this is separate from and
  unrelated to `bufferCache`'s in-memory decoded-buffer LRU, since nothing else bounds on-disk usage. Follows
  `userAssets.ts`'s `indexedDB.open`/`onupgradeneeded`/promise-wrapped-request pattern. Not unit-tested directly
  (no `indexedDB` under the project's vitest `node` environment), matching `userAssets.ts`'s precedent — the
  testable branch logic (tier selection, decode dispatch) is covered in `packages/audio` against `FakeAudioBackend`.
- **`src/viewport/audioResolution.ts` (rewritten):** the catalog entry is now `{url, contentType?, cacheStrategy}`
  instead of a bare `ResolvedAudio`. `resolve(assetId)` returns `{kind:'url', url}` directly for `cacheStrategy:
  'url'` entries; for `'cached'` entries it checks `audioByteCache.readCachedClip` first, and on a miss fetches the
  URL itself, fires `writeCachedClip` (best-effort — a failed cache write, e.g. quota, just means the next play
  re-fetches; never fatal), and returns `{kind:'buffer', data}` for that same call so the first play doesn't pay for
  a second round-trip. This composes with the existing catalog rather than replacing it: the catalog still decides
  *which URL* an assetId maps to; `cacheStrategy` only decides what happens to those bytes after the first fetch.
- **`src/audioAssets.ts`:** `AudioAssetDefinition.cacheStrategy?: 'url' | 'cached'` (default `'url'` when omitted).
  Each catalog entry registers into `audioResolution.ts` with its chosen strategy.
- **Cloud catalog (still not built):** once a backend media endpoint exists (`RemoteMediaResolver` is presently a
  Stage-3 stub, per "Considerations" below), populate `audioResolution.ts`'s map — via `registerAudioAsset` or a
  resolver swap — from a fetched manifest instead of the static `audioAssetCatalog` array. Orthogonal to the tier
  split: the cloud catalog decides *what URL an assetId maps to*; the tier decides whether that URL's bytes also get
  cached in IndexedDB after the first fetch.
- **User import UI (still not built):** should not clone `src/userAssets.ts`'s IndexedDB approach as an *authoring*
  store — a future audio import flow uploads to the eventual backend and registers the returned URL. Tier B's
  IndexedDB use stays a distinct, app-managed cache the user never directly browses or edits, not a place authored
  content lives.

What's built, from earlier in this pass:

- **Bundled catalog:** `src/audioAssets.ts` defines `audioAssetCatalog: AudioAssetDefinition[]`, mirroring
  `src/assets.ts`'s role for models, and registers each entry into `audioResolution.ts`'s resolver map via
  `registerAudioAsset(assetId, {url, cacheStrategy})` (mirroring `registerLocalAsset`). Files ship under
  `public/audio/`; the catalog is empty until real clips are added (see `public/audio/README.md`). `Viewport.tsx`
  imports `./audioAssets` for this module-load side effect only, the same way `audioResolver` itself is imported
  there.
- **Lifecycle fixes:** `AudioVoice` disconnects its gain node on natural `ended`, not only on explicit `stop()`
  (`AudioVoice.ts`'s `onEnded` handler). `AudioSystem` reaps `ended` voices from its internal map on every
  `notify()` (previously they lived forever until an explicit stop/stopAll/dispose), and caps `bufferCache` at
  `maxCachedBuffers` (default 32), evicting least-recently-used decoded buffers that no live voice still
  references. None of this changes the public API; `AudioSystemOptions.maxCachedBuffers` is optional.

## Integration points

| Where | Change |
|---|---|
| `src/Viewport.tsx` near L278 (`createActionRegistry()`) | Create `AudioSystem` (with `WebAudioBackend`) and call `registerAudioActions(actions, audio, ...)`. Today nothing registers an executor. |
| `src/Viewport.tsx` `animate()` play-mode block, next to the zone tracker (`zoneTracker.tick`, near L447) | `audio.setListener(...)` from the active camera; `audio.setEmitterPosition(...)` for bound voices using `composeWorldTransform` by object id. |
| `src/viewport/interactionController.ts` pointerdown and keydown handlers | `audio.unlock()`. |
| `src/viewport/assetResolution.ts` `FallbackResolver` | Route `kind: 'audio'` to the catalog or remote resolver with an `audio/*` content-type check. |
| `packages/assets` | Widen `AssetRef.kind`, add `sizeBytes?`, add in-flight de-duplication (see the attachment overview). |
| `packages/project` and `src/serializer.ts` | Add the types above; validate and round-trip `audioAssets`, `audioSettings` and zone `audio`. |
| `packages/interaction` `resetRuntime` | No change: `effects.disposeAll()` already stops audio. Add a test with the real `AudioSystem` and a fake backend. |
| `emitRuntimeEvent` (`Viewport.tsx:287`) | Passed to `AudioEventBridge` as the sink. |
| RuntimeView / editor UI | A mixer and status overlay reading `audio.store` (`useSyncExternalStore`). Authoring UI to attach audio is a separate slice. |

## Considerations and limits

- **No real audio storage yet.** `RemoteMediaResolver` is a Stage 3 stub, the media routes return 501, and project JSON is capped at
  2 MB (`serializer.ts:34`). Until then audio comes from a bundled or local catalog (`public/audio/`) or a session-only
  object URL the user picks. Imported files do not persist across reloads.
- **Autoplay.** A `sceneStart` sound cannot start before a gesture. It is queued, and silent if no gesture comes. The UI
  should prompt using `unlocked: false`.
- **Buffer scrubbing is not free.** Seeking a buffer source recreates a node, which is fine for short sounds. Long
  files use stream mode. Stream mode cannot do sample-accurate loop points.
- **Ambisonics is first order only,** and needs the format stated in meta, because channel count alone is ambiguous.
  Decode quality depends on the browser's HRTF. Larger files stay in memory as buffers, so keep them short.
- **Meshes are rebuilt.** Positions are looked up by object id every frame. Never attach an audio node to a mesh.
- **Sample rate.** The context runs at the device rate (often 48 kHz) and every buffer is resampled on decode, which changes
  the memory estimate. The cache uses the real decoded length, not the file size.
- **Feedback loops.** Audio events that trigger rules that play audio can loop. The bridge rate-limits and guards
  against re-triggering the same rule in one tick, but authors can still build slow loops.
- **Voice limits.** Browsers cope with tens of concurrent voices, not hundreds. Channel `maxVoices`, retrigger control
  and virtualisation are what keep it stable.
- **Tests.** Web Audio is not available in vitest (jsdom has no `AudioContext`). All logic is tested against
  `FakeAudioBackend`. `WebAudioBackend` is a thin adapter verified manually and, if feasible, with a Playwright test.
- **Text-to-speech, device selection, Doppler and higher-order ambisonics** are not designed. Web Audio's panner no longer
  supports Doppler, so it would need custom pitch shifting.
- **Video soundtracks.** Proposed in [`video-system.md`](video-system.md) section 6: the video element's audio is routed
  through `AudioSystem.attachMediaElement(el, opts)` onto a `video` channel, so master volume, mute and ducking apply. The
  handle exposes mix controls only; transport stays with the video element, which is the clock master. An element can be
  attached to the graph once, so the video pool keeps the source node with the element. Without this addition a video
  would ignore the master mute. If the route fails (for example no CORS on the media) the element keeps native audio.
- **Volume is linear in data,** perceived loudness is not. UI sliders may use a curve; stored values stay linear.

## Open questions

**Decision (2026-09-22): Attachment binding is on the host** — `SceneObject.attachments`, `ZoneDefinition.attachments`,
started by rules, never by a trigger of its own. See `attachment-integration.md` section 4 and its "Open questions"
decision log.

**Decision (2026-09-22): Captions are separate caption assets, not inline cues.** See
`attachment-integration.md`'s "Open questions" decision log. `AudioAssetMeta`'s caption field becomes a reference to a
caption asset id, not an inline cue array.

**Decision (2026-09-22): Video soundtrack routes through this audio system**, via `attachMediaElement` (see
Considerations below and `video-system.md`). Master volume, mute and ducking apply to video the same as any other
channel; `video-system.md`'s audio port is a required dependency on `packages/audio`, not optional.

The following are lower-impact and take the stated default; flag if any should change:

1. **Trigger names and event shape** — default: `audioStarted`, `audioEnded` and `audioMarker:<name>` as proposed,
   with an event carrying an optional object id.
2. **Default budget.** 64 MB of decoded audio — default: keep as the starting number until measured against a real
   target device.
3. **Global media memory budget** (`MediaBudget` in `packages/assets`, `attachment-integration.md` section 8) —
   default: one fixed ceiling to start, per `attachment-integration.md`'s decision, not per device class.

## Build sequence

1. **Docs and decision (this doc).** Approve the design and the new `packages/audio` package.
2. **Types and project schema.** Add `MediaKind`, `AssetRefKind`, `ChannelId`, `SpatialConfig`, caption and meta types, `AudioSettings`
   and zone `audio`. Extend `serializer.ts` to validate and round-trip them, with tests in `serializer.test.ts`.
3. **Core without a browser.** Create `packages/audio` (`package.json` with `"exports": "./src/index.ts"`, depends on
   `@vthere/project`). Buses, `AudioVoice` state machine, `AudioStateStore`, `CaptionTrack`, `AudioBufferCache`,
   `RetriggerGate`, `FakeAudioBackend`, with co-located `*.test.ts` tests using an injected clock.
4. **Web Audio backend.** `WebAudioBackend`: buffer and stream sources, panner and listener, limiter, ramps, unlock,
   visibility and idle suspend. Then the ambisonic rotate and decode (T2 for the decoder).
5. **Asset integration.** Widen `AssetRef.kind`, route audio in `assetResolution.ts`, add `sizeBytes` and in-flight
   de-duplication, add audio to `resolverContract.test.ts`.
6. **Runtime wiring.** Executors and disposers, the event bridge, the per-frame listener and emitter update, gesture unlock,
   `AudioSettingsStore`.
7. **Dev surface.** A mixer and status overlay, and a demo scene with bundled clips (a mono SFX, a stereo BGM, a narration
   with captions). Authoring UI and file import are confirmed with the team before building.
8. **T2 features** in this order: variation and containers, snapshots, playlists, reverb and occlusion, accessibility extras,
   format fallbacks, audition, metering.
9. **Docs sync.** Update `asset-manager.md`, `when-do-dispatch-engine.md` (audio executors now exist), `contracts.md`,
   `architecture.md`, `repository.md` and `development-guide.md`; mark this doc's status as implemented.

### Verification

- `npm test`. Unit tests cover the voice state machine, mix maths and resolution order, ducking, the exclusive and
  polyphonic policies, retrigger gating, cache LRU, ref-counting and in-flight de-duplication, caption lookup across
  seek, pause and loop, store events, disposal through `resetRuntime`, and serializer round-trip.
- `npm run typecheck` and `npm run build`. `tsconfig.app.json` includes only `src`, so `packages/audio` is type-checked once
  `src/` imports it (step 6). Run `npm install` to link the new workspace and commit the `package-lock.json` change
  (this was missed before, in `afc27cf`).
- Manual browser check in play mode:
  - BGM, SFX and narration play together.
  - Master and channel volume and mute work.
  - Volume and panning change with distance and turning.
  - Pause, resume, reset and scrub work, and captions follow the scrub position.
  - Restart scene silences everything.
  - Repeated plays keep the cache under the budget (check `getStats()`).
  - Autoplay unlock works on the first click, and a hidden tab suspends the context.
