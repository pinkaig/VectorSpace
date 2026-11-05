/**
 * @file        index.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       UI sound's front door: what the rest of the app may import.
 *
 * @responsibility
 * Sound for the app's own chrome (buttons, switches, dialogs, and the moments the masterlist and
 * the V3 manual name), as data. Four layers:
 *  - sounds and cues: cue-map.json (which file in public/audio/SFX a moment plays, how loud),
 *    grouped by the six kinds of sound (touch, switches and doors, movement, building, outcome,
 *    the museum itself).
 *  - controls to cues: ui-sound-map.json, read top to bottom, first rule wins. It ends with the
 *    default click, so a new button sounds without anyone wiring it.
 *  - the one door: uiSoundDirector.ts hears every click and change on the window and presses the
 *    control's cue. No component plays its own click.
 *  - the gesture rule: UiSoundPlayer (one sound per action; an outcome replaces the click).
 *
 * How to change what something sounds like:
 *  - On the page: add ?sounddebug, Tag controls, pick it, choose a cue, Export, paste the file.
 *  - In code, for one control: data-sfx="cue.id" (or "none") on the element; <Button cue=...>
 *    writes it for you.
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
