// ======================================================================
// colors.ts
// BRIEF: per axis color constants for the gizmo. Base colors match the app's object palette, and the hover colors are lighter versions shown when the cursor is over an arrow
// ======================================================================
import { AxisName } from './types'

export const AXIS_COLORS: Record<AxisName, number> = {
  x: 0xe0483e, // red, matches original default
  y: 0x4ea7a0, // teal, matches the cube color
  z: 0xe6ad5a, // orange, matches the sphere color
}

export const AXIS_HOVER_COLORS: Record<AxisName, number> = {
  x: 0xff8f7a, // lighter red
  y: 0x8fd6cf, // lighter teal
  z: 0xf5cd8f, // lighter orange
}