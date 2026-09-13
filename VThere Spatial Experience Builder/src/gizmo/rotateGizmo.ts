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
    new THREE.MeshBasicMaterial({ color }),
  )
  const normal = new THREE.Vector3()
  if (axis === 'x') { mesh.rotation.y = Math.PI / 2; normal.set(1, 0, 0) } // stand the ring up around X
  if (axis === 'y') { mesh.rotation.x = Math.PI / 2; normal.set(0, 1, 0) } // stand the ring up around Y
  if (axis === 'z') { normal.set(0, 0, 1) } // already lies in the XY plane, normal along Z

  return { axis, mesh, normal, baseQuaternion: mesh.quaternion.clone() }
}

export const setRotateHandleColor = (handle: AxisRotateHandle, color: number) => {
  ;(handle.mesh.material as THREE.MeshBasicMaterial).color.setHex(color)
}
