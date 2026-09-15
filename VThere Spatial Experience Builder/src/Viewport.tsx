/**
 * @file        Viewport.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       React-to-Three.js 3D viewport bridge.
 *
 * @responsibility
 * Creates the Three.js scene, reconstructs project objects, handles editor
 * selection and floor movement, and owns renderer lifecycle cleanup.
 *
 * @inputs
 * ViewportProps: objects, selectedId, onSelect, onMove, and interactive mode.
 *
 * @outputs
 * A React mount element containing a WebGL canvas and optional editor hint.
 *
 * @members
 * mountRef, dataRef, scene, camera, renderer, objectsGroup, resize,
 * synchronisation helpers, ResizeObserver, and animation frame.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/viewport.md
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CameraPose, SceneObject, defaultCameraPose, defaultEnvironmentId } from './model'
import { disposeObjectResources, syncArtefacts } from './viewport/syncArtefacts'
import { ViewportHint, ViewportOverlay } from './viewport/ViewportOverlay'
import { syncGizmo } from './viewport/syncGizmo'
import { loadEnvironmentIntoGroup } from './viewport/environmentController'
import { applyCameraPose, getCameraPose, updateWalkCamera } from './viewport/cameraController'
import { createViewportInteractionController } from './viewport/interactionController'
import { createGizmoSet } from './viewport/createGizmoSet'
import type { EnvStatus } from './viewport/renderTypes'

export type CameraMode = 'orbit' | 'walk'
export type GizmoMode = 'select' | 'move' | 'rotate' | 'scale'

interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onScale?: (id: string, scale: [number, number, number]) => void
  onRotate?: (id: string, rotation: [number, number, number]) => void
  gizmoMode?: GizmoMode
  scaleSpace?: 'world' | 'local'
  rotateSpace?: 'world' | 'local'
  sceneId?: string
  environmentId?: string
  startCamera?: CameraPose
  cameraMode?: CameraMode
  resetToken?: number
  interactive?: boolean
}

export interface ViewportHandle {
  getCameraPose: () => CameraPose
}

const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(
  {
    objects, selectedId, onSelect, onMove, onScale, onRotate,
    gizmoMode = 'select',
    scaleSpace = 'world',
    rotateSpace = 'world',
    sceneId = '',
    environmentId = defaultEnvironmentId,
    startCamera = defaultCameraPose(),
    cameraMode = 'orbit',
    resetToken = 0,
    interactive = true,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode })
  dataRef.current = { objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode }

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const applyPoseRef = useRef<(pose: CameraPose) => void>(() => {})
  const environmentGroupRef = useRef<THREE.Group | null>(null)
  const currentEnvDisposeRef = useRef<(() => void) | null>(null)
  // Walk-mode look direction. Lives outside the setup effect so the camera-mode-switch
  // effect below can re-seed it from the camera's current orientation on every transition.
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  const [envStatus, setEnvStatus] = useState<EnvStatus>({ state: 'loading', progress: 0 })
  const [reloadToken, setReloadToken] = useState(0)

  useImperativeHandle(ref, () => ({
    getCameraPose: (): CameraPose => {
      const camera = cameraRef.current
      if (!camera) return dataRef.current.startCamera
      return getCameraPose(camera)
    },
  }), [])

  // Scene/renderer/camera setup — created once. All per-render values are read from refs so
  // toggling camera mode, gizmo mode, or editing objects never tears down the WebGL context.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1118)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const objectsGroup = new THREE.Group()
    const environmentGroup = new THREE.Group()
    environmentGroupRef.current = environmentGroup
    scene.add(environmentGroup)
    scene.add(objectsGroup)

    // Keep editor-only gizmos outside the authored artefact group. Artefact
    // synchronisation may rebuild objects, but must never dispose the gizmos.
    const gizmoSet = createGizmoSet()
    const { group: gizmoGroup, axisArrows, scaleHandles, rotateHandles } = gizmoSet
    scene.add(gizmoGroup)

    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(4, 8, 5)
    scene.add(keyLight)
    const grid = new THREE.GridHelper(16, 16, 0x35515a, 0x1a2b34)
    grid.position.y = 0.01
    scene.add(grid)

    // Orbit/pan/zoom for arranging content — disabled while walking or dragging/gizmo-manipulating an object.
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.maxDistance = 40
    controls.minDistance = 1
    controls.maxPolarAngle = Math.PI * 0.49
    controlsRef.current = controls

    applyPoseRef.current = (pose) => {
      const orientation = applyCameraPose(camera, controls, pose)
      yawRef.current = orientation.yaw
      pitchRef.current = orientation.pitch
    }
    applyPoseRef.current(dataRef.current.startCamera)

    let renderedSignature = ''

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const syncObjects = () => {
      const signature = JSON.stringify([dataRef.current.objects, dataRef.current.selectedId])
      if (signature === renderedSignature) return
      syncArtefacts({ group: objectsGroup, objects: dataRef.current.objects, selectedId: dataRef.current.selectedId })
      renderedSignature = signature
    }

    let interactionController: ReturnType<typeof createViewportInteractionController>
    const syncGizmoFrame = () => {
      const selected = dataRef.current.objects.find((object) => object.id === dataRef.current.selectedId) ?? null
      syncGizmo({
        gizmoGroup,
        axisArrows,
        scaleHandles,
        rotateHandles,
        selected,
        selectedMesh: selected ? objectsGroup.getObjectByName(selected.id) : undefined,
        mode: dataRef.current.gizmoMode,
        scaleSpace: dataRef.current.scaleSpace,
        rotateSpace: dataRef.current.rotateSpace,
        isDragging: interactionController.isDragging(),
      })
    }

    interactionController = createViewportInteractionController({
      element: renderer.domElement,
      camera,
      controls,
      raycaster,
      pointer,
      objectsGroup,
      gizmoGroup,
      axisArrows,
      scaleHandles,
      rotateHandles,
      yaw: yawRef,
      pitch: pitchRef,
      interactive,
      callbacks: {
        getData: () => ({
          objects: dataRef.current.objects,
          selectedId: dataRef.current.selectedId,
          gizmoMode: dataRef.current.gizmoMode,
          scaleSpace: dataRef.current.scaleSpace,
          rotateSpace: dataRef.current.rotateSpace,
          cameraMode: dataRef.current.cameraMode,
        }),
        select: (id) => dataRef.current.onSelect(id),
        commitMove: (id, position) => dataRef.current.onMove(id, position),
        commitScale: (id, scale) => dataRef.current.onScale?.(id, scale),
        commitRotate: (id, rotation) => dataRef.current.onRotate?.(id, rotation),
      },
    })

    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    // Walk-mode look and movement remain available in runtime mode. The
    // interaction controller gates editor selection and transforms with
    // `interactive` and owns all pointer/keyboard listener cleanup.

    let frame = 0
    let lastTime = performance.now()
    const animate = () => {
      frame = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now
      syncObjects()
      syncGizmoFrame()
      if (dataRef.current.cameraMode === 'walk') {
        updateWalkCamera(camera, interactionController.pressedKeys, delta, yawRef.current)
      } else {
        controls.update()
      }
      renderer.render(scene, camera)
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      interactionController.dispose()
      controls.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      disposeObjectResources(objectsGroup)
      gizmoSet.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

// Orbit and walk mode use different camera controls.
// Disable OrbitControls when walk mode starts to prevent camera snapping.
// When switching modes, update the new control using the camera's current direction
// so the camera transition stays smooth.
  const previousModeRef = useRef<CameraMode | null>(null)
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    controls.enabled = cameraMode === 'orbit'
    const isFirstRun = previousModeRef.current === null
    const changed = previousModeRef.current !== cameraMode
    previousModeRef.current = cameraMode
    if (isFirstRun || !changed) return
    const forward = camera.getWorldDirection(new THREE.Vector3())
    if (cameraMode === 'walk') {
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)), -1.4, 1.4)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(pitchRef.current, yawRef.current, 0)
    } else {
      controls.target.copy(camera.position.clone().addScaledVector(forward, 6))
    }
  }, [cameraMode])

  // Environment loading — a separate lifecycle from the renderer so switching scenes or
  // retrying a failed load never rebuilds the WebGL context.
  useEffect(() => {
    const holder = environmentGroupRef.current
    if (!holder) return
    const loadHandle = loadEnvironmentIntoGroup({
      group: holder,
      environmentId,
      currentDispose: currentEnvDisposeRef,
      onStatus: setEnvStatus,
      onReady: () => applyPoseRef.current(dataRef.current.startCamera),
    })
    return loadHandle.cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId, sceneId, reloadToken])

  useEffect(() => {
    if (envStatus.state === 'ready') applyPoseRef.current(dataRef.current.startCamera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  const hint = cameraMode === 'walk'
    ? interactive
      ? 'Drag to look · WASD to walk · Space/C to fly up/down · Shift to sprint · Click to select'
      : 'Drag to look · WASD to walk · Space/C to fly up/down · Shift to sprint'
    : !interactive
      ? null
      : gizmoMode === 'move'
        ? 'Drag an axis arrow to move on one axis, or drag the object to move freely'
        : gizmoMode === 'scale'
          ? 'Drag a scale handle to resize along one axis'
          : gizmoMode === 'rotate'
            ? 'Drag a ring to rotate around that axis'
            : 'Click to select · Drag to move'

  return (
    <div className="viewport" ref={mountRef}>
      <ViewportOverlay status={envStatus} onRetry={() => setReloadToken((value) => value + 1)} />
      <ViewportHint text={hint} />
    </div>
  )
})

export default Viewport
