/**
 * @file        viewSnap.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       shared camera-orientation math for the ViewCube and axis indicator -
 *              the six canonical axis-aligned views, a stable "up" vector for each direction
 *              (so straight-down/up views don't leave orientation undefined), face-alignment
 *              detection, and the 90-degree nudge/roll rotations used by the ViewCube's arrows.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'

export interface FaceView {
  direction: THREE.Vector3
  label: string
}

// BoxGeometry assigns its six material groups in this order: +x, -x, +y, -y, +z, -z.
// FRONT/BACK are pinned to +Z/-Z so the cube's "front" matches the app's Y-up,
// camera-looks-down--Z convention (the same one the default start camera implies).
export const FACE_VIEWS: FaceView[] = [
  { direction: new THREE.Vector3(1, 0, 0), label: 'RIGHT' },
  { direction: new THREE.Vector3(-1, 0, 0), label: 'LEFT' },
  { direction: new THREE.Vector3(0, 1, 0), label: 'TOP' },
  { direction: new THREE.Vector3(0, -1, 0), label: 'BOTTOM' },
  { direction: new THREE.Vector3(0, 0, 1), label: 'FRONT' },
  { direction: new THREE.Vector3(0, 0, -1), label: 'BACK' },
]

const FACE_ALIGN_EPSILON = 0.999

// (0,1,0) is parallel to the view direction when looking straight up/down, which
// makes lookAt/OrbitControls orientation ambiguous — swap to a horizontal up then.
export const upFor = (direction: THREE.Vector3): THREE.Vector3 =>
  Math.abs(direction.y) > FACE_ALIGN_EPSILON
    ? new THREE.Vector3(0, 0, direction.y > 0 ? -1 : 1)
    : new THREE.Vector3(0, 1, 0)

// Returns the index into FACE_VIEWS the current view direction matches (within a small
// tolerance), or null if the camera is at a free/corner angle — used to show the
// ViewCube's nudge/roll arrows only once the view is flat against one face.
export const matchFaceView = (direction: THREE.Vector3): number | null => {
  for (let i = 0; i < FACE_VIEWS.length; i++) {
    if (direction.dot(FACE_VIEWS[i].direction) > FACE_ALIGN_EPSILON) return i
  }
  return null
}

export type NudgeDirection = 'up' | 'down' | 'left' | 'right'
export type RollDirection = 'left' | 'right'

// Pivots the view 90 degrees so the side that was previously up/down/left/right on
// screen faces the camera instead — the ViewCube's four nudge arrows. `direction` and
// `up` describe the current view (from target to camera, and the current up vector).
// The landing orientation always snaps to that destination face's own canonical up
// (via upFor) rather than carrying the rotation forward — nudging is only ever done
// from one of the 6 canonical faces, and composing the rotation instead would silently
// flip upside-down after two nudges in the same vertical direction (e.g. Front → Top →
// Back), since two 90-degree pitches in a row add up to a 180-degree flip.
export const nudgeView = (direction: THREE.Vector3, up: THREE.Vector3, way: NudgeDirection): { direction: THREE.Vector3; up: THREE.Vector3 } => {
  const right = new THREE.Vector3().crossVectors(up, direction).normalize()
  const nextDirection = way === 'up' ? up.clone()
    : way === 'down' ? up.clone().negate()
    : way === 'right' ? right
    : right.negate()
  return { direction: nextDirection, up: upFor(nextDirection) }
}

// Rolls the view 90 degrees around the current view direction (the direction itself
// doesn't change, only which way is "up" on screen) — the ViewCube's two curved arrows.
export const rollView = (direction: THREE.Vector3, up: THREE.Vector3, way: RollDirection): { direction: THREE.Vector3; up: THREE.Vector3 } => {
  const right = new THREE.Vector3().crossVectors(up, direction).normalize()
  return { direction: direction.clone(), up: way === 'left' ? right : right.negate() }
}
