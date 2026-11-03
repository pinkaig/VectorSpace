/**
 * @file        uiSound.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The one UI sound player the app uses: cue-map.json, played through its own AudioSystem.
 *
 * @responsibility
 * Wires UiSoundPlayer (which sound) to CueBank (which file, how loud) to an AudioSystem (the
 * speakers), and remembers the on/off choice in this browser.
 *
 * Three browser facts shape it:
 *  - No sound before the first gesture. The AudioSystem is made, and unlocked, on the first
 *    pointer or key press anywhere. CueBank drops a click made before that rather than queueing
 *    it, so the very first press is silent, which is the masterlist rule.
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

import { AudioSystem, CueBank, WebAudioBackend, type CueMap } from "../../packages/audio/src/index";
import cueMapJson from "./cue-map.json";
import { UiSoundPlayer } from "./UiSoundPlayer";

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

// Made on the first gesture, never before. null after a failed attempt, so a browser with no
// Web Audio does not retry on every click.
let audio: { system: AudioSystem; bank: CueBank } | null | undefined;

const ensureAudio = () => {
  if (audio !== undefined) return audio;
  try {
    const bank = new CueBank(cueMapJson as unknown as CueMap);
    // every cue plays on the "ui" channel, which AudioSystem makes the first time it is used
    const system = new AudioSystem({ backend: new WebAudioBackend(), resolver: bank });
    bank.bind(system);
    audio = { system, bank };
  } catch {
    audio = null;
  }
  return audio;
};

export const uiSound = new UiSoundPlayer((cueId) => ensureAudio()?.bank.play(cueId), { muted: readMuted() });
uiSound.subscribe(() => writeMuted(uiSound.muted));

// Capture phase, so the unlock starts before any click handler asks for a sound.
if (typeof window !== "undefined") {
  const onGesture = () => {
    const ready = ensureAudio();
    if (!ready || ready.system.isUnlocked) {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      return;
    }
    void ready.system.unlock();
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}
