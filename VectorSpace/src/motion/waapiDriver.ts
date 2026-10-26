/**
 * @file        waapiDriver.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The real MotionDriver: runs a recipe with the browser's element.animate()
 *              (the Web Animations API, native to Blink, Gecko and WebKit).
 *
 * @responsibility
 * The whole bridge from motion data to pixels. It asks resolve.ts what to play, sets the
 * gain for the duration, and returns a handle whose `finished` always settles.
 * (element.animate()'s own `finished` REJECTS when the animation is cancelled, and a rejection
 * nobody caught is logged as an error and can leave a caller waiting forever, so the rejection
 * is absorbed here, once, instead of in every caller.)
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { resolveRecipe, type ReadToken } from "./resolve";
import type { MotionDriver, MotionHandle } from "./types";

export interface WaapiDriverOptions {
  /** The visitor's prefers-reduced-motion. Read on every play, so a changed setting applies at once. */
  prefersReduced?: () => boolean;
  /** How to read a CSS custom property. */
  readToken?: ReadToken;
}

const settledHandle = (): MotionHandle => ({ finished: Promise.resolve(true), cancel: () => {}, reverse: () => {} });

// which play() last touched an element, so an older animation finishing late cannot remove the gain a newer one set
const latestPlay = new WeakMap<Element, number>();
let playCount = 0;

export function createWaapiDriver(options: WaapiDriverOptions = {}): MotionDriver {
  const prefersReduced = options.prefersReduced ?? (() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const readToken = options.readToken ?? ((name) => getComputedStyle(document.documentElement).getPropertyValue(name));

  return {
    play(el, recipe, opts) {
      const plan = resolveRecipe(recipe, opts, prefersReduced(), readToken);
      if (!plan) return settledHandle();

      // Recipes write amplitude as calc(... * var(--mo-gain)), so a cue's gain is one custom
      // property on the element for as long as it animates. Inline styles only exist on HTML/SVG elements.
      const style = (el as HTMLElement).style;
      const mine = ++playCount;
      latestPlay.set(el, mine);
      style.setProperty("--mo-gain", String(opts.gain));

      const animation = el.animate(plan.keyframes, plan.options);
      const release = () => {
        if (latestPlay.get(el) === mine) style.removeProperty("--mo-gain");
      };

      // cancel() rejects `finished`; turn both outcomes into a plain boolean
      const finished = animation.finished.then(
        () => {
          release();
          return true;
        },
        () => {
          release();
          return false;
        },
      );

      return {
        finished,
        cancel: () => animation.cancel(),
        reverse: () => animation.reverse(),
      };
    },
  };
}
