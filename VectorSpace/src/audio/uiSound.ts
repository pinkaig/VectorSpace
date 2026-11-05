/**
 * @file        uiSound.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The one UI sound player the app uses: cue-map.json, played through its own AudioSystem.
 *
 * @responsibility
 * Wires the director (which control makes which cue, uiSoundDirector.ts) to UiSoundPlayer (which
 * ONE cue a gesture makes) to CueBank (which file, how loud) to an AudioSystem (the speakers), and
 * remembers the on/off choice in this browser. Records every step a sound takes, so the sound
 * debug panel (SoundDebugPanel.tsx) can show where one was dropped.
 *
 * Three browser facts shape it:
 *  - No sound before the first gesture. The audio engine and the cue map download once the page
 *    is idle, so they are ready before anyone presses anything; the first pointer or key press
 *    unlocks them, and that press's own click waits for the unlock and plays. Every press tries
 *    again until the unlock takes: the browser ignores some (Shift, Tab), and one that came
 *    while the engine was still loading may arrive too late to count.
 *  - Nothing is built on import. Tests and server-side code import Button, and so this file,
 *    with no AudioContext to make; without one the player stays silent and nothing throws.
 *  - This is a separate AudioSystem from the one Viewport.tsx makes for a museum's own sounds,
 *    so muting the UI here never mutes a museum, and the reverse.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { AudioSystem, CueBank, CueMap, WebAudioBackend } from "../../packages/audio/src/index";
import { UiSoundPlayer } from "./UiSoundPlayer";
import { startUiSoundDirector } from "./uiSoundDirector";
import { uiSoundTags } from "./uiSoundTags";

// Remembered in this browser only. Storage can be off or full: then the choice lasts for this
// visit, and the app never breaks over it.
const MUTED_KEY = "vectorspace.uiSoundMuted";

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTED_KEY) === "yes";
  } catch {
    return false;
  }
};

const writeMuted = (muted: boolean): void => {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "yes" : "no");
  } catch {
    // storage is off: nothing to remember it in
  }
};

// ---- what the sound debug panel reads ----
// Always recorded (the last few steps cost nothing), so opening the panel in a browser that is
// already misbehaving still shows what happened before it opened.

export type UiSoundStep = { at: number; cueId: string; step: string; ok: boolean };
export type UiSoundEngineState = "waiting for idle" | "loading" | "ready" | "failed";

const STEPS_KEPT = 40;
const steps: UiSoundStep[] = [];
const debugListeners = new Set<() => void>();
let engineState: UiSoundEngineState = "waiting for idle";
let engineError = "";

const notifyDebug = (): void => {
  for (const listener of [...debugListeners]) listener();
};

const record = (cueId: string, step: string, ok: boolean): void => {
  steps.push({ at: performance.now(), cueId, step, ok });
  if (steps.length > STEPS_KEPT) steps.shift();
  notifyDebug();
};

// The engine and the cue map are fetched when the page goes idle, so the first press finds them
// ready. undefined until then, null after a failed attempt, so a browser with no Web Audio does
// not retry on every click.
let audio: { system: AudioSystem; bank: CueBank; backend: WebAudioBackend } | null | undefined;
let loading: Promise<void> | undefined;
// The latest unlock attempt; each press starts a new one until the audio context is running.
let unlocking: Promise<void> | undefined;

// cue-map.json as shipped, so a change made in the debug tools can be put back
let shippedMap: CueMap | null = null;

const loadAudio = (): Promise<void> => {
  if (loading) return loading;
  engineState = "loading";
  notifyDebug();
  loading = Promise.all([import("../../packages/audio/src/index"), import("./cue-map.json")])
    .then(([engine, cueMapJson]) => {
      shippedMap = cueMapJson.default as unknown as CueMap;
      const bank = new engine.CueBank(structuredClone(shippedMap));
      const backend = new engine.WebAudioBackend();
      // every cue plays on the "ui" channel, which AudioSystem makes the first time it is used
      const system = new engine.AudioSystem({ backend, resolver: bank });
      bank.bind(system);
      // sounds chosen for a cue, and files or loudness chosen for a sound, in the debug tools, until they are exported into cue-map.json
      if (uiSoundTags.active) {
        const known = new Set(bank.soundList().map(({ id }) => id));
        for (const [cueId, soundIds] of Object.entries(uiSoundTags.cueSounds())) {
          if (bank.getCue(cueId) && soundIds.every((id) => known.has(id))) bank.assign(cueId, soundIds);
        }
        for (const [soundId, edit] of Object.entries(uiSoundTags.sounds())) {
          if (!known.has(soundId)) continue;
          if (edit.url) bank.replaceSound(soundId, { url: edit.url });
          if (edit.volume !== undefined) bank.updateSound(soundId, { volume: edit.volume });
        }
      }
      bank.onPlay(({ cueId, soundId }) =>
        record(cueId, soundId ? `playing sound ${soundId}` : "silent by design (no sound assigned)", soundId !== null),
      );
      audio = { system, bank, backend };
      engineState = "ready";
      notifyDebug();
    })
    .catch((error: unknown) => {
      audio = null;
      engineState = "failed";
      engineError = error instanceof Error ? error.message : String(error);
      notifyDebug();
    });
  return loading;
};

const unlock = (): Promise<void> => {
  if (!audio || audio.system.isUnlocked) return Promise.resolve();
  unlocking = audio.system.unlock().then(notifyDebug, (error: unknown) => {
    record("-", `unlock failed: ${error instanceof Error ? error.message : String(error)}`, false);
  });
  return unlocking;
};

// The unlock resumes the audio context asynchronously, so the press that started it would find
// it still locked and CueBank would drop the click. That click waits instead: a few milliseconds,
// or the rest of the download when the press beat the idle load. Past LATE_MS it is dropped, so a
// slow network never makes a click burst out after the moment it belonged to.
const LATE_MS = 500;

const sendToBank = (cueId: string): void => {
  if (!audio) return;
  const cue = audio.bank.getCue(cueId);
  if (!cue) {
    record(cueId, "dropped, no such cue in cue-map.json", false);
    return;
  }
  if (!audio.system.isUnlocked) {
    record(cueId, "dropped, audio is still locked (no press has unlocked it yet)", false);
    return;
  }
  const voice = audio.bank.play(cueId);
  if (!voice) {
    // a silent cue has already recorded itself through onPlay
    if (cue.sounds.length > 0) record(cueId, "dropped, played again inside its cooldown", false);
    return;
  }
  // the file is fetched on first play; say so if it never arrives
  window.setTimeout(() => {
    if (voice.status === "error") record(cueId, `sound file failed: ${voice.errorMessage ?? "unknown error"}`, false);
    else if (voice.status === "loading") record(cueId, "sound file still loading after 2 s (it will play late)", false);
  }, 2000);
};

const playCue = (cueId: string): void => {
  if (audio?.system.isUnlocked) {
    sendToBank(cueId);
    return;
  }
  if (audio === null) {
    record(cueId, `dropped, the audio engine failed to load: ${engineError}`, false);
    return;
  }
  if (!unlocking) {
    record(cueId, `dropped, the audio engine is ${engineState} and no press has unlocked it`, false);
    return;
  }
  record(cueId, "waiting for the unlock", true);
  const askedAt = performance.now();
  void unlocking.then(() => {
    const late = performance.now() - askedAt;
    if (late <= LATE_MS) sendToBank(cueId);
    else record(cueId, `dropped, the unlock took ${Math.round(late)} ms (over ${LATE_MS})`, false);
  });
};

export const uiSound = new UiSoundPlayer(playCue, { muted: readMuted(), trace: record });
uiSound.subscribe(() => {
  writeMuted(uiSound.muted);
  notifyDebug();
});

/** Read-only view for the sound debug panel. */
export const uiSoundDebug = {
  steps: (): readonly UiSoundStep[] => steps,
  /** A line from the panel itself, such as a click that asked for no sound. */
  note: (text: string): void => record("-", text, false),
  clear: (): void => {
    steps.length = 0;
    notifyDebug();
  },
  subscribe: (listener: () => void): (() => void) => {
    debugListeners.add(listener);
    return () => debugListeners.delete(listener);
  },
  /** The live cue bank once loaded: the panel lists, previews and reassigns cues through it. */
  bank: (): CueBank | null => audio?.bank ?? null,
  /** Puts one cue's sounds back as cue-map.json has them, and forgets the change. */
  restoreCue: (cueId: string): void => {
    const sounds = shippedMap?.cues.find((cue) => cue.id === cueId)?.sounds;
    if (sounds) audio?.bank.assign(cueId, sounds);
    uiSoundTags.setCueSounds(cueId, undefined);
  },
  /** Puts one sound's file and loudness back as cue-map.json has them, and forgets the change. */
  restoreSound: (soundId: string): void => {
    const def = shippedMap?.sounds[soundId];
    if (def && audio) {
      if (def.url) audio.bank.replaceSound(soundId, { url: def.url });
      audio.bank.updateSound(soundId, { volume: def.volume });
    }
    uiSoundTags.setSound(soundId, undefined);
  },
  /** Every change made in the debug tools, undone. */
  restoreAll: (): void => {
    for (const cueId of Object.keys(uiSoundTags.cueSounds())) uiSoundDebug.restoreCue(cueId);
    for (const soundId of Object.keys(uiSoundTags.sounds())) uiSoundDebug.restoreSound(soundId);
    uiSoundTags.clear();
  },
  status: () => ({
    engine: engineState,
    engineError,
    context: audio ? audio.backend.state : "not made yet",
    unlocked: audio?.system.isUnlocked ?? false,
    muted: uiSound.muted,
    cues: audio?.bank.cueList().map((cue) => cue.id) ?? [],
  }),
};

if (typeof window !== "undefined") {
  // Idle, so the download never competes with the page's own first paint.
  const whenIdle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 200));
  whenIdle(() => void loadAudio());

  // Capture phase, so the unlock starts before any click handler asks for a sound. A press that
  // comes before the idle download finishes waits for it, then unlocks. Stays on until an unlock
  // takes, because a press the browser does not count as a gesture leaves the context suspended.
  const onGesture = () => {
    if (audio?.system.isUnlocked || audio === null) {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      return;
    }
    if (audio) void unlock();
    else unlocking = loadAudio().then(unlock);
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);

  // every press's sound comes through here; registered after the unlock listeners above
  startUiSoundDirector((cueId, why) => uiSound.press(cueId, why), record);
}
