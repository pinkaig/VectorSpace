/**
 * @file        math.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       shared geometry math for gizmo dragging. Finds the point
 *              along a given axis that sits closest to the cursor's ray,
 *              so movement can be constrained to a single axis
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import {
  angleAroundAxis as angleAroundAxisPure,
  closestPointOnAxis as closestPointOnAxisPure,
} from '../viewport/interactionMath'

// uses the closest point between two skew lines formula, since a ray and a
// line rarely actually intersect in 3D. Returns null when the camera is
// looking nearly straight down the axis, since the math becomes unstable then
export const closestPointOnAxis = (
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  axisOrigin: THREE.Vector3,
  axisDir: THREE.Vector3,
): number | null => {
  return closestPointOnAxisPure(rayOrigin.toArray(), rayDir.toArray(), axisOrigin.toArray(), axisDir.toArray())
}

// Calculates the angle (in radians) from center to point around axis.
// The same axis always produces the same reference direction,
// so the angle stays consistent while dragging.
export const angleAroundAxis = (point: THREE.Vector3, center: THREE.Vector3, axis: THREE.Vector3): number => {
  return angleAroundAxisPure(point.toArray(), center.toArray(), axis.toArray())
}