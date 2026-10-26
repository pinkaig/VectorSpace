/**
 * @file        recipes.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The recipe table: reusable pieces of motion, as data.
 *
 * @responsibility
 * What a motion IS (keyframes, how long, which curve). Which moment in the UI uses which
 * recipe is cues.ts. Distances are written as calc(var(--mo-dist-*) * var(--mo-scale) * var(--mo-gain))
 * so the same three dials (the token sheet's amplitude, reduced motion, a cue's own gain)
 * reach every recipe without the recipe knowing about them.
 *
 * Only transform and opacity are animated: those two are composited on the GPU, while width,
 * height, top, left, margin and padding would re-run layout on every frame.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { MotionRecipe } from "./types";

// "how far", already multiplied by the reduced-motion dial and the cue's gain
const travel = (token: "sm" | "md" | "lg") => `calc(var(--mo-dist-${token}) * var(--mo-scale) * var(--mo-gain, 1))`;
// "how much smaller than normal", for scale()
const shrink = (amount: number) => `calc(1 - ${amount} * var(--mo-scale) * var(--mo-gain, 1))`;
const grow = (amount: number) => `calc(1 + ${amount} * var(--mo-scale) * var(--mo-gain, 1))`;

export const RECIPES: Record<string, MotionRecipe> = {
  fade: {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    duration: "base",
    easing: "standard",
  },
  "slide-up": {
    keyframes: [
      { opacity: 0, transform: `translateY(${travel("md")})` },
      { opacity: 1, transform: "translateY(0px)" },
    ],
    duration: "base",
    easing: "standard",
    reducedMotion: "fade",
  },
  "pop-in": {
    keyframes: [
      { opacity: 0, transform: `scale(${shrink(0.06)})` },
      { opacity: 1, transform: "scale(1)" },
    ],
    duration: "fast",
    easing: "emphasis",
    reducedMotion: "fade",
  },
  "chip-pulse": {
    keyframes: [{ transform: "scale(1)" }, { transform: `scale(${grow(0.08)})` }, { transform: "scale(1)" }],
    duration: "instant",
    easing: "standard",
    reducedMotion: "skip",
  },
  "cross-fade": {
    keyframes: [{ opacity: 1 }, { opacity: 0 }],
    duration: "fast",
    easing: "exit",
    reducedMotion: "fade",
  },
};
