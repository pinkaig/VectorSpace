import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPose } from '../model'
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

export const updateWalkCamera = (
  camera: THREE.PerspectiveCamera,
  pressedKeys: Iterable<string>,
  delta: number,
  yaw: number,
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
  const dy = getVerticalDirection(pressedKeys)
  if (dy !== 0) camera.position.y = Math.max(MIN_FLY_HEIGHT, camera.position.y + dy * speed * delta)
}
