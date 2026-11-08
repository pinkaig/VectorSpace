/**
 * @file        snapping.ts
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       Object inspector panel's Snap functions:
 *              Move - lands on the floor grid (every half cell, so a 1 m object can fill a cell exactly or sit centred on a line); height is left alone
 *              Rotate - turns in 15 degree steps
 *              Size - grows and shrinks in steps of 0.25 of its original size
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

// the floor grid's cells are 1 m in floorGrid.ts; positions snap to every half cell
export const MOVE_STEP = 0.5
export const ROTATE_STEP = Math.PI / 12 // 15 degrees in radians
export const SCALE_STEP = 0.25

const toStep = (value: number, step: number) => Math.round(value / step) * step

/** A world position with x and z on the floor grid; y (height) unchanged*/
export const snapToFloorGrid = ([x, y, z]: [number, number, number]): [number, number, number] => [
  toStep(x, MOVE_STEP),
  y,
  toStep(z, MOVE_STEP),
]

/** An angle in radians to the nearest 15 degree step*/
export const snapAngle = (radians: number): number => toStep(radians, ROTATE_STEP)

/** A scale factor to the nearest 0.25, never below 0.25 so the object cannot vanish*/
export const snapScale = (value: number): number => Math.max(SCALE_STEP, toStep(value, SCALE_STEP))
