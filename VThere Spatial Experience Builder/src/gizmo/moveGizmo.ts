/**
 * @file        moveGizmo.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       move gizmo specific logic. Builds one axis arrow with its shaft and
 *              cone, measures an object's real size along an axis, and sets an arrow's
 *              color
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import { AxisName, AxisArrow } from './types'
import { AXIS_COLORS } from './colors'

// builds one arrow pointing along the given axis, using that axis's own color.
// Cylinder and cone point along Y by default, so X and Z need a rotation to
// match, Y needs none
export const makeAxisArrow = (axis: AxisName): AxisArrow => {
  const color = AXIS_COLORS[axis]
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), // thin shaft
    new THREE.MeshBasicMaterial({ color }),
  )
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.15, 12), // arrowhead
    new THREE.MeshBasicMaterial({ color }),
  )
  body.position.y = 0.45 // shift shaft so its base sits at the group's origin, not its center
  head.position.y = 0.95 // sit cone just past the end of the shaft

  // always-on-top rendering
  body.material.depthTest = false
  head.material.depthTest = false
  body.renderOrder = 999
  head.renderOrder = 999

  const group = new THREE.Group()
  group.add(body, head)

  const direction = new THREE.Vector3()
  if (axis === 'x') { group.rotation.z = -Math.PI / 2; direction.set(1, 0, 0) } // rotate to point along X
  if (axis === 'y') { direction.set(0, 1, 0) } // already points along Y, no rotation needed
  if (axis === 'z') { group.rotation.x = Math.PI / 2; direction.set(0, 0, 1) } // rotate to point along Z

  return { axis, group, body, head, direction }
}

// measures the object's real current size along one axis, from its actual
// mesh's bounding box in world space, so it stays correct for any scale or shape
export const extentAlong = (mesh: THREE.Object3D, axis: AxisName) => {
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  return (axis === 'x' ? size.x : axis === 'y' ? size.y : size.z) / 2 // half width along that axis
}

// measures the object's half-size along one of its own LOCAL axes, from the geometry's
// bounding box (which never rotates) scaled by the mesh's current scale. Unlike extentAlong,
// this stays correct relative to the object's own faces even after the object is rotated.
export const extentAlongLocal = (mesh: THREE.Object3D, axis: AxisName) => {
  if (mesh instanceof THREE.Mesh) {
    mesh.geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    mesh.geometry.boundingBox!.getSize(size)
    const half = axis === 'x' ? size.x * mesh.scale.x : axis === 'y' ? size.y * mesh.scale.y : size.z * mesh.scale.z
    return half / 2
  }
  // A composite object (e.g. an imported GLB) has no single geometry to read a bounding
  // box from. Approximate its local extent by measuring the world-space box with rotation
  // temporarily zeroed, then restoring it — scale is still baked into the result.
  const savedRotation = mesh.rotation.clone()
  mesh.rotation.set(0, 0, 0)
  mesh.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(mesh)
  mesh.rotation.copy(savedRotation)
  mesh.updateMatrixWorld(true)
  const size = new THREE.Vector3()
  box.getSize(size)
  return (axis === 'x' ? size.x : axis === 'y' ? size.y : size.z) / 2
}

// sets both meshes of one arrow to the same color together, since the shaft
// and head are two separate materials but should always look like one arrow
export const setArrowColor = (arrow: AxisArrow, color: number) => {
  ;(arrow.body.material as THREE.MeshBasicMaterial).color.setHex(color)
  ;(arrow.head.material as THREE.MeshBasicMaterial).color.setHex(color)
}