/**
 * @file        changeColorActionBuilder.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Typed constructor for the changeColor ActionSpec, matching the params its executor reads
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import type { ActionSpec } from '@vectorspace/project'
import type { ChangeColorParams } from './changeColorAction'

// the action kind name, shared by the builder and the registration in Viewport.tsx so they can't drift apart
export const CHANGE_COLOR_KIND = 'changeColor'

// builds a changeColor action for one object, color is a decimal number like 16711680 for red
export const changeColorAction = (objectId: string, color: number): ActionSpec => ({
  kind: CHANGE_COLOR_KIND,
  // "satisfies" checks these params against ChangeColorParams, so a typo like "colour" gets a red underline
  params: { objectId, color } satisfies ChangeColorParams,
})