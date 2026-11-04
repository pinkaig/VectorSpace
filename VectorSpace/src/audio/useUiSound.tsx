/**
 * @file        useUiSound.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       React bindings for UI sound: a cue when something appears, the on/off state, and
 *              the sound on/off button the top bars show.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { uiSound } from "./uiSound";
import type { UiCue } from "./UiSoundPlayer";
import "./soundToggle.css";

/**
 * Plays `cueId` when the component mounts, e.g. a tip appearing. StrictMode's mount-unmount-mount
 * rehearsal asks twice in one task, and the player makes that one sound.
 */
export function useUiSoundIn(cueId: UiCue): void {
  useEffect(() => {
    uiSound.play(cueId);
  }, [cueId]);
}

const subscribe = (listener: () => void) => uiSound.subscribe(listener);
const getMuted = () => uiSound.muted;

/** True while UI sound is off; re-renders when it changes anywhere. */
export function useUiSoundMuted(): boolean {
  return useSyncExternalStore(subscribe, getMuted, getMuted);
}

/** The sound on/off button. The choice is remembered in this browser (masterlist rule). */
export function SoundToggle() {
  const muted = useUiSoundMuted();
  const label = muted ? "Turn interface sounds on" : "Turn interface sounds off";
  return (
    <button
      type="button"
      className="ui-sound-toggle"
      aria-pressed={!muted}
      aria-label={label}
      title={label}
      onClick={() => {
        uiSound.setMuted(!muted);
        // turning it on answers with a sound, so the person hears that it worked
        if (muted) uiSound.press("ui.toggle.on");
      }}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
