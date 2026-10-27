/**
 * @file        exitAsGhost.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Lets an element animate OUT even though its parent unmounts it in the same instant.
 *
 * @responsibility
 * React removes an unmounted element from the page immediately, so there is nothing left to
 * animate. The textbook answer (keep it mounted until the animation finishes) needs every
 * parent to change from `{open && <Popup/>}` to `<Popup open={open}/>`. This does it without
 * touching a parent: when the element has really gone, a copy of it is put back on the page,
 * animated out, then deleted. Pixel-identical, because it is a copy of what was last drawn.
 *
 * The copy is inert (no focus, no clicks, hidden from screen readers), and the bank's
 * `finished` always settles, so a copy can never be left on the page.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { motion } from "./motion";

// longer than the slowest token (--mo-dur-slow, 320 ms), so it only ever fires when something went wrong
const GHOST_LIFETIME_MS = 1000;

/** A cue to play on a descendant of the copy, found by CSS selector. */
export interface GhostPart {
  selector: string;
  cue: string;
}

/**
 * Call from an effect's cleanup with the element the effect captured.
 * Does nothing while the element is still on the page: that is StrictMode rehearsing an
 * unmount in development, not the element leaving.
 */
export function exitAsGhost(el: HTMLElement, rootCue: string, parts: GhostPart[] = []): void {
  if (el.isConnected) return;

  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);

  const running = [motion.play(rootCue, ghost).finished];
  for (const { selector, cue } of parts) {
    const part = ghost.querySelector(selector);
    if (part) running.push(motion.play(cue, part).finished);
  }
  Promise.all(running).then(() => ghost.remove());
  // belt and braces: a browser that stops ticking animations (a hidden tab) must not strand a copy on the page
  setTimeout(() => ghost.remove(), GHOST_LIFETIME_MS);
}
