/**
 * @file       renderScheduler.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Determines whether the viewport needs a new frame by checking
 *             render requests and changes to the camera or orbit target.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/
import * as THREE from 'three'

// Same thresholds OrbitControls uses for its own change detection — small enough that
// damping's long tail stops drawing once motion drops below a visible amount.
const POSITION_EPS = 1e-8
const ROTATION_EPS = 1e-8

export interface RenderScheduler {
  /** Marks the next frame as needing a draw. Safe to call any number of times. */
  requestRender: () => void
  /**
   * True when a render was requested or the camera moved since the last drawn
   * frame. Records the camera pose as drawn, so call it only when you then draw.
   */
  shouldRender: (camera: THREE.Camera, target?: THREE.Vector3) => boolean
}

export const createRenderScheduler = (): RenderScheduler => {
  let requested = true
  let lastCamera: THREE.Camera | null = null
  const lastPosition = new THREE.Vector3()
  const lastQuaternion = new THREE.Quaternion()
  const lastTarget = new THREE.Vector3()

  return {
    requestRender: () => { requested = true },
    shouldRender: (camera, target) => {
      const moved = camera !== lastCamera
        || lastPosition.distanceToSquared(camera.position) > POSITION_EPS
        || 8 * (1 - lastQuaternion.dot(camera.quaternion)) > ROTATION_EPS
        || (!!target && lastTarget.distanceToSquared(target) > POSITION_EPS)
      if (!requested && !moved) return false
      requested = false
      lastCamera = camera
      lastPosition.copy(camera.position)
      lastQuaternion.copy(camera.quaternion)
      if (target) lastTarget.copy(target)
      return true
    },
  }
}
