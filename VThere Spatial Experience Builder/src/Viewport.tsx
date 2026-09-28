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
import {
  CameraPose,
  InteractionRule,
  SceneObject,
  ZoneDefinition,
  defaultCameraPose,
  defaultEnvironmentId,
} from './model'
import {
  createActionRegistry,
  createActionSequencer,
  createEffectRegistry,
  createRuntimeState,
  createZoneTracker,
  dispatch,
  resetRuntime,
  type RuntimeEvent,
  type RuntimeState,
} from '../packages/interaction/src/index'
import { disposeObjectResources, syncArtefacts } from './viewport/syncArtefacts'
import { ViewportCrosshair, ViewportHint, ViewportOverlay } from './viewport/ViewportOverlay'
import { syncGizmo } from './viewport/syncGizmo'
import { loadEnvironmentIntoGroup } from './viewport/environmentController'
import { applyCameraPose, applyViewOrientation, getCameraPose, realignOrbitUp, snapCameraTo, syncOrthoCamera, updateWalkCamera } from './viewport/cameraController'
import { createViewportInteractionController } from './viewport/interactionController'
import { EYE_HEIGHT } from './viewport/viewportTypes'
import { EDGE_VIEWS, FACE_VIEWS, matchEdgeView, matchFaceView } from './gizmo/viewSnap'
import { createGizmoSet } from './viewport/createGizmoSet'
import { createViewportOverlays, overlayDims } from './viewport/overlayWidgets'
import type { EnvStatus } from './viewport/renderTypes'
import {
  getAssetDescriptor,
  resolveAsset,
  retryAsset,
  subscribeAssetResolution,
  type AssetDescriptor,
} from './viewport/assetResolution'
import { AssetStatusBadge } from './viewport/AssetStatusBadge'
import { createChangeColorExecutor} from './viewport/actions/changeColorAction'
import { createRenderScheduler } from './viewport/renderScheduler'

export type CameraMode = 'orbit' | 'walk'
export type GizmoMode = 'select' | 'move' | 'rotate' | 'scale'

interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onScale?: (id: string, scale: [number, number, number]) => void
  /** `position` is present when the rotation pivoted about the object's centre, which also moves its origin. */
  onRotate?: (id: string, rotation: [number, number, number], position?: [number, number, number]) => void
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
  /**
   * Whether the WHEN→DO runtime is live. Deliberately separate from
   * `interactive`, which only toggles gizmo/selection interactivity: authoring
   * with gizmos off must still never fire rules, and a future in-editor Preview
   * needs to run rules with the editor chrome still present. Edit mode does no
   * Tier 1/2/3 work at all.
   */
  runtimeMode?: 'edit' | 'play'
  /** Authored rules; only read in play mode. */
  rules?: readonly InteractionRule[]
  /** Zones for the active scene; only read in play mode. */
  zones?: readonly ZoneDefinition[]
  orthographic?: boolean
  onOrthographicChange?: (value: boolean) => void
  showOctaOrb?: boolean
  showAxisIndicator?: boolean
  // Shrinks the OctaOrb / axis indicator, e.g. when this is one pane of the quad layout.
  compactOverlays?: boolean
}

export interface ViewportHandle {
  getCameraPose: () => CameraPose
  /**
   * Tears down the live run and starts a fresh one. Wired to "Restart scene";
   * "Exit simulation" gets the same teardown via unmount.
   */
  restartRuntime: () => void
}

// 'TOP', 'FRONT', … when `direction` (target -> camera) is flat against a face,
// 'TOP-FRONT', … when it looks along a cube edge, else null.
const faceLabelFor = (direction: THREE.Vector3): string | null => {
  const index = matchFaceView(direction)
  if (index !== null) return FACE_VIEWS[index].label
  const edgeIndex = matchEdgeView(direction)
  return edgeIndex === null ? null : EDGE_VIEWS[edgeIndex].label
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
    runtimeMode = 'edit',
    rules = [],
    zones = [],
    orthographic = false,
    onOrthographicChange,
    showOctaOrb = true,
    showAxisIndicator = true,
    compactOverlays = false,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  // runtimeMode/rules/zones travel through this same ref rather than a second
  // mechanism, so flipping into play mode never re-runs the setup effect and
  // never tears down the WebGL context.
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showOctaOrb, showAxisIndicator, compactOverlays, syncToken, runtimeMode, rules, zones, sceneId })
  dataRef.current = { objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showOctaOrb, showAxisIndicator, compactOverlays, syncToken, runtimeMode, rules, zones, sceneId }

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const applyPoseRef = useRef<(pose: CameraPose) => void>(() => {})
  const environmentGroupRef = useRef<THREE.Group | null>(null)
  const currentEnvDisposeRef = useRef<(() => void) | null>(null)
  // Walk-mode look direction. Lives outside the setup effect so the camera-mode-switch
  // effect below can re-seed it from the camera's current orientation on every transition.
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  // Walk-mode eye height, pinned each time a camera pose is applied (initial load,
  // scene reset, or Home) so WASD movement stays ground-locked instead of flying.
  const walkHeightRef = useRef(0)
  // Orbit view saved on entering walk mode and restored on leaving it. Cleared when a
  // pose is applied mid-walk (Reset view, scene load) so that newer pose wins.
  const orbitPoseRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 } | null>(null)
  // Set by the setup effect; lets the imperative handle reach the live run.
  const restartRuntimeRef = useRef<() => void>(() => {})
  // Set by the setup effect; lets effects outside it (environment swaps, prop
  // changes) wake the on-demand render loop.
  const requestRenderRef = useRef<() => void>(() => {})
  const [envStatus, setEnvStatus] = useState<EnvStatus>({ state: 'loading', progress: 0 })
  const [reloadToken, setReloadToken] = useState(0)
  // Name of the OctaOrb face the camera is snapped to ('TOP', 'FRONT', …), shown as a
  // header; null once the user orbits away or the view is reset.
  const [faceLabel, setFaceLabel] = useState<string | null>(null)
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
    restartRuntime: () => restartRuntimeRef.current(),
  }), [])

  // Scene/renderer/camera setup — created once. All per-render values are read from refs so
  // toggling camera mode, gizmo mode, or editing objects never tears down the WebGL context.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1e1e1e)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Corner OctaOrb + axis indicator, drawn into the same canvas after the main pass.
    const overlays = createViewportOverlays(mount, renderer.domElement)

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
    const { group: gizmoGroup, axisArrows, scaleHandles, rotateHandles, originHandle, uniformScaleHandle } = gizmoSet
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
    // Full range, not just down to the horizon — OctaOrb's BOTTOM tip snaps the camera to
    // straight-up-from-below (polar angle Math.PI), and controls.update() runs every frame
    // regardless of how the camera got there, so any tighter cap here would clamp that snap
    // back to near-horizontal on the very next frame.
    controls.maxPolarAngle = Math.PI
    // OctaOrb views can leave camera.up off world Y, which OrbitControls can't rotate
    // around — hand it back a Y-up camera whenever a rotate drag begins (pan/zoom keep the
    // current up, so a rolled view survives them). State is set before 'start' fires;
    // 0 / 3 / 6 are OrbitControls' ROTATE / TOUCH_ROTATE / TOUCH_DOLLY_ROTATE.
    controls.addEventListener('start', () => {
      const { state } = controls as unknown as { state: number } // runtime field, missing from @types/three
      if (state === 0 || state === 3 || state === 6) {
        realignOrbitUp(camera, controls)
        // Orbiting leaves the snapped face, and orthographic only belongs to face views
        // (the OctaOrb switches it on) — drop back to perspective for free orbiting.
        setFaceLabel(null)
        if (dataRef.current.orthographic) dataRef.current.onOrthographicChange?.(false)
      }
    })
    controlsRef.current = controls

    // Orthographic camera mirrors the perspective camera's position/rotation every frame
    // (see syncOrthoCamera) so switching projection never requires re-binding controls.
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    const activeCameraRef: { current: THREE.Camera } = { current: camera }

    applyPoseRef.current = (pose) => {
      const effectivePose = dataRef.current.runtimeMode === 'play'
        ? { position: [pose.position[0], EYE_HEIGHT, pose.position[2]] as [number, number, number], target: [pose.target[0], EYE_HEIGHT, pose.target[2]] as [number, number, number] }
        : pose
      const orientation = applyCameraPose(camera, controls, effectivePose)
      yawRef.current = orientation.yaw
      pitchRef.current = orientation.pitch
      walkHeightRef.current = camera.position.y
      orbitPoseRef.current = null
      setFaceLabel(null)
    }
    applyPoseRef.current(dataRef.current.startCamera)

    // Draw on demand: the frame loop keeps running its logic, but only calls
    // renderer.render() after requestRender() or when the camera has moved.
    const scheduler = createRenderScheduler()
    const { requestRender } = scheduler
    requestRenderRef.current = requestRender

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      requestRender()
    }
    // Every edit produces a new ProjectData via cloneProject, so reference
    // equality on `objects` is an exact change signal — no per-frame serialisation.
    // Cleared to null to force one rebuild from the authoritative data.
    let synced: { objects: readonly SceneObject[]; selectedId: string | null; syncToken: number } | null = null
    const syncObjects = () => {
      const { objects, selectedId, syncToken } = dataRef.current
      if (synced && synced.objects === objects && synced.selectedId === selectedId && synced.syncToken === syncToken) return
      syncArtefacts({
        group: objectsGroup,
        objects,
        selectedId,
        // A `model` asset's GLB may not be cached yet — retry once it resolves instead of
        // waiting for some unrelated prop change to naturally invalidate the memo.
        onModelLoaded: () => { synced = null },
      })
      synced = { objects, selectedId, syncToken }
      requestRender()
    }

    // ---- WHEN→DO runtime (Tiers 1-3) -------------------------------------
    // All of it lives inside this effect so it shares the renderer's lifecycle:
    // the cleanup below tears the run down with the scene it was running in.
    const sequencer = createActionSequencer()
    const effects = createEffectRegistry()
    const actions = createActionRegistry()
    actions.register('changeColor', createChangeColorExecutor(objectsGroup)) // wires "changeColor" to the real executor function
    
    let zoneTracker = createZoneTracker(dataRef.current.zones)
    let zonesSignature = JSON.stringify(dataRef.current.zones)
    let runtimeState: RuntimeState | null = null

    /**
     * The single path from any event source into the pure dispatcher. Tier 1
     * sources call this; it never runs on the frame loop itself.
     */
    const emitRuntimeEvent = (event: RuntimeEvent) => {
      if (dataRef.current.runtimeMode !== 'play' || !runtimeState) return
      const result = dispatch(event, dataRef.current.rules, projectForDispatch(), runtimeState)
      runtimeState = result.nextState
      for (const action of result.actions) {
        // Executors are registered by whoever owns the action vocabulary; an
        // unregistered kind is a no-op, so an empty registry is harmless.
        void actions.execute(action, { state: runtimeState, effects }).then((next) => {
          runtimeState = next
        })
      }
    }

    /**
     * dispatch() takes a ProjectData for rule context but must never mutate it.
     * The viewport only holds the active scene's objects, so this assembles the
     * minimum shape the signature needs without copying the whole project.
     */
    const projectForDispatch = () => ({
      schemaVersion: 1 as const,
      id: 'runtime',
      name: 'runtime',
      activeSceneId: dataRef.current.sceneId,
      scenes: [{
        id: dataRef.current.sceneId,
        name: 'runtime',
        objects: dataRef.current.objects as SceneObject[],
        environmentId: '',
        startCamera: dataRef.current.startCamera,
        zones: dataRef.current.zones as ZoneDefinition[],
      }],
      rules: dataRef.current.rules as InteractionRule[],
    })

    const startRun = () => {
      runtimeState = createRuntimeState(dataRef.current.sceneId)
      zoneTracker.reset()
      emitRuntimeEvent({ kind: 'sceneStart' })
    }

    /** Shared by "exit play mode" and "restart scene", per the design doc. */
    const stopRun = (restart: boolean) => {
      runtimeState = resetRuntime(
        { sequencer, effects, zones: zoneTracker },
        { restart, sceneId: dataRef.current.sceneId },
      )
      // ProjectData was never mutated during the run, so forcing one rebuild
      // from it is the whole visual reset.
      synced = null
      if (restart) emitRuntimeEvent({ kind: 'sceneStart' })
    }
    // Restarting a walkthrough must return the visitor to the start view — otherwise
    // a scene with no rule-driven visual change looks like the R key did nothing.
    restartRuntimeRef.current = () => {
      if (dataRef.current.runtimeMode !== 'play') return
      stopRun(true)
      applyPoseRef.current(dataRef.current.startCamera)
    }

    let interactionController: ReturnType<typeof createViewportInteractionController>
    const syncGizmoFrame = () => {
      const selected = dataRef.current.objects.find((object) => object.id === dataRef.current.selectedId) ?? null
      syncGizmo({
        gizmoGroup,
        camera,
        controlsTarget: controls.target,
        isOrtho: dataRef.current.cameraMode === 'orbit' && dataRef.current.orthographic,
        axisArrows,
        scaleHandles,
        rotateHandles,
        originHandle,
        uniformScaleHandle,
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
      originHandle,
      uniformScaleHandle,
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
          compactOverlays: dataRef.current.compactOverlays,
          unpickableAssetIds: unpickableAssetIdsRef.current,
          runtimeActive: dataRef.current.runtimeMode === 'play',
        }),
        select: (id) => dataRef.current.onSelect(id),
        commitMove: (id, position) => dataRef.current.onMove(id, position),
        commitScale: (id, scale) => dataRef.current.onScale?.(id, scale),
        commitRotate: (id, rotation, position) => dataRef.current.onRotate?.(id, rotation, position),
        applyStartPose: () => applyPoseRef.current(dataRef.current.startCamera),
        applyOrientation: (direction, up) => {
          const orientation = applyViewOrientation(camera, controls, direction, up)
          yawRef.current = orientation.yaw
          pitchRef.current = orientation.pitch
          setFaceLabel(faceLabelFor(direction))
        },
        snapTo: (direction) => {
          const orientation = snapCameraTo(camera, controls, direction)
          yawRef.current = orientation.yaw
          pitchRef.current = orientation.pitch
          setFaceLabel(faceLabelFor(direction))
        },
        setOrthographic: (value) => dataRef.current.onOrthographicChange?.(value),
        showOctaOrbTooltip: overlays.showOctaOrbTooltip,
        hideOctaOrbTooltip: overlays.hideOctaOrbTooltip,
        // Always supplied so a mode flip needs no listener rebinding; the
        // controller checks runtimeActive above before doing any picking for it.
        onRuntimeEvent: emitRuntimeEvent,
      },
    })

    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    // Pointer and key input can change the scene without moving the camera
    // (gizmo hover colours, drag previews, OctaOrb highlights), so any input wakes
    // one draw. Camera motion needs no listener — the scheduler detects it.
    const inputEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'wheel'] as const
    inputEvents.forEach((type) => renderer.domElement.addEventListener(type, requestRender))
    window.addEventListener('keydown', requestRender)
    window.addEventListener('keyup', requestRender)
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

      // ---- WHEN→DO tiers, play mode only ---------------------------------
      // Edit mode falls straight past this block, so authoring runs exactly the
      // frame loop it ran before this subsystem existed.
      const playing = dataRef.current.runtimeMode === 'play'
      // The floor grid only appears in edit mode
      grid.visible = !playing
      if (playing && !runtimeState) {
        startRun()
      } else if (!playing && runtimeState) {
        stopRun(false)
      }
      if (playing && runtimeState) {
        // Rebuilt only when the authored zones actually change, so the tracker
        // keeps its occupancy — and therefore its edges — across normal frames.
        const signature = JSON.stringify(dataRef.current.zones)
        if (signature !== zonesSignature) {
          zonesSignature = signature
          zoneTracker = createZoneTracker(dataRef.current.zones)
        }
        // Tier 1 spatial: the visitor's camera is the occupant, diffed against
        // live world transforms. Edge-triggered inside the tracker, so this
        // emits only on a transition.
        const viewer = activeCameraRef.current.getWorldPosition(new THREE.Vector3())
        for (const event of zoneTracker.tick([{ id: 'viewer', position: [viewer.x, viewer.y, viewer.z] }])) {
          emitRuntimeEvent(event)
        }
        // Tier 3: one tick per frame, reusing the delta computed above.
        sequencer.tick(delta)
      }

      if (dataRef.current.cameraMode === 'walk') {
        updateWalkCamera(camera, interactionController.pressedKeys, delta, yawRef.current, {
          groundLocked: dataRef.current.runtimeMode === 'play',
          eyeHeight: walkHeightRef.current,
        })
      } else {
        controls.update()
      }

      // Orthographic mode reuses the perspective camera's live position/rotation, only
      // swapping the projection — see syncOrthoCamera.
      const useOrtho = dataRef.current.cameraMode === 'orbit' && dataRef.current.orthographic
      if (useOrtho) syncOrthoCamera(camera, orthoCamera, controls.target)
      activeCameraRef.current = useOrtho ? orthoCamera : camera
      syncGizmoFrame()

      // Play mode always draws: action executors (e.g. changeColor) mutate the
      // scene asynchronously with no render hook, and a walkthrough is rarely idle.
      if (!playing && !scheduler.shouldRender(activeCameraRef.current, controls.target)) return
      syncGizmoFrame()

      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, width, height)
      renderer.render(scene, activeCameraRef.current)

      if (dataRef.current.cameraMode === 'orbit') {
        overlays.render(renderer, {
          camera,
          target: controls.target,
          width,
          height,
          showOctaOrb: dataRef.current.showOctaOrb,
          showAxisIndicator: dataRef.current.showAxisIndicator,
          compact: dataRef.current.compactOverlays,
        })
      }
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      // Unmounting is an exit from play mode: stop sequencing and dispose every
      // registered side effect, or a panel/audio element outlives its scene.
      stopRun(false)
      restartRuntimeRef.current = () => {}
      requestRenderRef.current = () => {}
      observer.disconnect()
      inputEvents.forEach((type) => renderer.domElement.removeEventListener(type, requestRender))
      window.removeEventListener('keydown', requestRender)
      window.removeEventListener('keyup', requestRender)
      interactionController.dispose()
      controls.dispose()
      overlays.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      disposeObjectResources(objectsGroup)
      gizmoSet.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  // Any prop change (gizmo mode, overlays, orthographic, …) may alter what the
  // frame shows, so wake one draw after every React render. Cheap: it only sets a flag.
  useEffect(() => { requestRenderRef.current() })

// Orbit and walk mode use different camera controls.
// Disable OrbitControls when walk mode starts to prevent camera snapping.
// Entering walk seeds yaw/pitch from the camera's current direction. Leaving walk
// restores the orbit view saved on entry, so Orbit really returns to orbiting
// rather than staying at the walker's eye level.
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
      orbitPoseRef.current = { position: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone() }
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)), -1.4, 1.4)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(pitchRef.current, yawRef.current, 0)
    } else {
      const saved = orbitPoseRef.current
      orbitPoseRef.current = null
      if (saved) {
        camera.up.copy(saved.up)
        camera.position.copy(saved.position)
        controls.target.copy(saved.target)
        camera.lookAt(saved.target)
        controls.update()
      } else {
        // No saved view (a pose was applied while walking): orbit around a point ahead.
        controls.target.copy(camera.position.clone().addScaledVector(forward, 6))
      }
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
      onReady: () => {
        applyPoseRef.current(dataRef.current.startCamera)
        requestRenderRef.current()
      },
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
      ? 'Drag to look · WASD to walk · X/C to fly up/down · Shift to sprint · Click to select'
      : 'Click to look around · WASD to walk · Shift to sprint · Esc to exit · R to restart'
    : !interactive
      ? null
      : gizmoMode === 'move'
        ? 'Drag an axis arrow to move on one axis, or drag the object to move freely'
        : gizmoMode === 'scale'
          ? 'Drag a scale handle to resize along one axis'
          : gizmoMode === 'rotate'
            ? 'Drag a ring to rotate around that axis'
            : 'Click to select · Drag to move'

  const dims = overlayDims(compactOverlays)

  return (
    <div className="viewport" ref={mountRef}>
      <ViewportOverlay status={envStatus} onRetry={() => setReloadToken((value) => value + 1)} />
      <ViewportHint text={hint} />
      {cameraMode === 'walk' && !interactive && <ViewportCrosshair />}
      {cameraMode === 'orbit' && showOctaOrb && <div className="octaorb-backdrop" style={{ width: dims.octaOrb, height: dims.octaOrb }} />}
      {cameraMode === 'orbit' && showAxisIndicator && <div className="axis-indicator-backdrop" style={{ width: dims.axisIndicator, height: dims.axisIndicator }} />}
      {cameraMode === 'orbit' && faceLabel && (
        <div className="viewport-face-header" key={faceLabel}>
          <span className="viewport-face-header-name">{faceLabel}</span>
          <span className="viewport-face-header-projection">{orthographic ? 'Orthographic' : 'Perspective'}</span>
        </div>
      )}
      <AssetStatusBadge descriptor={selectedAssetDescriptor} onRetry={retrySelectedAsset} />
    </div>
  )
})

export default Viewport
