/**
 * @file        resolve.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Turns a recipe plus the visitor's motion preference into the exact arguments for
 *              element.animate(), or "play nothing". Pure: no DOM, so it is unit-tested directly.
 *
 * @responsibility
 * The one place reduced motion is decided for animations (the other is the @media block in
 * src/styles/motion.css, for transitions). It also turns token names ("base", "standard") into
 * the numbers and curves currently in the CSS, so a slider on the motion board retunes recipes.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { DriverOpts, DurationToken, EaseToken, MotionRecipe } from "./types";

/** The same numbers as src/styles/motion.css, used when the page cannot be asked (tests, no DOM). */
const FALLBACK_DURATION: Record<DurationToken, number> = { instant: 80, fast: 140, base: 220, slow: 320 };
const FALLBACK_EASE: Record<EaseToken, string> = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  emphasis: "cubic-bezier(0.2, 0, 0, 1.2)",
};

/** Reads one CSS custom property from the page, e.g. "--mo-dur-base" -> "220ms"; "" if unknown. */
export type ReadToken = (name: string) => string;

/** What to hand to element.animate(). */
export interface AnimatePlan {
  keyframes: Keyframe[];
  options: { duration: number; easing: string; delay: number; fill: FillMode };
}

// "140ms" or "0.14s" -> 140; anything else -> null
const parseMs = (text: string): number | null => {
  const match = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
};

const isEase = (value: string): value is EaseToken => value in FALLBACK_EASE;

export function resolveDuration(duration: MotionRecipe["duration"], read: ReadToken): number {
  if (typeof duration === "number") return duration;
  return parseMs(read(`--mo-dur-${duration}`)) ?? FALLBACK_DURATION[duration];
}

export function resolveEasing(easing: MotionRecipe["easing"], read: ReadToken): string {
  if (!isEase(easing)) return easing;
  return read(`--mo-ease-${easing}`).trim() || FALLBACK_EASE[easing];
}

/**
 * `reduced` is the visitor's prefers-reduced-motion. Returns null when nothing should play.
 *   "skip": plays nothing.   "fade": keeps only the opacity of each frame, with no duration.
 *   "full": ignores the preference. Unspecified means "fade".
 */
export function resolveRecipe(recipe: MotionRecipe, opts: DriverOpts, reduced: boolean, read: ReadToken): AnimatePlan | null {
  const mode = recipe.reducedMotion ?? "fade";
  if (reduced && mode === "skip") return null;

  const strip = reduced && mode === "fade";
  const keyframes = strip
    ? recipe.keyframes.map((frame) => (frame.opacity === undefined ? {} : { opacity: frame.opacity }))
    : recipe.keyframes;

  return {
    keyframes,
    options: {
      duration: strip ? 0 : resolveDuration(recipe.duration, read),
      easing: resolveEasing(recipe.easing, read),
      delay: (recipe.delay ?? 0) + opts.staggerIndex * opts.stagger,
      fill: recipe.fill ?? "both",
    },
  };
}
