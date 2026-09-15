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
 * mountRef, dataRef, scene, camera, renderer, raycaster, objectsGroup,
 * resize, syncObjects, pointer handlers, ResizeObserver, animation frame.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/viewport.md
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CameraPose, SceneObject, defaultCameraPose, defaultEnvironmentId } from './model'
import { AxisName, AxisArrow } from './gizmo/types'
import { AXIS_COLORS, AXIS_HOVER_COLORS } from './gizmo/colors'
import { closestPointOnAxis, angleAroundAxis } from './gizmo/math'
import { makeAxisArrow, extentAlong, extentAlongLocal, setArrowColor } from './gizmo/moveGizmo'
import { makeAxisScaleHandle, AxisScaleHandle, setScaleHandleColor } from './gizmo/scaleGizmo'
import { makeAxisRotateHandle, AxisRotateHandle, ROTATE_RING_BASE_RADIUS, setRotateHandleColor } from './gizmo/rotateGizmo'
import { ARROW_LENGTH, GIZMO_GAP, MOVE_KEYS, SPRINT_KEYS, VERTICAL_KEYS, isTypingTarget } from './viewport/viewportTypes'
import { disposeObjectResources, syncArtefacts } from './viewport/syncArtefacts'
import { normalizeAngle } from './viewport/interactionMath'
import { ViewportHint, ViewportOverlay } from './viewport/ViewportOverlay'
import { syncGizmo } from './viewport/syncGizmo'
import { loadEnvironmentIntoGroup } from './viewport/environmentController'
import { applyCameraPose, getCameraPose, updateWalkCamera } from './viewport/cameraController'
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

    const gizmoGroup = new THREE.Group() // kept separate from objectsGroup so syncObjects rebuilds don't touch it
    scene.add(gizmoGroup)

    // move gizmo: one arrow per axis, built once
    const axisArrows: AxisArrow[] = [makeAxisArrow('x'), makeAxisArrow('y'), makeAxisArrow('z')]
    axisArrows.forEach((arrow) => gizmoGroup.add(arrow.group))

    // scale gizmo: one handle per axis, built once
    const scaleHandles: AxisScaleHandle[] = [makeAxisScaleHandle('x'), makeAxisScaleHandle('y'), makeAxisScaleHandle('z')]
    scaleHandles.forEach((handle) => gizmoGroup.add(handle.mesh))

    // rotate gizmo: one ring per axis, built once
    const rotateHandles: AxisRotateHandle[] = [makeAxisRotateHandle('x'), makeAxisRotateHandle('y'), makeAxisRotateHandle('z')]
    rotateHandles.forEach((handle) => gizmoGroup.add(handle.mesh))

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

    // Free (non-axis-constrained) drag: raycasts onto a plane facing the camera and passing
    // through the object's position, so X/Y/Z can all change depending on the camera angle.
    let dragging: { id: string; plane: THREE.Plane; offset: THREE.Vector3 } | null = null
    let lastDragPosition: [number, number, number] | null = null
    const dragPoint = new THREE.Vector3()

    let axisDragging: { id: string; axis: AxisName; origin: THREE.Vector3; direction: THREE.Vector3; grabT: number } | null = null
    let lastAxisDragPosition: [number, number, number] | null = null

    let scaleDragging: { id: string; axis: AxisName; origin: THREE.Vector3; direction: THREE.Vector3; grabT: number; startScale: [number, number, number] } | null = null
    let lastScaleValue: [number, number, number] | null = null

    // Rotation is accumulated incrementally frame-to-frame (rather than as a single delta from
    // the initial grab angle) so dragging past the atan2 wraparound point doesn't snap.
    let rotateDragging: {
      id: string
      axisIndex: 0 | 1 | 2
      center: THREE.Vector3
      normal: THREE.Vector3
      plane: THREE.Plane
      lastAngle: number
      spaceMode: 'world' | 'local'
      currentRotation: [number, number, number] // used in world mode: Euler component is incremented directly
      currentQuaternion: THREE.Quaternion // used in local mode: rotation is composed around the fixed local axis
    } | null = null
    let lastRotateValue: [number, number, number] | null = null

    let looking: { startPointerX: number; startPointerY: number; startYaw: number; startPitch: number } | null = null
    const pressedKeys = new Set<string>()

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
        isDragging: !!dragging || !!axisDragging || !!scaleDragging || !!rotateDragging,
      })
    }

    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    const pick = (event: PointerEvent) => {
      getPointer(event)
      raycaster.setFromCamera(pointer, camera)
      const pickable = objectsGroup.children.filter((object) => object.visible && object.userData.enabled !== false)
      const hit = raycaster.intersectObjects(pickable, false)[0]
      return hit?.object ?? null
    }
    // Raycasts against the visible gizmo handles, returns whichever one (if any) is under the cursor.
    const pickGizmo = (event: PointerEvent): { axis: AxisName; kind: 'arrow' | 'scale' | 'rotate' } | null => {
      getPointer(event)
      raycaster.setFromCamera(pointer, camera)
      const mode = dataRef.current.gizmoMode
      if (mode === 'move') {
        for (const arrow of axisArrows) {
          if (raycaster.intersectObjects(arrow.group.children, true)[0]) return { axis: arrow.axis, kind: 'arrow' }
        }
      }
      if (mode === 'scale') {
        for (const handle of scaleHandles) {
          if (raycaster.intersectObject(handle.mesh, true)[0]) return { axis: handle.axis, kind: 'scale' }
        }
      }
      if (mode === 'rotate') {
        for (const handle of rotateHandles) {
          if (raycaster.intersectObject(handle.mesh, true)[0]) return { axis: handle.axis, kind: 'rotate' }
        }
      }
      return null
    }
    const resetAllArrowColors = () => axisArrows.forEach((arrow) => setArrowColor(arrow, AXIS_COLORS[arrow.axis]))
    const resetAllScaleHandleColors = () => scaleHandles.forEach((handle) => setScaleHandleColor(handle, AXIS_COLORS[handle.axis]))
    const resetAllRotateHandleColors = () => rotateHandles.forEach((handle) => setRotateHandleColor(handle, AXIS_COLORS[handle.axis]))

    const onPointerDown = (event: PointerEvent) => {
      if (dataRef.current.cameraMode === 'walk') {
        if (event.button !== 0) return
        looking = { startPointerX: event.clientX, startPointerY: event.clientY, startYaw: yawRef.current, startPitch: pitchRef.current }
        renderer.domElement.setPointerCapture(event.pointerId)
        return
      }
      // Camera look/walk navigation always works; object selection, dragging, and the
      // gizmo are editing actions and stay off in read-only (e.g. visitor simulation) mode.
      if (!interactive) return
      if (event.button !== 0) return

      const gizmoHit = pickGizmo(event)
      if (gizmoHit) {
        const selected = dataRef.current.objects.find((object) => object.id === dataRef.current.selectedId)
        if (selected) {
          const axisOrigin = new THREE.Vector3(...selected.transform.position)
          if (gizmoHit.kind === 'arrow') {
            const arrow = axisArrows.find((item) => item.axis === gizmoHit.axis)!
            getPointer(event)
            raycaster.setFromCamera(pointer, camera)
            const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, axisOrigin, arrow.direction)
            if (hitT !== null) {
              controls.enabled = false
              axisDragging = { id: selected.id, axis: arrow.axis, origin: axisOrigin, direction: arrow.direction.clone(), grabT: hitT }
            }
          } else if (gizmoHit.kind === 'scale') {
            const handle = scaleHandles.find((item) => item.axis === gizmoHit.axis)!
            const mesh = objectsGroup.getObjectByName(selected.id) // read live scale from the mesh, not stale React state
            if (mesh) {
              const direction = dataRef.current.scaleSpace === 'local'
                ? handle.direction.clone().applyEuler(new THREE.Euler(...selected.transform.rotation))
                : handle.direction.clone()
              getPointer(event)
              raycaster.setFromCamera(pointer, camera)
              const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, axisOrigin, direction)
              if (hitT !== null) {
                controls.enabled = false
                scaleDragging = { id: selected.id, axis: handle.axis, origin: axisOrigin, direction, grabT: hitT, startScale: [mesh.scale.x, mesh.scale.y, mesh.scale.z] }
              }
            }
          } else {
            const handle = rotateHandles.find((item) => item.axis === gizmoHit.axis)!
            const isLocalRotate = dataRef.current.rotateSpace === 'local'
            const objectEuler = new THREE.Euler(...selected.transform.rotation)
            // The rotation axis stays fixed in world space for the whole drag either way —
            // spinning an object around its own local axis never moves that axis — so it's
            // safe to resolve it once here, at grab time.
            const normal = isLocalRotate ? handle.normal.clone().applyEuler(objectEuler) : handle.normal.clone()
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, axisOrigin)
            getPointer(event)
            raycaster.setFromCamera(pointer, camera)
            const hitPoint = new THREE.Vector3()
            if (raycaster.ray.intersectPlane(plane, hitPoint)) {
              controls.enabled = false
              const axisIndex = handle.axis === 'x' ? 0 : handle.axis === 'y' ? 1 : 2
              rotateDragging = {
                id: selected.id,
                axisIndex,
                center: axisOrigin,
                normal,
                plane,
                lastAngle: angleAroundAxis(hitPoint, axisOrigin, normal),
                spaceMode: isLocalRotate ? 'local' : 'world',
                currentRotation: [...selected.transform.rotation],
                currentQuaternion: new THREE.Quaternion().setFromEuler(objectEuler),
              }
            }
          }
        }
        renderer.domElement.setPointerCapture(event.pointerId)
        return
      }

      const hit = pick(event)
      if (!hit) { dataRef.current.onSelect(null); return }
      controls.enabled = false
      dataRef.current.onSelect(hit.name)
      const item = dataRef.current.objects.find((object) => object.id === hit.name)
      if (item) {
        const objectPosition = new THREE.Vector3(...item.transform.position)
        const cameraForward = camera.getWorldDirection(new THREE.Vector3())
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward, objectPosition)
        if (raycaster.ray.intersectPlane(plane, dragPoint)) {
          dragging = { id: item.id, plane, offset: objectPosition.clone().sub(dragPoint) }
        }
      }
      renderer.domElement.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (looking) {
        const sensitivity = 0.0045
        yawRef.current = looking.startYaw - (event.clientX - looking.startPointerX) * sensitivity
        pitchRef.current = THREE.MathUtils.clamp(looking.startPitch - (event.clientY - looking.startPointerY) * sensitivity, -1.4, 1.4)
        camera.rotation.order = 'YXZ'
        camera.rotation.set(pitchRef.current, yawRef.current, 0)
        return
      }

      if (!axisDragging && !scaleDragging && !rotateDragging && !dragging) {
        // Only show hover feedback when nothing's actively being dragged.
        const hovering = pickGizmo(event)
        resetAllArrowColors()
        resetAllScaleHandleColors()
        resetAllRotateHandleColors()
        if (hovering?.kind === 'arrow') setArrowColor(axisArrows.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
        if (hovering?.kind === 'scale') setScaleHandleColor(scaleHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
        if (hovering?.kind === 'rotate') setRotateHandleColor(rotateHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      }

      if (axisDragging) {
        getPointer(event)
        raycaster.setFromCamera(pointer, camera)
        const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, axisDragging.origin, axisDragging.direction)
        if (hitT === null) return // degenerate camera angle this frame, skip rather than jump
        const travel = hitT - axisDragging.grabT
        const next = axisDragging.origin.clone().addScaledVector(axisDragging.direction, travel)
        const nextPos: [number, number, number] = [next.x, next.y, next.z]
        const mesh = objectsGroup.getObjectByName(axisDragging.id)
        if (mesh) mesh.position.set(...nextPos)
        gizmoGroup.position.set(...nextPos)
        lastAxisDragPosition = nextPos
        return
      }

      if (scaleDragging) {
        getPointer(event)
        raycaster.setFromCamera(pointer, camera)
        const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, scaleDragging.origin, scaleDragging.direction)
        if (hitT === null) return
        const travel = hitT - scaleDragging.grabT
        const scaleFactor = 1 + travel
        const axisIndex = scaleDragging.axis === 'x' ? 0 : scaleDragging.axis === 'y' ? 1 : 2
        const nextScale: [number, number, number] = [...scaleDragging.startScale]
        nextScale[axisIndex] = Math.max(0.05, scaleDragging.startScale[axisIndex] * scaleFactor) // clamp so it can't invert or vanish
        const mesh = objectsGroup.getObjectByName(scaleDragging.id)
        if (mesh) mesh.scale.set(...nextScale)
        lastScaleValue = nextScale
        return
      }

      if (rotateDragging) {
        getPointer(event)
        raycaster.setFromCamera(pointer, camera)
        const hitPoint = new THREE.Vector3()
        if (!raycaster.ray.intersectPlane(rotateDragging.plane, hitPoint)) return // degenerate camera angle this frame, skip rather than jump
        const angle = angleAroundAxis(hitPoint, rotateDragging.center, rotateDragging.normal)
        let step = angle - rotateDragging.lastAngle
        if (step > Math.PI) step -= Math.PI * 2 // unwrap so crossing the atan2 seam doesn't snap
        if (step < -Math.PI) step += Math.PI * 2
        rotateDragging.lastAngle = angle
        const mesh = objectsGroup.getObjectByName(rotateDragging.id)
        let nextRotation: [number, number, number]
        if (rotateDragging.spaceMode === 'local') {
          // World-space rotation about the (fixed) local axis, composed on top of whatever
          // rotation the object already had — unlike the world-mode path, a plain per-component
          // Euler increment would be wrong once the object has rotation on other axes too.
          const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotateDragging.normal, step)
          rotateDragging.currentQuaternion.premultiply(deltaQuat)
          const euler = new THREE.Euler().setFromQuaternion(rotateDragging.currentQuaternion, 'XYZ')
          nextRotation = [euler.x, euler.y, euler.z]
          if (mesh) mesh.quaternion.copy(rotateDragging.currentQuaternion)
        } else {
          nextRotation = [...rotateDragging.currentRotation] as [number, number, number]
          nextRotation[rotateDragging.axisIndex] += step
          rotateDragging.currentRotation = nextRotation // accumulate: next frame's step applies on top of this
          if (mesh) mesh.rotation.set(...nextRotation)
        }
        lastRotateValue = nextRotation
        return
      }

      if (!dragging) return
      getPointer(event)
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(dragging.plane, dragPoint)) return
      dragPoint.add(dragging.offset)
      const nextPos: [number, number, number] = [dragPoint.x, dragPoint.y, dragPoint.z]
      // Mutate the mesh directly during the drag (and commit once on release) so dragging
      // doesn't spam an undo-history entry on every pointermove.
      const mesh = objectsGroup.getObjectByName(dragging.id)
      if (mesh) mesh.position.set(...nextPos)
      gizmoGroup.position.set(...nextPos)
      lastDragPosition = nextPos
    }

    const onPointerUp = (event: PointerEvent) => {
      if (looking) {
        const moved = Math.hypot(event.clientX - looking.startPointerX, event.clientY - looking.startPointerY)
        looking = null
        if (moved < 4) {
          const hit = pick(event)
          dataRef.current.onSelect(hit?.name ?? null)
        }
        return
      }
      if (axisDragging && lastAxisDragPosition) dataRef.current.onMove(axisDragging.id, lastAxisDragPosition) // single commit, one undo entry
      axisDragging = null
      lastAxisDragPosition = null

      if (scaleDragging && lastScaleValue) dataRef.current.onScale?.(scaleDragging.id, lastScaleValue) // single commit, one undo entry
      scaleDragging = null
      lastScaleValue = null

      if (rotateDragging && lastRotateValue) {
        const twoPi = Math.PI * 2
        // Normalize into [0, 2π) — matches the Inspector's 0-360° convention — without
        // affecting the live drag, which needs unbounded accumulation to avoid snapping.
        const normalized = lastRotateValue.map(normalizeAngle) as [number, number, number]
        dataRef.current.onRotate?.(rotateDragging.id, normalized) // single commit, one undo entry
      }
      rotateDragging = null
      lastRotateValue = null

      if (dragging && lastDragPosition) dataRef.current.onMove(dragging.id, lastDragPosition)
      dragging = null
      lastDragPosition = null

      controls.enabled = dataRef.current.cameraMode === 'orbit'
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (!(event.code in MOVE_KEYS) && !(event.code in VERTICAL_KEYS) && !SPRINT_KEYS.has(event.code)) return
      if (dataRef.current.cameraMode === 'walk') event.preventDefault()
      pressedKeys.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => { pressedKeys.delete(event.code) }
    // Right-click no longer does anything in-scene, so suppress the browser's context menu —
    // otherwise it steals focus and the eventual keyup never arrives, leaving movement stuck on.
    const onContextMenu = (event: MouseEvent) => { event.preventDefault() }
    const onBlur = () => { pressedKeys.clear() }

    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    // Always registered: walk-mode look/WASD navigation must work even in read-only mode.
    // Editing actions (select/drag/gizmo) are gated inside onPointerDown itself via `interactive`.
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

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
        updateWalkCamera(camera, pressedKeys, delta, yawRef.current)
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      controls.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      disposeObjectResources(objectsGroup)
      gizmoGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
          else child.material.dispose()
        }
      })
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
