/**
 * @file        uiSoundDirector.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The one door every press's sound comes through.
 *
 * @responsibility
 * One click listener on the window, in the capture phase, so it hears every press before any
 * component's own handler runs. It finds the control the press landed on, asks uiSoundBindings
 * which cue that control makes, and hands the cue to the player as a press. Components no
 * longer play their own click: a raw <button> and the ui/Button make the same sound for the
 * same reason, and a control that wants another one says so with data-sfx or a rule.
 *
 * The flow of one gesture, start to end:
 *  1. pointerdown / keydown   uiSound.ts unlocks the audio (the browser's rule)
 *  2. click / change          here: control -> cue -> uiSound.press(cue)
 *  3. the component's handler runs; an outcome it causes (a popup opening, a museum sent)
 *     calls uiSound.play(cue), which replaces the waiting press
 *  4. end of the task         UiSoundPlayer plays the one winner through CueBank
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { controlOf, labelOf, resolveCue, routeOf, shippedRules, type Resolution } from "./uiSoundBindings";
import { uiSoundTags } from "./uiSoundTags";

type Press = (cueId: string, why: string) => void;
type Trace = (cueId: string, step: string, ok: boolean) => void;

const describe = (element: Element): string => `${element.tagName.toLowerCase()} "${labelOf(element).slice(0, 30)}"`;

/** Where an answer came from, in words for the debug panel. */
export function sourceText(resolution: Resolution): string {
  switch (resolution.source) {
    case "tag":
      return "tagged on the page";
    case "attribute":
      return "data-sfx in code";
    case "rule":
      return `rule ${(resolution.ruleIndex ?? 0) + 1}${resolution.rule?.note ? `: ${resolution.rule.note}` : ""}`;
    default:
      return "no rule fits";
  }
}

/** Attaches the listeners; returns the function that detaches them. */
export function startUiSoundDirector(press: Press, trace: Trace): () => void {
  const handle = (on: "click" | "change") => (event: Event) => {
    // a press that only picks a control to tag makes no sound
    if (uiSoundTags.picking) return;
    const control = controlOf(event.target);
    // the debug panel and the sound design page are tools, not the product: their own presses are quiet
    if (!control || control.closest(".sound-debug, .sound-design")) return;
    // a tick box fires change as well as click; only a dropdown's change is a choice of its own
    if (on === "change" && control.tagName !== "SELECT") return;
    const route = routeOf(window.location.hash);
    const resolution = resolveCue(control, on, route, shippedRules, uiSoundTags.active ? uiSoundTags.tags() : []);
    const why = `${describe(control)}, ${sourceText(resolution)}`;
    if (resolution.cue) press(resolution.cue, why);
    else trace("-", resolution.source === "none" ? `no sound: ${why}` : `silent on purpose: ${why}`, resolution.source !== "none");
  };
  const onClick = handle("click");
  const onChange = handle("change");
  window.addEventListener("click", onClick, true);
  window.addEventListener("change", onChange, true);
  return () => {
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("change", onChange, true);
  };
}
