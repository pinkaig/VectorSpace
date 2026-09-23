/**
 * @file        cameraController.ts
 * @brief       Camera pose and visitor walk-movement adapter.
 *
 * @responsibility
 * Converts camera poses to and from Three.js cameras, applies orbit targets,
 * and updates walk movement from the active keyboard state.
 *
 * @inputs
 * Three.js camera/control objects, CameraPose values, pressed keys, and frame
 * delta time.
 *
 * @outputs
 * Camera orientation values and updated camera transforms.
 *
 * @ownership
 * This module owns camera policy only. It does not own project persistence or
 * authoring commands.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPose } from '../model'
import { upFor } from '../gizmo/viewSnap'
import { getVerticalDirection, getWalkDirection, MIN_FLY_HEIGHT, SPRINT_MULTIPLIER, WALK_SPEED } from './viewportTypes'

export interface CameraOrientation {
  yaw: number
  pitch: number
}

export const getCameraPose = (camera: THREE.PerspectiveCamera): CameraPose => {
  const forward = camera.getWorldDirection(new THREE.Vector3())
  const target = camera.position.clone().add(forward.multiplyScalar(6))
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [target.x, target.y, target.z],
  }
}

export const applyCameraPose = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  pose: CameraPose,
): CameraOrientation => {
  camera.position.set(...pose.position)
  const target = new THREE.Vector3(...pose.target)
  camera.lookAt(target)
  controls.target.copy(target)
  controls.update()
  const forward = target.clone().sub(camera.position).normalize()
  return {
    yaw: Math.atan2(-forward.x, -forward.z),
    pitch: Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)),
  }
}

// Reorients the camera to look along `direction` with the given `up`, keeping the
// current distance from and pivot around controls.target — shared by every OctaOrb /
// axis-indicator / Home interaction so they all preserve the current zoom level.
export const applyViewOrientation = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  direction: THREE.Vector3,
  up: THREE.Vector3,
): CameraOrientation => {
  const distance = camera.position.distanceTo(controls.target)
  camera.up.copy(up)
  camera.position.copy(controls.target).addScaledVector(direction, distance)
  camera.lookAt(controls.target)
  controls.update()
  const forward = controls.target.clone().sub(camera.position).normalize()
  return {
    yaw: Math.atan2(-forward.x, -forward.z),
    pitch: Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)),
  }
}

export const snapCameraTo = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  direction: THREE.Vector3,
): CameraOrientation => applyViewOrientation(camera, controls, direction, upFor(direction))

// Orthographic camera mirrors the perspective camera's live position/rotation every
// frame, only swapping the projection — so toggling projection never requires
// re-binding OrbitControls or any interaction/raycasting code to a different camera type.
export const syncOrthoCamera = (
  perspective: THREE.PerspectiveCamera,
  ortho: THREE.OrthographicCamera,
  target: THREE.Vector3,
): void => {
  const distance = Math.max(perspective.position.distanceTo(target), 0.01)
  const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))
  const halfWidth = halfHeight * perspective.aspect
  ortho.left = -halfWidth
  ortho.right = halfWidth
  ortho.top = halfHeight
  ortho.bottom = -halfHeight
  ortho.near = perspective.near
  ortho.far = perspective.far
  ortho.position.copy(perspective.position)
  ortho.quaternion.copy(perspective.quaternion)
  ortho.updateProjectionMatrix()
}

export interface WalkCameraOptions {
  // Run simulation only: pins the camera's Y to this eye height every frame instead of
  // using keys 'X' and 'C' fly the camera up/down, so the visitor's walk stays ground-locked instead
  // of floating or flying. Editor walk-mode preview keeps free fly (in interactionController's VERTICAL_KEYS)
  groundLocked: boolean
  eyeHeight: number
}

export const updateWalkCamera = (
  camera: THREE.PerspectiveCamera,
  pressedKeys: Iterable<string>,
  delta: number,
  yaw: number,
  { groundLocked, eyeHeight }: WalkCameraOptions,
): void => {
  const { x: dx, z: dz } = getWalkDirection(pressedKeys)
  const isSprinting = Array.from(pressedKeys).some((key) => key === 'ShiftLeft' || key === 'ShiftRight')
  const speed = isSprinting ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED
  if (dx !== 0 || dz !== 0) {
    const length = Math.hypot(dx, dz) || 1
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const step = (speed * delta) / length
    camera.position.addScaledVector(forward, dz * step)
    camera.position.addScaledVector(right, dx * step)
  }
  if (groundLocked) {
    camera.position.y = eyeHeight
    return
  }
  const dy = getVerticalDirection(pressedKeys)
  if (dy !== 0) camera.position.y = Math.max(MIN_FLY_HEIGHT, camera.position.y + dy * speed * delta)
}
