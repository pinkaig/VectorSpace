/**
 * @file       ReferenceViewport.tsx
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Renders read-only orthographic reference views for the quad-view
 *             layout, including top, front, and right perspectives,
 *             scene object synchronization, environment loading,
 *             pan and zoom controls, and optimized rendering.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SceneObject } from '../project/model'
import { loadEnvironment } from '../content/environments'
import { disposeObjectResources, syncArtefacts } from './syncArtefacts'
import { createRenderScheduler } from './renderScheduler'
import { FLOOR_BACKGROUND, FLOOR_SIZE, createFloorGrid } from './floorGrid'

export type ReferenceAxis = 'top' | 'front' | 'right'

interface ReferenceViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  environmentId: string
  axis: ReferenceAxis
  label: string
}

const AXIS_VIEW: Record<ReferenceAxis, { direction: THREE.Vector3; up: THREE.Vector3 }> = {
  top: { direction: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
  front: { direction: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
  right: { direction: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
}
// GridHelper lies flat in the XZ plane by default, which is only useful for the top pane —
// front/right look at that plane edge-on and would see just a flat line. Rotate it into the
// plane each pane actually faces (XY for front, ZY for right). Front/right are pushed back to
// the far edge of the world grid (rather than through the origin) so the backdrop sits behind
// every object instead of cutting through the middle of whatever's selected.
const GRID_EDGE = FLOOR_SIZE / 2
const AXIS_GRID: Record<ReferenceAxis, { rotation: [number, number, number]; position: [number, number, number]; opacity: number }> = {
  top: { rotation: [0, 0, 0], position: [0, 0, 0], opacity: 1 },
  // Dimmed relative to top — as a backdrop wall rather than a floor, it would otherwise
  // compete visually with the objects in front of it.
  front: { rotation: [Math.PI / 2, 0, 0], position: [0, 0, -GRID_EDGE], opacity: 0.6 },
  right: { rotation: [0, 0, Math.PI / 2], position: [-GRID_EDGE, 0, 0], opacity: 0.6 },
}
const FRUSTUM_HALF_HEIGHT = 9
const FOCUS = new THREE.Vector3(0, 0.7, 0)

export default function ReferenceViewport({ objects, selectedId, environmentId, axis, label }: ReferenceViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId })
  dataRef.current = { objects, selectedId }
  const environmentGroupRef = useRef<THREE.Group | null>(null)
  const currentEnvDisposeRef = useRef<(() => void) | null>(null)
  const requestRenderRef = useRef<() => void>(() => {})

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(FLOOR_BACKGROUND)

    const environmentGroup = new THREE.Group()
    environmentGroupRef.current = environmentGroup
    scene.add(environmentGroup)

    const { direction, up } = AXIS_VIEW[axis]
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    camera.up.copy(up)
    camera.position.copy(FOCUS).addScaledVector(direction, 20)
    camera.lookAt(FOCUS)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2))
    // Same green floor as the main viewport in floorGrid.ts, stood up as a backdrop wall
    // for the front/right panes.
    const floor = createFloorGrid(AXIS_GRID[axis].opacity)
    floor.group.rotation.set(...AXIS_GRID[axis].rotation)
    floor.group.position.set(...AXIS_GRID[axis].position)
    scene.add(floor.group)

    const objectsGroup = new THREE.Group()
    scene.add(objectsGroup)

    // pan + zoom only — rotation stays off so this pane never leaves its fixed axis
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(FOCUS)
    controls.enableRotate = false
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minZoom = 0.2
    controls.maxZoom = 12
    controls.update()

    // Same on-demand drawing as the main Viewport; matters more here since three
    // panes are open at once and are usually idle.
    const scheduler = createRenderScheduler()
    const { requestRender } = scheduler
    requestRenderRef.current = requestRender

    const resize = () => {
      const width = mount.clientWidth
      const height = Math.max(mount.clientHeight, 1)
      const aspect = width / height
      camera.left = -FRUSTUM_HALF_HEIGHT * aspect
      camera.right = FRUSTUM_HALF_HEIGHT * aspect
      camera.top = FRUSTUM_HALF_HEIGHT
      camera.bottom = -FRUSTUM_HALF_HEIGHT
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      requestRender()
    }

    // Shares syncArtefacts with the main Viewport rather than rebuilding this logic per
    // pane — important here specifically, since three of these panes render at once, so a
    // full-rebuild-every-sync approach (its previous form) tripled the cost of every edit.
    // Reference equality is exact because every edit clones ProjectData.
    let synced: { objects: readonly SceneObject[]; selectedId: string | null } | null = null
    const syncObjects = () => {
      const { objects, selectedId } = dataRef.current
      if (synced && synced.objects === objects && synced.selectedId === selectedId) return
      syncArtefacts({
        group: objectsGroup,
        objects,
        selectedId,
        onModelLoaded: () => { synced = null },
      })
      synced = { objects, selectedId }
      requestRender()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    // Pan and zoom change the camera (caught by the scheduler); zoom on an
    // orthographic camera only changes its projection, so the wheel wakes a draw.
    renderer.domElement.addEventListener('wheel', requestRender)

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      syncObjects()
      if (controls.update()) requestRender()
      if (!scheduler.shouldRender(camera, controls.target)) return
      renderer.render(scene, camera)
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      requestRenderRef.current = () => {}
      observer.disconnect()
      renderer.domElement.removeEventListener('wheel', requestRender)
      controls.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      disposeObjectResources(objectsGroup)
      floor.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [axis])

  // Separate from the renderer-setup effect above so switching environments never
  // tears down this pane's canvas/controls — mirrors Viewport.tsx's own split.
  useEffect(() => {
    let cancelled = false
    loadEnvironment(environmentId).then((loaded) => {
      if (cancelled) { loaded.dispose(); return }
      const holder = environmentGroupRef.current
      holder?.clear()
      holder?.add(loaded.group)
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = loaded.dispose
      requestRenderRef.current()
    }).catch(() => {
      // Reference panes are secondary; a failed environment load just leaves the grid visible.
    })
    return () => { cancelled = true }
  }, [environmentId])

  return (
    <div className="viewport reference-viewport" ref={mountRef}>
      <div className="reference-viewport-label">{label}</div>
    </div>
  )
}
