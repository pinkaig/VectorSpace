/**
 * @file        colors.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       per axis color constants for the gizmo.
 *              Base colors match the app's object palette,
 *              and the hover colors are lighter versions
 *              shown when the cursor is over an arrow
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { AxisName } from "./types";

export const AXIS_COLORS: Record<AxisName, number> = {
  x: 0xff0000, // red
  y: 0x00ff00, // green
  z: 0x0000ff, // blue
};

export const AXIS_HOVER_COLORS: Record<AxisName, number> = {
  x: 0xff8f7a, // lighter red
  y: 0xd1ffd1, // lighter green
  z: 0xb8d5f2, // lighter blue
};

export const ORIGIN_COLOR = 0xffffff; // white, distinct from all three axis colors
export const ORIGIN_HOVER_COLOR = 0xffe98a; // light yellow hover state
