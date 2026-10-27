/**
 * @file        types.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The shapes the motion system passes around: recipes, cues, the driver contract.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

/** The four durations in src/styles/motion.css (--mo-dur-instant, -fast, -base, -slow). */
export type DurationToken = "instant" | "fast" | "base" | "slow";

/** The three curves in src/styles/motion.css (--mo-ease-standard, -exit, -emphasis). */
export type EaseToken = "standard" | "exit" | "emphasis";

/**
 * A piece of reusable motion. `keyframes` is exactly what element.animate() takes.
 * Duration and easing may name a CSS token, so the board's sliders retune recipes too.
 */
export interface MotionRecipe {
  keyframes: Keyframe[];
  /** A token name, or a literal number of milliseconds. */
  duration: DurationToken | number;
  /** A token name, or any CSS easing string, including linear(). */
  easing: EaseToken | string;
  delay?: number;
  /** Default "both". Without it an element snaps back to its stylesheet value the instant the animation ends. */
  fill?: FillMode;
  /** What a motion-sensitive visitor gets instead. Default "fade". */
  reducedMotion?: "skip" | "fade" | "full";
}

/** A named moment in the UI that may move. */
export interface MotionDef {
  /** group.thing.event, lower-case: "popup.enter". */
  id: string;
  /** Plain-language name of the moment, for the board. */
  label: string;
  /** The region of the UI, not the component file, so a cue survives a rename. */
  group: string;
  /** 1 = the UI reads wrong without it, 2 = polish, 3 = nice to have. */
  tier: 1 | 2 | 3;
  /** Which recipe runs. This one string is the swappable seam. */
  recipe: string;
  /** Multiplies the amplitude (how far and how much), not the speed. */
  gain?: number;
  /** Milliseconds between siblings that play the same cue in a row. */
  stagger?: number;
  /** "No recipe chosen yet": a decision, not a bug. Plays nothing and does not warn. */
  placeholder?: boolean;
  note?: string;
}

/** The data a MotionBank is built from, and what it exports back. */
export interface MotionMap {
  recipes: Record<string, MotionRecipe>;
  cues: MotionDef[];
}

/** What a caller may pass to play(). */
export interface PlayOpts {
  /** Multiplied on top of the cue's own gain. */
  gain?: number;
  /** This element's position among siblings playing the same cue (row 0, row 1, ...). */
  staggerIndex?: number;
}

/** What the bank hands the driver: the caller's options after the bank has done its sums. */
export interface DriverOpts {
  gain: number;
  /** Milliseconds between siblings. */
  stagger: number;
  staggerIndex: number;
}

/** A running animation. `finished` always settles and never rejects: see waapiDriver.ts. */
export interface MotionHandle {
  /** true if it ran to the end, false if it was cancelled first. */
  finished: Promise<boolean>;
  cancel: () => void;
}

/** The thing that makes pixels move. The real one calls element.animate(); the fake records calls. */
export interface MotionDriver {
  play: (el: Element, recipe: MotionRecipe, opts: DriverOpts) => MotionHandle;
}
