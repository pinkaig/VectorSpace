/**
 * @file        fakeDriver.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A MotionDriver for tests: records every play() and never animates.
 *
 * @responsibility
 * Lets MotionBank be tested under vitest with no browser. Same idea as FakeAudioBackend
 * in packages/audio: the real driver is the only code that touches the DOM.
 * Each recorded call can be finished or cancelled by hand to test what waits on it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { DriverOpts, MotionDriver, MotionHandle, MotionRecipe } from "./types";

export interface FakePlay {
  el: Element;
  recipe: MotionRecipe;
  opts: DriverOpts;
  cancelled: boolean;
  /** Settles the handle's `finished` with true, as a completed animation would. */
  finish: () => void;
}

export class FakeMotionDriver implements MotionDriver {
  readonly plays: FakePlay[] = [];

  play(el: Element, recipe: MotionRecipe, opts: DriverOpts): MotionHandle {
    let settle: (completed: boolean) => void = () => {};
    const finished = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const record: FakePlay = { el, recipe, opts, cancelled: false, finish: () => settle(true) };
    this.plays.push(record);
    return {
      finished,
      cancel: () => {
        record.cancelled = true;
        settle(false);
      },
    };
  }
}
