# Audio System

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

> **Status of this page.** Seventeen source files in `packages/audio/` and
> `src/` already linked to a subsystem guide at this path before one existed.
> This page records what the code does today so those links resolve. It is
> written from the implementation, not from a design document, and the
> "Feature tiers" table that several file headers cite is reconstructed here
> from the exclusions those headers state.

## 1. Overview

The audio system plays sound in the authored experience. It owns a small mixer
(one master bus, four named channels), a pool of voices, asset resolution from
project data, and a queryable state store the UI reads for playback status.

Browsers block audio until the user interacts with the page. The system takes
this as a first-class state rather than an error: calls made before unlock are
queued and flushed once a gesture arrives.

## 2. Core classes

| File | Responsibility |
|---|---|
| `AudioSystem.ts` | The only audio object other code holds. Composes the buses, voices, resolver, and state store. |
| `AudioVoice.ts` | One playing sound: start, stop, pause, resume, volume. |
| `AudioAssetLibrary.ts` | Maps project asset references to playable buffers, with play overrides. |
| `AudioResolver.ts` | Turns an asset reference into bytes, via the shared asset resolver chain. |
| `AudioStateStore.ts` | Queryable snapshot of what is playing, for UI binding. |
| `mix/MasterBus.ts` | Master gain stage. |
| `mix/ChannelBus.ts` | Per-channel gain stage, four channels. |
| `backend/AudioBackend.ts` | Interface separating mixer logic from the Web Audio API. |
| `backend/WebAudioBackend.ts` | Real implementation, used in the browser. |
| `backend/FakeAudioBackend.ts` | Deterministic test double, used by unit tests. |
| `actions/registerAudioActions.ts` | Registers audio actions with the WHEN→DO interaction registry. |
| `actions/audioActionBuilders.ts` | Constructs those action payloads. |

The backend split is what makes the package unit-testable: tests run against
`FakeAudioBackend` in Node, with no Web Audio API present.

## 3. Procedural capabilities

Implemented and covered by unit tests:

- Play, pause, resume, stop, and set volume on a voice.
- Master and per-channel volume, four channels.
- Autoplay unlock with a queue that flushes on first user gesture.
- Asset resolution through the shared resolver chain, including caching.
- Audio actions callable from WHEN→DO rules.
- A queryable state store for playback status.

## 4. Current versus future state

Deliberately **not** implemented at this stage, per the exclusions stated in
`AudioSystem.ts`:

| Deferred | Note |
|---|---|
| Spatial / positional audio | No panner nodes; audio is non-positional. |
| Captions | No caption track or timing model. |
| LRU and budget cache eviction | Buffers are cached without an eviction policy. |
| Ducking | No automatic level reduction between channels. |
| Retrigger gating | Rapid repeat triggers are not debounced. |
| Mixer snapshots | No save/restore of mixer state. |
| Rule-engine event bridge | Rules can call audio actions, but audio emits no events back. |

## 5. Next steps

- Author-facing editor UI for audio is minimal; most authoring is still done in
  project data rather than through panels.
- The import path (Import Audio, drag-and-drop, IndexedDB persistence across
  reload, corrupt-file rejection) has unit coverage for its pure parts, but the
  browser click-through has not been verified end to end.
- Decide whether spatial audio is in scope before the mixer grows further; it
  changes the voice and bus interfaces.
