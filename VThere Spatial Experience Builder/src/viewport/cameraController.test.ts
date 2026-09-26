import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { realignOrbitUp, snapCameraTo } from './cameraController'

// realignOrbitUp only touches controls.target, and snapCameraTo only calls update() on it.
const makeControls = () => ({ target: new THREE.Vector3(1, 0, 2), update: () => true }) as unknown as OrbitControls

const screenUp = (camera: THREE.Camera) => new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

describe('realignOrbitUp', () => {
  it.each([
    ['TOP', new THREE.Vector3(0, 1, 0)],
    ['BOTTOM', new THREE.Vector3(0, -1, 0)],
  ])('restores Y-up from a %s snap without changing the on-screen picture', (_, direction) => {
    const camera = new THREE.PerspectiveCamera()
    const controls = makeControls()
    camera.position.set(1, 5, 2)
    snapCameraTo(camera, controls, direction)
    const upBefore = screenUp(camera)
    const distanceBefore = camera.position.distanceTo(controls.target)

    realignOrbitUp(camera, controls)

    expect(camera.up.toArray()).toEqual([0, 1, 0])
    expect(screenUp(camera).dot(upBefore)).toBeGreaterThan(0.9999)
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(distanceBefore, 6)
  })

  it('leaves an already Y-up camera untouched', () => {
    const camera = new THREE.PerspectiveCamera()
    const controls = makeControls()
    camera.position.set(4, 3, 6)
    camera.lookAt(controls.target)
    const before = camera.position.clone()
    realignOrbitUp(camera, controls)
    expect(camera.position.equals(before)).toBe(true)
  })
})
