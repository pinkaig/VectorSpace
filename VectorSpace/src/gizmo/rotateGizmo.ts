/**
 * @file        rotateGizmo.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       Defines and creates the rotation gizmo axis handles used to rotate
 *              selected 3D objects around the X, Y, and Z axes.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/

import * as THREE from 'three'
import { AxisName } from './types'
import { AXIS_COLORS } from './colors'

export interface AxisRotateHandle {
  axis: AxisName
  mesh: THREE.Mesh
  normal: THREE.Vector3 // unit vector = axis of rotation, and the ring's plane normal
  baseQuaternion: THREE.Quaternion // Set how the ring faces before it follows the object's rotation.
}

export const ROTATE_RING_BASE_RADIUS = 0.95

export const makeAxisRotateHandle = (axis: AxisName): AxisRotateHandle => {
  const color = AXIS_COLORS[axis]
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(ROTATE_RING_BASE_RADIUS, 0.035, 10, 48),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }), // always render on top
  )
  mesh.renderOrder = 999 // draw on top of the object
  const normal = new THREE.Vector3()
  if (axis === 'x') { mesh.rotation.y = Math.PI / 2; normal.set(1, 0, 0) } 
  if (axis === 'y') { mesh.rotation.x = Math.PI / 2; normal.set(0, 1, 0) } 
  if (axis === 'z') { normal.set(0, 0, 1) } 

  return { axis, mesh, normal, baseQuaternion: mesh.quaternion.clone() }
}

export const setRotateHandleColor = (handle: AxisRotateHandle, color: number) => {
  ;(handle.mesh.material as THREE.MeshBasicMaterial).color.setHex(color)
}
