/**
 * @file        motion.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The one MotionBank the app uses: the shipped cue and recipe tables, played by the real driver.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { CUES } from "./cues";
import { MotionBank } from "./MotionBank";
import { RECIPES } from "./recipes";
import { createWaapiDriver } from "./waapiDriver";

// The motion board flips this to show what a reduced-motion visitor would see, without
// changing the operating system setting. Nothing else sets it.
let previewReduced = false;
export const setPreviewReducedMotion = (on: boolean): void => {
  previewReduced = on;
};

// Built when first imported. createWaapiDriver touches no DOM until play() is called.
export const motion = new MotionBank(
  { recipes: RECIPES, cues: CUES },
  createWaapiDriver({ prefersReduced: () => previewReduced || matchMedia("(prefers-reduced-motion: reduce)").matches }),
);
