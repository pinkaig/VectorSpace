/**
 * @file        index.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       UI sound's front door: what the rest of the app may import.
 *
 * @responsibility
 * Sound for the app's own chrome (buttons, switches, dialogs, and a few moments the masterlist
 * names), as data. Three layers, the same as the prototype in prototypes/ui-audio:
 *  - sounds and cues: cue-map.json (which file a moment plays, how loud). A sound designer edits
 *    this, or tunes it on the prototype's board and pastes it back. No code change.
 *  - the gesture rule: UiSoundPlayer (one sound per action; an outcome replaces the click).
 *  - bindings: a `cue` prop on Button, and uiSound.play() at the line that causes an outcome.
 *
 * How to add sound to something:
 *  - A <Button>: nothing, it clicks. Give it cue="ui.click.confirm" for a commit, cue={null} for none.
 *  - Something that happens: uiSound.play("publish.sent") where it happens. Add the cue to
 *    cue-map.json first; an unknown cue id is silent.
 *  - Something that appears: useUiSoundIn("ui.tip") in its component.
 *
 * Ownership boundaries, on purpose:
 *  - Not a museum's audio. Viewport.tsx owns the AudioSystem for a project's sounds; this one
 *    is separate, and so is its mute.
 *  - Not the student sound library. src/content/audioAssets.ts is what students pick from;
 *    these files sit in public/audio/SFX and are not registered there.
 *  - No motion. src/motion does not import from here, and no cue id is shared with it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

export { uiSound } from "./uiSound";
export { UiSoundPlayer } from "./UiSoundPlayer";
export type { UiCue, UiSoundPlayerOptions } from "./UiSoundPlayer";
export { SoundToggle, useUiSoundIn, useUiSoundMuted } from "./useUiSound";
