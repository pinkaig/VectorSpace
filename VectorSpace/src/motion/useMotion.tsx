/**
 * @file        useMotion.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       React bindings for the motion bank: play a cue when an element appears, or when a value changes.
 *
 * @responsibility
 * Knows WHEN to play a cue (a mount, a change), never WHAT it looks like: that is the bank.
 * Hooks hand back a ref to attach to the element that should move.
 *
 * Two React facts shape every hook here:
 *  - <StrictMode> (src/main.tsx) runs each effect, its cleanup, then the effect again in
 *    development, so "play on mount" must survive being played, cancelled and played again,
 *    and "play on change" must not mistake that rehearsal for a change.
 *  - An element React unmounts is gone the same instant, so an EXIT cannot play on it. The
 *    popup solves that in exitAsGhost.ts; entering and changing need only these hooks.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { createElement, useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { motion } from "./motion";
import type { PlayOpts } from "./types";

/** Plays `cueId` on the element when it mounts. Attach the returned ref to that element. */
export function useMotionIn<T extends Element = HTMLDivElement>(cueId: string, opts: PlayOpts = {}) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = motion.play(cueId, el, opts);
    // leaving mid-animation (or StrictMode's rehearsal) must not leave a half-played animation behind
    return () => handle.cancel();
    // opts is a fresh object each render; its two numbers are what matter
  }, [cueId, opts.gain, opts.staggerIndex]);
  return ref;
}

/**
 * Plays `cueId` when `key` changes, not when the element first mounts. Use it for something
 * that changes in place (a chip's status, a route). Attach the returned ref to the element.
 */
export function useMotionOnChange<T extends Element = HTMLDivElement>(cueId: string, key: string, opts: PlayOpts = {}) {
  const ref = useRef<T>(null);
  // undefined until the first effect has run: that run is the mount, not a change
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    const changed = previous.current !== undefined && previous.current !== key;
    previous.current = key;
    if (el && changed) motion.play(cueId, el, opts);
  }, [cueId, key, opts.gain, opts.staggerIndex]);
  return ref;
}

type MotionProps<Tag extends "div" | "span" | "tr"> = { as?: Tag; cue: string } & PlayOpts & ComponentPropsWithoutRef<Tag>;

/**
 * An element that plays `cue` when it mounts. For data that arrives into a spot: render it only
 * once the data is there (or give it a `key` that changes when the data arrives) and it fades in.
 */
export function Motion<Tag extends "div" | "span" | "tr" = "div">({ as, cue, gain, staggerIndex, ...rest }: MotionProps<Tag>) {
  const ref = useMotionIn<HTMLElement>(cue, { gain, staggerIndex });
  return createElement(as ?? "div", { ref, ...rest });
}
