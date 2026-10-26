/**
 * @file        index.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The motion system's front door: what the rest of the app may import.
 *
 * @responsibility
 * Animation (enter, exit, swap, status change) for the app's DOM chrome, as data: a cue is a
 * named moment, a recipe is the motion, a driver makes it move. The response layer (hover,
 * press, focus, disabled) is NOT here: it is plain CSS reading src/styles/motion.css.
 *
 * Ownership boundaries, on purpose:
 *  - No canvas. src/viewport draws through THREE.WebGLRenderer onto one <canvas>, which has no
 *    child elements for element.animate() to reach, and it renders on demand (renderScheduler.ts)
 *    rather than every frame. A scene motion system would be a different animal.
 *  - No project data. Motion is UI chrome, not something a project saves: nothing here goes
 *    into packages/project and no ActionSpec kind exists for it.
 *  - No audio. This folder must not import from packages/audio, and no cue id is shared with it.
 *  - Not the editor. src/styles.css has its own motion sites and is untouched.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

export { MotionBank, STAGGER_CAP, validateMotionMap } from "./MotionBank";
export type { MotionBankOptions, MotionPlayEvent } from "./MotionBank";
export { FakeMotionDriver } from "./fakeDriver";
export { RECIPES } from "./recipes";
export { createWaapiDriver } from "./waapiDriver";
export type {
  DriverOpts,
  DurationToken,
  EaseToken,
  MotionDef,
  MotionDriver,
  MotionHandle,
  MotionMap,
  MotionRecipe,
  PlayOpts,
} from "./types";
