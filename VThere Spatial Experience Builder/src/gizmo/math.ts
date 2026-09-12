// ======================================================================
// math.ts
// BRIEF: shared geometry math for gizmo dragging. Finds the point along a given axis that sits closest to the cursor's ray, so movement can be constrained to a single axis
// ======================================================================
import * as THREE from 'three'

// uses the closest point between two skew lines formula, since a ray and a
// line rarely actually intersect in 3D. Returns null when the camera is
// looking nearly straight down the axis, since the math becomes unstable then
export const closestPointOnAxis = (
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  axisOrigin: THREE.Vector3,
  axisDir: THREE.Vector3,
): number | null => {
  const r = new THREE.Vector3().subVectors(axisOrigin, rayOrigin)
  const b = axisDir.dot(rayDir)
  const c = rayDir.dot(rayDir)
  const d = axisDir.dot(r)
  const e = rayDir.dot(r)
  const denom = c - b * b
  if (Math.abs(denom) < 1e-6) return null // ray nearly parallel to the axis
  const t = (b * e - c * d) / denom
  return t
}