# UI audio prototype

The VectorSpace V3 mockup with sound on every interaction, and a **sound board** beside it for hearing, swapping and exporting every sound. Built to be thrown around in an audio consultation: change a sound in seconds, see exactly which control plays it.

For the consultation itself, read [CONSULTATION.md](CONSULTATION.md). For the kinds of sound the app needs and how they are managed, read [SOUND-CATEGORIES.md](SOUND-CATEGORIES.md).

## Run it

From `VectorSpace/`:

```bash
npm run dev
```

Open `http://localhost:5173/prototypes/ui-audio/index.html`. Press **B** to hide or show the board. Add `?screen=rule` (or `playtour`, `publish`, `rooms`, `place`, `info`, `thome`, `treview`, `aperm`...) to start on a screen; the full list is the `presets` object in `index.html`.

## Swap a sound

- **On the board.** Pick another sound in a row's dropdown, or drag any audio file onto the row. It plays at once. The slider scales that cue's loudness.
- **Keep it.** Board changes persist in this browser. To keep them for everyone, click **Copy cue-map.json** and paste it over `src/audio/cue-map.json` (the app reads the same file). Dropped files exist only in memory: copy the file into `sfx/`, then set its `url` in the pasted JSON.
- **In the file.** Edit `src/audio/cue-map.json` and refresh. To replace a sound everywhere, overwrite its file in `sfx/` under the same name.
- **See what triggers it.** Every control on the page is outlined and numbered (press **D** to hide the outlines, **H** to add the hover layer). The **On this screen** tab lists the same controls by number with the sound each plays; hover a row to find its control. Under **Sounds**, each row lists every component that plays it, so a shared sound is visible rather than assumed.
- **See all of it.** **Scan all screens** on the board presses every control on every screen in a hidden copy of the page (about three seconds) and fills each sound's list with every control it covers. **Download component list (CSV)** is the control-by-control sheet for the designer.

## 1. What it is

The mockup draws its whole screen from one state object and rebuilds the page on every change. Sound is added without touching the mockup: `index.html` differs from the original by two lines (a stylesheet and a script).

Three layers, so each can change without the others:

- **Sounds** (the library): audio files, each with a channel and a level.
- **Cues** (the moments): "an object is dropped", "a to-do ticks off". Each cue points at one or more sounds. Swapping audio means re-pointing a cue.
- **Bindings** (the components): which control or state change fires which cue. This is the list of UI components.

Sounds and cues live in `cue-map.json`, and are what a sound designer edits. Bindings live in `bindings.json`, and are what a developer edits. Only the bindings know about the mockup.

## 2. Where to look

| File | Role |
| --- | --- |
| `packages/audio/src/cues/CueBank.ts` | The reusable part. Cue to sound: variants, loudness, cooldown, channel, swap, export. Plays through `AudioSystem`. Tested in `CueBank.test.ts`. |
| `src/audio/cue-map.json` | 27 sounds and 37 cues. What plays. Shared with the real app since 3 Nov, so tuning here carries over. |
| `bindings.json` | 39 rules: which component fires which cue. |
| `conditions.ts` | The words `bindings.json` is written in (watch a value, fire on a change). Tested in `conditions.test.ts`. |
| `director.ts` | Listens to the mockup and calls `CueBank.play`. The throwaway part. Also reports what caused each sound. |
| `surfaces.ts` | Finds every control on the screen (by selector, by click handler, and by what bindings name), keeps only those a pointer can reach, numbers them, and measures where they sit. |
| `probe.ts` | Finds out what each control really plays, by pressing it in a hidden copy of the page. Runs the same page with `?sfx=probe`. |
| `inventory.ts` | The list of screen states, and the per-sound and CSV views of a full scan. Tested in `inventory.test.ts`. |
| `soundboard.ts`, `overlay.ts`, `soundboard.css` | The board (two tabs), and the numbered outlines drawn over the page. |
| `overrides.ts` | Keeps board edits across reloads. |
| `main.ts` | Boot, in the same order `Viewport.tsx` uses. |
| `sfx/placeholder/`, `tools/make-placeholders.mjs` | Old synthesised stand-ins. Nothing references them any more; kept only until someone deletes them. |

In the console, `vsSfx` holds `bank`, `system`, `director`, `map` (the live list of controls) and `probe`: for example `vsSfx.bank.play('editor.drop')`.

## 3. What happens, step by step

**A click.** The director catches it once on `document` (the mockup replaces its buttons constantly, so per-button listeners would not survive). It finds the first click binding whose selector, text and conditions match, and holds the sound for one tick.

**The render that follows.** The director has wrapped the mockup's `renderVals()`, so it sees the new state next to the old. A binding such as "`state.placed` becomes true" fires. If an outcome fired, the held click is dropped: one gesture, one sound. If several outcomes fired, the most important wins; bindings marked `layer` (the screen whoosh, the reward tick) play on top.

**Playing.** `CueBank.play` picks a variant (first, cycle, or random without repeating), checks the cooldown, multiplies the sound level by the cue gain and any state gain (Quiet, Normal, Loud), and calls `AudioSystem.play` on the right channel. A one-shot before the first user gesture is dropped, so a click does not burst out seconds late. A loop is queued.

**The debug view.** Which controls exist comes from `surfaces.ts`: a selector for the usual suspects, plus a hook on `addEventListener` that notices any element the mockup gave a click handler (the walls of the 3D room are such elements, and are not buttons), plus the elements bindings name. A control counts only if a pointer at its position would land on it, so a button behind a dialog is left out and the numbers match what a person can press. What each control plays cannot be read off the rules, because a press that changes something with its own sound loses its click. So after every change of state, `probe.ts` sends the page's state to a hidden copy of itself, which presses each control in turn with the director running dry (it reports, and plays nothing), putting the state back between presses. Until the answer arrives the rules' prediction is shown, with a `?` after the name. The mockup has no network, navigation, storage or timers, which is what makes pressing everything safe.

**Room music.** A `while` binding starts the bed when Play mode begins, re-levels it if the volume choice changes, and fades it out when Play ends.

**A swap.** Re-pointing a cue is one array edit. Replacing a sound's audio gives it a new asset id, because `AudioSystem` caches decoded audio per id and would otherwise replay the old file.

## 4. Current and future

**Built and checked**

- `CueBank`: 20 unit tests against `FakeAudioBackend`. `conditions.ts`: 12. `inventory.ts`: 8. Type-check clean; the full suite passes (441 tests when last run). The prototype folder is outside `tsc -b`, so it was checked with a one-off config that includes it.
- In the browser pane: the audio context runs, voices reach `playing`, and the cues fire as listed for sign-in, the tutorial, placing, info, reactions, rooms, Play mode (tour, card, footsteps, music start and fade), publish, and review. A scan of 31 screen states pressed 807 controls: every button and menu plays something. The only silent presses are the 3D room's walls and floor (27 instances), which are clickable in the mockup. Text fields are silent by design.
- Board: preview, swap, drop-in file, volume, mixer, numbered outlines and the On this screen list, full scan and CSV, a ticker of what caused each sound, export, reset, persistence.

**Not checked**: how it sounds (nothing here can listen), touch devices, Safari and Firefox, and a real user's first-gesture unlock on iPad.

**Sound files.** Every sound is a supplied file under `public/audio`: the five masterlist sounds (`SFX/Tip`, `Brief`, `Success`, `Error`, `Next`), the ten-file UI pack (`SFX/ui-*.wav`) and the museum ambience. Cues with no supplied file are silent on purpose (`ui.loading`, `ui.task-complete`, `nav.screen`, `play.bgm.piano`, `world.reaction-sound`); cues whose press has no dedicated file reuse the nearest supplied click. The soundboard lists which.

**Real-app future.** `CueBank` and `cue-map.json` carry over unchanged. Bindings do not: in React they become a prop or hook on each component (`<Button cue="ui.click.confirm">`, `useCue('editor.drop')`), and state outcomes become calls from the code that causes them rather than a watcher.

## 5. Not done

- **Spatial audio, ducking, crossfade.** Not in `AudioSystem` yet, and the mockup asks for "Only nearby" and music that changes by room. Decided by the consultation.
- **Footsteps follow a timer** (a cooldown), not distance travelled. Door, tap-to-walk and in-room reactions are not wired in the mockup; the board plays them.
- **`ui` channel.** Proposed here only; it is created on demand and nothing in the audio package changed to allow it.
- **`cue-map.json` now lives in `src/audio/`** and the real app plays it (`src/audio/uiSound.ts`). The files stay in `public/audio/SFX/`, unregistered in the student catalogue.
- **`bindings.json` selectors** match the mockup's inline styles (the purple button is `background: #5B4BD6`). A restyle of the mockup needs a pass over them; the board's coverage outlines show what stopped matching.
- **The probe only visits the mockup's own screen presets**, with two states patched in to reach moments the presets skip (a room not yet added, a tour with the card closed). A control that exists only in a state no preset reaches is missed by the full scan, though the live view still covers it once you get there.
- **Controls are matched by label.** The live view applies a probe's answer only if the hidden copy listed the same labels in the same order. If two controls ever share a label and order shifts, the probe's answer is discarded and the rules' prediction is shown instead.
- **Hover is predicted, not pressed.** It is the same rule for every button, tab and menu, so the probe does not re-measure it.
- **Hover firing again after a click** is held back for 150 ms after each render, because the page rebuilds under a still pointer. Worth re-checking on real hardware.
