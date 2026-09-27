/**
 * @file       renderScheduler.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Determines whether the viewport needs to render a frame based on
 *             explicit render requests and changes to the active camera or orbit target.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createRenderScheduler } from './renderScheduler'

describe('createRenderScheduler', () => {
  it('draws the first frame, then stays idle while nothing changes', () => {
    const scheduler = createRenderScheduler()
    const camera = new THREE.PerspectiveCamera()
    expect(scheduler.shouldRender(camera)).toBe(true)
    expect(scheduler.shouldRender(camera)).toBe(false)
  })

  it('draws once per requestRender', () => {
    const scheduler = createRenderScheduler()
    const camera = new THREE.PerspectiveCamera()
    scheduler.shouldRender(camera)
    scheduler.requestRender()
    scheduler.requestRender()
    expect(scheduler.shouldRender(camera)).toBe(true)
    expect(scheduler.shouldRender(camera)).toBe(false)
  })

  it('draws when the camera moves, rotates, or is swapped', () => {
    const scheduler = createRenderScheduler()
    const camera = new THREE.PerspectiveCamera()
    scheduler.shouldRender(camera)

    camera.position.x += 0.01
    expect(scheduler.shouldRender(camera)).toBe(true)

    camera.rotation.y += 0.01
    camera.updateMatrix()
    expect(scheduler.shouldRender(camera)).toBe(true)

    expect(scheduler.shouldRender(new THREE.OrthographicCamera())).toBe(true)
  })

  it('draws when the orbit target moves', () => {
    const scheduler = createRenderScheduler()
    const camera = new THREE.PerspectiveCamera()
    const target = new THREE.Vector3()
    scheduler.shouldRender(camera, target)
    target.set(0, 0, 1)
    expect(scheduler.shouldRender(camera, target)).toBe(true)
  })

  it('ignores sub-threshold drift such as a damping tail', () => {
    const scheduler = createRenderScheduler()
    const camera = new THREE.PerspectiveCamera()
    scheduler.shouldRender(camera)
    camera.position.x += 1e-6
    expect(scheduler.shouldRender(camera)).toBe(false)
  })
})
