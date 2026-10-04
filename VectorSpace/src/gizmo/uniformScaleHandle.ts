/**
 * @file        uniformScaleHandle.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Builds the scale gizmo's center handle, a small cube at the
 *              object's shared pivot that scales all three axes together
 *              proportionally when grabbed, instead of one axis at a time.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import { addOutline } from './outline'

const UNIFORM_SCALE_COLOR = 0xffffff
const UNIFORM_SCALE_HOVER_COLOR = 0xffe98a

export interface UniformScaleHandle {
  mesh: THREE.Mesh
}

export const makeUniformScaleHandle = (): UniformScaleHandle => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1), // cube, distinct from move's sphere, so it visually reads as "scale" not "move"
    new THREE.MeshBasicMaterial({ color: UNIFORM_SCALE_COLOR, depthTest: false, depthWrite: false }),
  )
  mesh.renderOrder = 1000
  addOutline(mesh)
  return { mesh }
}

export const setUniformScaleHandleColor = (handle: UniformScaleHandle, color: number) => {
  ;(handle.mesh.material as THREE.MeshBasicMaterial).color.setHex(color)
}

export { UNIFORM_SCALE_COLOR, UNIFORM_SCALE_HOVER_COLOR }