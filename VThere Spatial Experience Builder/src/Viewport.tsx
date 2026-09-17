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
import { applyCameraPose, applyViewOrientation, getCameraPose, snapCameraTo, syncOrthoCamera, updateWalkCamera } from './viewport/cameraController'
import { createViewportInteractionController } from './viewport/interactionController'
import { createGizmoSet } from './viewport/createGizmoSet'
import { AXIS_INDICATOR_DIM, OCTAORB_DIM, OVERLAY_MARGIN, createViewportOverlays } from './viewport/overlayWidgets'
import { matchFaceView } from './gizmo/viewSnap'
import type { EnvStatus } from './viewport/renderTypes'
import {
  getAssetDescriptor,
  resolveAsset,
  retryAsset,
  subscribeAssetResolution,
  type AssetDescriptor,
} from './viewport/assetResolution'
import { AssetStatusBadge } from './viewport/AssetStatusBadge'

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
  /**
   * Bumped by the editor when an edit is rejected. A rejected edit leaves
   * ProjectData unchanged, so the object-sync signature below would not change
   * and a previewed mesh would stay at the invalid pose. Including this token in
   * that signature forces one rebuild from the authoritative project data.
   */
  syncToken?: number
  interactive?: boolean
  orthographic?: boolean
  onOrthographicChange?: (value: boolean) => void
  showOctaOrb?: boolean
  showAxisIndicator?: boolean
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
    syncToken = 0,
    interactive = true,
    orthographic = false,
    onOrthographicChange,
    showOctaOrb = true,
    showAxisIndicator = true,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showOctaOrb, showAxisIndicator, syncToken })
  dataRef.current = { objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showOctaOrb, showAxisIndicator, syncToken }

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
  // Tracks every object currently loading/erroring so the interaction controller
  // can skip them at pick time; see requirement 2 in the Stage 6 plan section.
  const unpickableAssetIdsRef = useRef<Set<string>>(new Set())
  const [selectedAssetDescriptor, setSelectedAssetDescriptor] = useState<AssetDescriptor | undefined>(undefined)

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

    // OctaOrb's orb names render here, not as in-scene sprites — at the widget's small
    // on-screen size, world-unit text came out illegibly tiny no matter how it was tuned.
    // A real DOM element is crisp at any size and only needs updating on hover.
    const octaOrbTooltip = document.createElement('div')
    octaOrbTooltip.className = 'octaorb-tooltip'
    octaOrbTooltip.style.display = 'none'
    mount.appendChild(octaOrbTooltip)
    const showOctaOrbTooltip = (label: string, clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      octaOrbTooltip.textContent = label
      octaOrbTooltip.style.left = `${clientX - rect.left}px`
      octaOrbTooltip.style.top = `${clientY - rect.top}px`
      octaOrbTooltip.style.display = 'block'
    }
    const hideOctaOrbTooltip = () => { octaOrbTooltip.style.display = 'none' }

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

    // Corner overlay widgets: each owns a tiny scene rendered into a scissor rect of the
    // same canvas/renderer (no extra WebGL context), rotated opposite the main camera so
    // it always shows the world's orientation relative to the current view.
    const overlays = createViewportOverlays()

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
    // Full range, not just down to the horizon — OctaOrb's BOTTOM tip snaps the camera to
    // straight-up-from-below (polar angle Math.PI), and controls.update() runs every frame
    // regardless of how the camera got there, so any tighter cap here would clamp that snap
    // back to near-horizontal on the very next frame.
    controls.maxPolarAngle = Math.PI
    controlsRef.current = controls

    // Orthographic camera mirrors the perspective camera's position/rotation every frame
    // (see syncOrthoCamera) so switching projection never requires re-binding controls.
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    const activeCameraRef: { current: THREE.Camera } = { current: camera }

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
      const signature = JSON.stringify([dataRef.current.objects, dataRef.current.selectedId, dataRef.current.syncToken])
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
      activeCamera: activeCameraRef,
      overlays,
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
          showOctaOrb: dataRef.current.showOctaOrb,
          showAxisIndicator: dataRef.current.showAxisIndicator,
          unpickableAssetIds: unpickableAssetIdsRef.current,
        }),
        select: (id) => dataRef.current.onSelect(id),
        commitMove: (id, position) => dataRef.current.onMove(id, position),
        commitScale: (id, scale) => dataRef.current.onScale?.(id, scale),
        commitRotate: (id, rotation) => dataRef.current.onRotate?.(id, rotation),
        applyStartPose: () => applyPoseRef.current(dataRef.current.startCamera),
        applyOrientation: (direction, up) => {
          const orientation = applyViewOrientation(camera, controls, direction, up)
          yawRef.current = orientation.yaw
          pitchRef.current = orientation.pitch
        },
        snapTo: (direction) => {
          const orientation = snapCameraTo(camera, controls, direction)
          yawRef.current = orientation.yaw
          pitchRef.current = orientation.pitch
        },
        setOrthographic: (value) => dataRef.current.onOrthographicChange?.(value),
        showOctaOrbTooltip,
        hideOctaOrbTooltip,
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

      // Orthographic mode reuses the perspective camera's live position/rotation, only
      // swapping the projection — see syncOrthoCamera.
      const useOrtho = dataRef.current.cameraMode === 'orbit' && dataRef.current.orthographic
      if (useOrtho) syncOrthoCamera(camera, orthoCamera, controls.target)
      activeCameraRef.current = useOrtho ? orthoCamera : camera

      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, width, height)
      renderer.render(scene, activeCameraRef.current)

      if (dataRef.current.cameraMode === 'orbit') {
        if (dataRef.current.showOctaOrb) {
          const currentDirection = camera.position.clone().sub(controls.target).normalize()
          overlays.octaOrb.syncToCamera(currentDirection, camera.up)
          overlays.octaOrb.setArrowsVisible(matchFaceView(currentDirection) !== null)
          renderer.clearDepth()
          renderer.setScissorTest(true)
          const x = width - OVERLAY_MARGIN - OCTAORB_DIM
          const y = height - OVERLAY_MARGIN - OCTAORB_DIM
          renderer.setScissor(x, y, OCTAORB_DIM, OCTAORB_DIM)
          renderer.setViewport(x, y, OCTAORB_DIM, OCTAORB_DIM)
          renderer.render(overlays.octaOrb.scene, overlays.octaOrb.camera)
        }
        if (dataRef.current.showAxisIndicator) {
          overlays.axisIndicator.group.quaternion.copy(camera.quaternion).invert()
          renderer.clearDepth()
          renderer.setScissorTest(true)
          renderer.setScissor(OVERLAY_MARGIN, OVERLAY_MARGIN, AXIS_INDICATOR_DIM, AXIS_INDICATOR_DIM)
          renderer.setViewport(OVERLAY_MARGIN, OVERLAY_MARGIN, AXIS_INDICATOR_DIM, AXIS_INDICATOR_DIM)
          renderer.render(overlays.axisIndicator.group, overlays.axisIndicator.camera)
        }
        renderer.setScissorTest(false)
      }
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      interactionController.dispose()
      controls.dispose()
      overlays.dispose()
      mount.removeChild(octaOrbTooltip)
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

  // Resolving the selected object's asset is what makes loading/ready/error
  // states observable — selection is the trigger the Stage 6 acceptance
  // criterion names explicitly. Every object's own status still feeds
  // unpickableAssetIdsRef below regardless of selection, since raycasting
  // must skip a loading/error object whether or not it's currently selected.
  useEffect(() => {
    const selected = objects.find((object) => object.id === selectedId)
    setSelectedAssetDescriptor(selected ? getAssetDescriptor(selected.id) : undefined)
    if (!selected) return
    const unsubscribe = subscribeAssetResolution(selected.id, setSelectedAssetDescriptor)
    void resolveAsset(selected)
    return unsubscribe
  }, [objects, selectedId])

  useEffect(() => {
    const unsubscribers = objects.map((object) =>
      subscribeAssetResolution(object.id, (descriptor) => {
        const set = unpickableAssetIdsRef.current
        if (descriptor.status === 'loading' || descriptor.status === 'error') set.add(object.id)
        else set.delete(object.id)
      }),
    )
    objects.forEach((object) => {
      const existing = getAssetDescriptor(object.id)
      if (!existing) void resolveAsset(object)
      else if (existing.status === 'loading' || existing.status === 'error') unpickableAssetIdsRef.current.add(object.id)
    })
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects])

  const retrySelectedAsset = () => {
    const selected = objects.find((object) => object.id === selectedId)
    if (selected) void retryAsset(selected)
  }

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
      {cameraMode === 'orbit' && showOctaOrb && <div className="octaorb-backdrop" />}
      {cameraMode === 'orbit' && showAxisIndicator && <div className="axis-indicator-backdrop" />}
      {cameraMode === 'orbit' && orthographic && <div className="viewport-projection-badge">Orthographic</div>}
      <AssetStatusBadge descriptor={selectedAssetDescriptor} onRetry={retrySelectedAsset} />
    </div>
  )
})

export default Viewport
