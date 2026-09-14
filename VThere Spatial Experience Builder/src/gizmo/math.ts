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

// Calculates the angle (in radians) from center to point around axis.
// The same axis always produces the same reference direction,
// so the angle stays consistent while dragging.
export const angleAroundAxis = (point: THREE.Vector3, center: THREE.Vector3, axis: THREE.Vector3): number => {
  const reference = Math.abs(axis.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const basisU = new THREE.Vector3().crossVectors(reference, axis).normalize()
  const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize()
  const relative = point.clone().sub(center)
  return Math.atan2(relative.dot(basisV), relative.dot(basisU))
}