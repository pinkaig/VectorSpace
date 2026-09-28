# Handoff: Editor Audio Audition (preview a sound in the Asset panel)

**Date:** 2026-09-22
**Status:** Not started. `packages/audio` (the playback engine) exists and is tested; nothing
editor-facing consumes it yet.
**For:** whoever builds the audio authoring UI next.

**Baseline phase:** Post-baseline subsystem. Builds on
[`docs/code/subsystems/audio-system.md`](../../code/subsystems/audio-system.md) section 21
("Edit-mode audition"), tier T2.

## What exists today

- `packages/audio` — the full core-playback engine (`AudioSystem`, `AudioVoice` state machine,
  master/channel buses, `WebAudioBackend`/`FakeAudioBackend`, `registerAudioActions`). Runtime-only:
  it is wired into `RuntimeView` via `Viewport.tsx` (play mode), not into the editor. See the audio
  package's own doc comments and `AudioSystem.test.ts` for the API.
- `src/viewport/audioResolution.ts` — the `AudioResolver` the runtime uses. Its local catalog is an
  **empty `Map`**. No bundled audio files exist in the repo, so nothing plays yet regardless of UI.
- `src/App.tsx` (around line 322) — an existing "Assets" library panel in the left rail, driven by
  `src/assets.ts`'s `assetCatalog`. Today it only lists placeable primitives (`cube`/`sphere`/
  `cylinder`) with an "add to scene" button (`asset-card` → `addObject(asset.kind)`). **There is no
  audio browser anywhere in the editor.** This is the panel a new "Sounds" section or tab would sit
  next to, not inside — the primitive catalog and an audio catalog are different concepts
  (`AssetDefinition.category` is `'primitive'` only right now).
- `docs/code/subsystems/audio-system.md` section 21 already specifies the audition contract:

  > An audition voice is isolated: it bypasses rule bridging and `EffectRegistry` (it is not a
  > runtime effect), uses its own channel, and stops on selection change or when play mode starts.
  > It does not fire `audioEnded` triggers.

## Why this doesn't work today, concretely

1. **No audio assets exist to preview.** `ProjectData.audioAssets` (added this week) can hold
   `AudioAssetMeta` entries, but nothing populates it — no upload flow, no bundled catalog, no way to
   get an `assetId` that resolves to a real file. Step zero is deciding where preview clips come from
   (see "Open question" below).
2. **No `AudioSystem` instance exists in the editor.** The one that exists lives inside
   `Viewport.tsx`'s runtime-only `useEffect`, scoped to play mode, and is disposed on unmount. The
   editor (`App.tsx`) never mounts a `Viewport` in play mode, so there is currently no live
   `AudioContext` to play through while authoring.
3. **`AudioSystem.play()` has no `audition` flag.** The design doc's `PlayRequest` interface
   (audio-system.md, "Class design") lists `audition?: boolean`, but the implementation shipped this
   week (`packages/audio/src/AudioSystem.ts`) does not have it — audition semantics (bypass
   `EffectRegistry`, own channel, stop-on-selection-change) were explicitly out of scope for the
   core-playback slice. Adding it is additive, not a rework: `PlayRequest`/`play()` can gain the flag
   without touching the transport/state-machine code.

## Suggested shape for this slice

Two roughly independent pieces — do them in this order, since the second is unusable without the
first:

### 1. A minimal audio asset catalog + browser panel

- Add an `AudioAssetDefinition`-like entry point analogous to `assetCatalog` in `src/assets.ts`, or
  extend `AssetDefinition.category` to include `'audio'` if the two lists should render in one panel
  with a filter/tab. Given `audio-system.md`'s "No real audio storage yet" note (media routes are a
  Stage 3 stub, capped at a bundled/local catalog), the fastest usable version is a small
  `public/audio/` folder plus a hardcoded catalog, mirroring how `LocalCatalogResolver` already works
  for GLB assets in `src/viewport/assetResolution.ts`.
- Extend `src/viewport/audioResolution.ts`'s `localAudioCatalog` `Map` with real entries once files
  exist, or replace it with a small resolver reading from the new catalog list — keep
  `packages/audio` itself untouched; it already only depends on the `AudioResolver` interface.
- A panel section (new "Sounds" panel or a tab inside the existing "Assets" panel) listing entries
  with name + a preview control. Reuse the `asset-card`/`asset-list` CSS classes already in
  `src/App.tsx`/`styles.css` for visual consistency rather than inventing new ones.

### 2. An audition `AudioSystem` and its play/stop button

- The editor needs its own `AudioSystem` instance, separate from the runtime one in `Viewport.tsx` —
  they have different lifetimes (editor-session-long vs. play-mode-scoped) and different unlock
  timing (an editor button click is itself the required user gesture, so `unlock()` can run inline on
  first audition play — no queueing needed).
- Where to own it: a small hook (e.g. `useAuditionAudio()`) instantiated once near the top of
  `App.tsx`, or a module-level singleton like `audioResolution.ts`'s resolver — either works; a hook
  is easier to test and to dispose correctly on hot-reload.
- Add the `audition` flag to `packages/audio`'s `PlayRequest`/`AudioSystem.play()` (see point 3
  above), or — simpler for a first pass — just don't route audition plays through
  `registerAudioActions`/`EffectRegistry` at all, since the editor audition path never goes through
  the WHEN→DO dispatcher in the first place. That alone satisfies "bypasses rule bridging and
  EffectRegistry" without touching the core engine.
- "Stops on selection change" and "stops when play mode starts": the audition hook needs to hear
  about (a) which catalog entry is currently previewed and (b) `viewMode` flipping to `'runtime'` in
  `App.tsx`, and call `audition.stop({...})` in both cases.
- UI: a play/pause icon button per `asset-card` row (swap icon based on
  `audition.store.isPlaying(assetId)`), reusing `AudioStateStore`'s `useSyncExternalStore`-friendly
  `subscribe()`/`getSnapshot()` — it was built with exactly this consumer in mind (see
  `AudioStateStore.ts`'s doc comment).

### Updates in the browser

Both pieces above are pure client-side/React work — no build step beyond the existing `npm run dev`,
and Web Audio requires no server round-trip once a clip is resolvable from `public/audio/` or a
`blob:`/object URL (e.g. a drag-and-drop file picker, if that's the chosen source — see open
question below). "Can this update live in the browser" is already true for everything in this repo;
nothing about audio changes that.

## Open question this handoff does not resolve

**Where do preview/authored audio files actually come from?** Three options, increasing in scope:

1. A small bundled `public/audio/` folder with a few placeholder clips (fastest, matches how
   `environments.ts` currently ships procedural placeholders) — good enough to prove the UI works.
2. A file-picker import flow producing a session-only `URL.createObjectURL(file)` (per
   audio-system.md's "Considerations": *"a session-only object URL the user picks... does not persist
   across reloads"*) — more useful for actually authoring with real content, still no backend needed.
3. Wait for the real Asset Manager upload/storage path (`apps/api`'s media routes, currently 501
   stubs) — correct long-term, but blocked on backend work well outside this slice.

Recommend starting with (1) to unblock the UI work, note (2) as the natural next step once someone
wants to author with their own clips, and treat (3) as out of scope until the backend media routes
exist.

## Suggested next steps, in order

1. Decide the preview-source question above (probably (1) for a first pass).
2. Add a handful of placeholder clips under `public/audio/` and a small catalog list next to
   `src/assets.ts`.
3. Build the audition hook (`useAuditionAudio` or similar) with its own `AudioSystem`/
   `WebAudioBackend`, no `EffectRegistry`/dispatcher involvement.
4. Add the panel UI: a "Sounds" section (or tab) in the left rail, one row per catalog entry, a
   play/stop icon driven by `AudioStateStore`.
5. Wire "stop on selection change" and "stop when entering play mode" (`viewMode === 'runtime'`).
6. Manual check in the browser: click play on one clip, click play on a different clip (first one
   should stop), enter Run simulation (audition should stop), exit and confirm the panel still works.

## Repo state at time of writing

- Branch: `sherman-branch`
- Relevant recent commits (not yet pushed): `483eb5b` (schema), `ae7a026` (packages/audio),
  `47e198b` (runtime wiring) — see [`audio-system.md`](../../code/subsystems/audio-system.md) for the
  full design this and the runtime slice both draw from.
- `npm test` (228/228), `npm run typecheck`, `npm run build` all clean as of the runtime-wiring
  commit. This handoff describes unbuilt work; nothing above has been implemented.
