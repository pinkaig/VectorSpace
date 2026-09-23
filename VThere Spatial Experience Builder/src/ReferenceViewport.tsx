/**
 * @file        ReferenceViewport.tsx
 * @brief       Read-only orthographic reference pane used by the quad-view layout.
 *
 * @responsibility
 * Renders the scene's objects from one fixed axis-aligned angle (top/front/right) for
 * spatial reference alongside the main interactive Viewport. Pan and zoom only — no
 * selection, dragging, or gizmo; that all happens in the main perspective pane.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SceneObject } from './model'
import { loadEnvironment } from './environments'
import { disposeObjectResources, syncArtefacts } from './viewport/syncArtefacts'

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
// the far edge of the world grid (rather than through the origin) so the helper's bright
// center-cross lines land on the backdrop's edge instead of cutting through the middle of
// whatever's selected.
const GRID_SIZE = 16
const GRID_EDGE = GRID_SIZE / 2
const AXIS_GRID: Record<ReferenceAxis, { rotation: [number, number, number]; position: [number, number, number]; opacity: number }> = {
  top: { rotation: [0, 0, 0], position: [0, 0.01, 0], opacity: 1 },
  // Dimmed relative to top — as a backdrop wall rather than a floor, it would otherwise
  // compete visually with the objects in front of it.
  front: { rotation: [Math.PI / 2, 0, 0], position: [0, 0, -GRID_EDGE], opacity: 0.35 },
  right: { rotation: [0, 0, Math.PI / 2], position: [-GRID_EDGE, 0, 0], opacity: 0.35 },
}
const FRUSTUM_HALF_HEIGHT = 9
const FOCUS = new THREE.Vector3(0, 0.7, 0)

export default function ReferenceViewport({ objects, selectedId, environmentId, axis, label }: ReferenceViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId })
  dataRef.current = { objects, selectedId }
  const environmentGroupRef = useRef<THREE.Group | null>(null)
  const currentEnvDisposeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1118)

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
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x35515a, 0x1a2b34)
    grid.rotation.set(...AXIS_GRID[axis].rotation)
    grid.position.set(...AXIS_GRID[axis].position)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = AXIS_GRID[axis].opacity
    scene.add(grid)

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
    }

    // Shares syncArtefacts with the main Viewport rather than rebuilding this logic per
    // pane — important here specifically, since three of these panes render at once, so a
    // full-rebuild-every-sync approach (its previous form) tripled the cost of every edit.
    let renderedSignature = ''
    const syncObjects = () => {
      const signature = JSON.stringify([dataRef.current.objects, dataRef.current.selectedId])
      if (signature === renderedSignature) return
      syncArtefacts({
        group: objectsGroup,
        objects: dataRef.current.objects,
        selectedId: dataRef.current.selectedId,
        onModelLoaded: () => { renderedSignature = '' },
      })
      renderedSignature = signature
    }

    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      syncObjects()
      controls.update()
      renderer.render(scene, camera)
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      disposeObjectResources(objectsGroup)
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
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
