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
import { loadEnvironment } from './environments'
import { AxisName, AxisArrow } from './gizmo/types'
import { AXIS_COLORS, AXIS_HOVER_COLORS } from './gizmo/colors'
import { closestPointOnAxis, angleAroundAxis } from './gizmo/math'
import { makeAxisArrow, extentAlong, extentAlongLocal, setArrowColor } from './gizmo/moveGizmo'
import { makeAxisScaleHandle, AxisScaleHandle, setScaleHandleColor } from './gizmo/scaleGizmo'
import { makeAxisRotateHandle, AxisRotateHandle, ROTATE_RING_BASE_RADIUS, setRotateHandleColor } from './gizmo/rotateGizmo'
import { createViewCube, ArrowKind } from './gizmo/viewCube'
import { createAxisIndicator } from './gizmo/axisIndicator'
import { upFor, matchFaceView, nudgeView, rollView } from './gizmo/viewSnap'

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
  orthographic?: boolean
  onOrthographicChange?: (value: boolean) => void
  showViewCube?: boolean
  showAxisIndicator?: boolean
}

export interface ViewportHandle {
  getCameraPose: () => CameraPose
}

interface EnvStatus {
  state: 'loading' | 'ready' | 'error'
  progress: number
  message?: string
}

export const colorFor = (kind: SceneObject['assetKind']) => ({ cube: 0x4ea7a0, sphere: 0xe6ad5a, cylinder: 0xd66d75 })[kind]
const WALK_SPEED = 3.6
const SPRINT_MULTIPLIER = 2.2
const SPRINT_KEYS = new Set(['ShiftLeft', 'ShiftRight'])
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}
const VERTICAL_KEYS: Record<string, number> = {
  Space: 1,
  KeyC: -1,
}
const MIN_FLY_HEIGHT = 0.2
const GIZMO_GAP = 0.15 // extra breathing room past the object's edge
const ARROW_LENGTH = 0.725

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
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
    orthographic = false,
    onOrthographicChange,
    showViewCube = true,
    showAxisIndicator = true,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showViewCube, showAxisIndicator })
  dataRef.current = { objects, selectedId, onSelect, onMove, onScale, onRotate, gizmoMode, scaleSpace, rotateSpace, startCamera, cameraMode, orthographic, onOrthographicChange, showViewCube, showAxisIndicator }

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
      const forward = camera.getWorldDirection(new THREE.Vector3())
      const target = camera.position.clone().add(forward.multiplyScalar(6))
      return { position: [camera.position.x, camera.position.y, camera.position.z], target: [target.x, target.y, target.z] }
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

    // Orthographic camera mirrors the perspective camera's position/rotation every frame
    // (see activeCamera below) so switching projection never requires re-binding controls.
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    let activeCamera: THREE.Camera = camera

    // Corner overlay widgets: each owns a tiny scene rendered into a scissor rect of the
    // same canvas/renderer (no extra WebGL context), rotated opposite the main camera so
    // it always shows the world's orientation relative to the current view.
    const viewCube = createViewCube()
    const axisIndicator = createAxisIndicator()
    const VIEW_CUBE_DIM = 96
    const AXIS_INDICATOR_DIM = 84
    const OVERLAY_MARGIN = 8 // matches the CSS backdrop insets in styles.css
    const overlayRaycaster = new THREE.Raycaster()
    const overlayPointer = new THREE.Vector2()
    type OverlayRect = { left: number; top: number; right: number; bottom: number }
    const overlayRect = (corner: 'top-right' | 'bottom-left', dim: number, rect: DOMRect): OverlayRect =>
      corner === 'top-right'
        ? { left: rect.right - OVERLAY_MARGIN - dim, top: rect.top + OVERLAY_MARGIN, right: rect.right - OVERLAY_MARGIN, bottom: rect.top + OVERLAY_MARGIN + dim }
        : { left: rect.left + OVERLAY_MARGIN, top: rect.bottom - OVERLAY_MARGIN - dim, right: rect.left + OVERLAY_MARGIN + dim, bottom: rect.bottom - OVERLAY_MARGIN }
    const pointInRect = (x: number, y: number, r: OverlayRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    const ndcInRect = (x: number, y: number, r: OverlayRect) => {
      overlayPointer.x = ((x - r.left) / (r.right - r.left)) * 2 - 1
      overlayPointer.y = -((y - r.top) / (r.bottom - r.top)) * 2 + 1
      return overlayPointer
    }
    // Reorients the camera to look along `direction` with the given `up`, keeping the
    // current distance from and pivot around controls.target — shared by every widget
    // interaction (ViewCube faces/corners/arrows, Home, axis indicator) below.
    const applyViewOrientation = (direction: THREE.Vector3, up: THREE.Vector3) => {
      const distance = camera.position.distanceTo(controls.target)
      camera.up.copy(up)
      camera.position.copy(controls.target).addScaledVector(direction, distance)
      camera.lookAt(controls.target)
      controls.update()
      const forward = controls.target.clone().sub(camera.position).normalize()
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    }
    const snapCameraTo = (direction: THREE.Vector3) => applyViewOrientation(direction, upFor(direction))

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

    const applyPose = (pose: CameraPose) => {
      camera.position.set(...pose.position)
      const target = new THREE.Vector3(...pose.target)
      camera.lookAt(target)
      controls.target.copy(target)
      controls.update()
      const forward = target.clone().sub(camera.position).normalize()
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    }
    applyPoseRef.current = applyPose
    applyPose(dataRef.current.startCamera)

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
      objectsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
          else child.material.dispose()
        }
      })
      objectsGroup.clear()
      dataRef.current.objects.forEach((item) => {
        const geometry = item.assetKind === 'sphere' ? new THREE.SphereGeometry(0.65, 32, 20) : item.assetKind === 'cylinder' ? new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32) : new THREE.BoxGeometry(1.1, 1.1, 1.1)
        const material = new THREE.MeshStandardMaterial({ color: colorFor(item.assetKind), roughness: 0.68, metalness: 0.05 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = item.id
        mesh.position.set(...item.transform.position)
        mesh.rotation.set(...item.transform.rotation)
        mesh.scale.set(...item.transform.scale)
        if (item.id === dataRef.current.selectedId) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xf3d48b }))
          mesh.add(edges)
        }
        objectsGroup.add(mesh)
      })
      renderedSignature = signature
    }

    // Keeps the gizmo's position and every arrow/handle's offset matched to the selected
    // object, each frame. Skips updates mid-drag so it doesn't fight onPointerMove.
    const syncGizmo = () => {
      const selected = dataRef.current.objects.find((object) => object.id === dataRef.current.selectedId)
      const mode = dataRef.current.gizmoMode
      gizmoGroup.visible = !!selected && (mode === 'move' || mode === 'scale' || mode === 'rotate')
      axisArrows.forEach((arrow) => { arrow.group.visible = mode === 'move' })
      scaleHandles.forEach((handle) => { handle.mesh.visible = mode === 'scale' })
      rotateHandles.forEach((handle) => { handle.mesh.visible = mode === 'rotate' })

      if (selected && !dragging && !axisDragging && !scaleDragging && !rotateDragging) {
        gizmoGroup.position.set(...selected.transform.position)
        const mesh = objectsGroup.getObjectByName(selected.id)
        if (mesh) {
          axisArrows.forEach((arrow) => {
            const offset = extentAlong(mesh, arrow.axis) + GIZMO_GAP
            arrow.group.position.copy(arrow.direction).multiplyScalar(offset)
          })
          const isLocalScale = dataRef.current.scaleSpace === 'local'
          scaleHandles.forEach((handle) => {
            const direction = isLocalScale ? handle.direction.clone().applyEuler(new THREE.Euler(...selected.transform.rotation)) : handle.direction
            const offset = (isLocalScale ? extentAlongLocal(mesh as THREE.Mesh, handle.axis) : extentAlong(mesh, handle.axis)) + GIZMO_GAP + ARROW_LENGTH
            handle.mesh.position.copy(direction).multiplyScalar(offset)
          })
          if (mode === 'rotate') {
            const box = new THREE.Box3().setFromObject(mesh)
            const size = new THREE.Vector3()
            box.getSize(size)
            const targetRadius = Math.max(size.x, size.y, size.z) / 2 + GIZMO_GAP + 0.2
            const scale = targetRadius / ROTATE_RING_BASE_RADIUS
            const isLocalRotate = dataRef.current.rotateSpace === 'local'
            const objectQuaternion = isLocalRotate ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...selected.transform.rotation)) : null
            rotateHandles.forEach((handle) => {
              handle.mesh.scale.setScalar(scale)
              // In local mode the ring rotates with the object, so it stays flush with the
              // object's actual face instead of always standing up along the world axis.
              if (objectQuaternion) handle.mesh.quaternion.copy(objectQuaternion).multiply(handle.baseQuaternion)
              else handle.mesh.quaternion.copy(handle.baseQuaternion)
            })
          }
        }
      }
    }

    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    const pick = (event: PointerEvent) => {
      getPointer(event)
      raycaster.setFromCamera(pointer, activeCamera)
      const hit = raycaster.intersectObjects(objectsGroup.children, false)[0]
      return hit?.object ?? null
    }
    // Raycasts against the visible gizmo handles, returns whichever one (if any) is under the cursor.
    const pickGizmo = (event: PointerEvent): { axis: AxisName; kind: 'arrow' | 'scale' | 'rotate' } | null => {
      getPointer(event)
      raycaster.setFromCamera(pointer, activeCamera)
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
      // ViewCube / axis indicator hits are consumed here, before any other interaction —
      // both widgets only make sense while orbiting, so they're inert in walk mode.
      if (dataRef.current.cameraMode === 'orbit' && event.button === 0) {
        const rect = renderer.domElement.getBoundingClientRect()
        if (dataRef.current.showViewCube) {
          const box = overlayRect('top-right', VIEW_CUBE_DIM, rect)
          if (pointInRect(event.clientX, event.clientY, box)) {
            const ndc = ndcInRect(event.clientX, event.clientY, box)
            viewCube.scene.updateMatrixWorld(true)
            overlayRaycaster.setFromCamera(ndc, viewCube.camera)

            const homeHit = overlayRaycaster.intersectObject(viewCube.homeSprite, false)[0]
            if (homeHit) {
              applyPoseRef.current(dataRef.current.startCamera)
              dataRef.current.onOrthographicChange?.(false)
              return
            }
            const currentDirection = camera.position.clone().sub(controls.target).normalize()
            if (matchFaceView(currentDirection) !== null) {
              const arrowHit = overlayRaycaster.intersectObjects(viewCube.arrows.map((arrow) => arrow.sprite), false)[0]
              if (arrowHit) {
                const kind = arrowHit.object.userData.kind as ArrowKind
                const currentUp = camera.up.clone()
                const next = kind.startsWith('roll')
                  ? rollView(currentDirection, currentUp, kind.replace('roll-', '') as 'left' | 'right')
                  : nudgeView(currentDirection, currentUp, kind as 'up' | 'down' | 'left' | 'right')
                applyViewOrientation(next.direction, next.up)
                dataRef.current.onOrthographicChange?.(true)
                return
              }
            }
            const hit = overlayRaycaster.intersectObjects([viewCube.cubeMesh, ...viewCube.corners], false)[0]
            if (hit) {
              const direction = hit.object === viewCube.cubeMesh
                ? viewCube.faceDirections[hit.face!.materialIndex]
                : (hit.object.userData.direction as THREE.Vector3)
              snapCameraTo(direction)
              dataRef.current.onOrthographicChange?.(true)
            }
            return
          }
        }
        if (dataRef.current.showAxisIndicator) {
          const box = overlayRect('bottom-left', AXIS_INDICATOR_DIM, rect)
          if (pointInRect(event.clientX, event.clientY, box)) {
            const ndc = ndcInRect(event.clientX, event.clientY, box)
            axisIndicator.group.updateMatrixWorld(true)
            overlayRaycaster.setFromCamera(ndc, axisIndicator.camera)
            const hit = overlayRaycaster.intersectObjects(axisIndicator.interactiveObjects, false)[0]
            if (hit) snapCameraTo(hit.object.userData.direction as THREE.Vector3)
            return
          }
        }
      }
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
            raycaster.setFromCamera(pointer, activeCamera)
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
              raycaster.setFromCamera(pointer, activeCamera)
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
            raycaster.setFromCamera(pointer, activeCamera)
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

      if (dataRef.current.cameraMode === 'orbit' && !axisDragging && !scaleDragging && !rotateDragging && !dragging) {
        const rect = renderer.domElement.getBoundingClientRect()
        let overlayHovered = false
        if (dataRef.current.showViewCube) {
          const box = overlayRect('top-right', VIEW_CUBE_DIM, rect)
          if (pointInRect(event.clientX, event.clientY, box)) {
            overlayHovered = true
            const ndc = ndcInRect(event.clientX, event.clientY, box)
            viewCube.scene.updateMatrixWorld(true)
            overlayRaycaster.setFromCamera(ndc, viewCube.camera)

            const homeHit = overlayRaycaster.intersectObject(viewCube.homeSprite, false)[0]
            viewCube.setHomeHover(!!homeHit)

            const arrowHit = homeHit ? undefined : overlayRaycaster.intersectObjects(viewCube.arrows.map((arrow) => arrow.sprite), false)[0]
            viewCube.setArrowHover((arrowHit?.object as THREE.Sprite | undefined) ?? null)

            const hit = homeHit || arrowHit ? undefined : overlayRaycaster.intersectObjects([viewCube.cubeMesh, ...viewCube.corners], false)[0]
            viewCube.setFaceHover(hit && hit.object === viewCube.cubeMesh ? hit.face!.materialIndex : null)
            viewCube.setCornerHover(hit && hit.object !== viewCube.cubeMesh ? (hit.object as THREE.Mesh) : null)
          } else {
            viewCube.setFaceHover(null)
            viewCube.setCornerHover(null)
            viewCube.setHomeHover(false)
            viewCube.setArrowHover(null)
          }
        }
        if (dataRef.current.showAxisIndicator) {
          const box = overlayRect('bottom-left', AXIS_INDICATOR_DIM, rect)
          if (pointInRect(event.clientX, event.clientY, box)) {
            overlayHovered = true
            const ndc = ndcInRect(event.clientX, event.clientY, box)
            axisIndicator.group.updateMatrixWorld(true)
            overlayRaycaster.setFromCamera(ndc, axisIndicator.camera)
            const hit = overlayRaycaster.intersectObjects(axisIndicator.interactiveObjects, false)[0]
            axisIndicator.setHover((hit?.object as THREE.Sprite) ?? null)
          } else {
            axisIndicator.setHover(null)
          }
        }
        if (overlayHovered) return
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
        raycaster.setFromCamera(pointer, activeCamera)
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
        raycaster.setFromCamera(pointer, activeCamera)
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
        raycaster.setFromCamera(pointer, activeCamera)
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
      raycaster.setFromCamera(pointer, activeCamera)
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
        const normalized = lastRotateValue.map((value) => ((value % twoPi) + twoPi) % twoPi) as [number, number, number]
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
      syncGizmo()
      if (dataRef.current.cameraMode === 'walk') {
        const isSprinting = pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')
        const speed = isSprinting ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED
        let dx = 0
        let dz = 0
        pressedKeys.forEach((code) => { const [x, z] = MOVE_KEYS[code] ?? [0, 0]; dx += x; dz += z })
        if (dx !== 0 || dz !== 0) {
          const length = Math.hypot(dx, dz) || 1
          const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current))
          const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current))
          const step = (speed * delta) / length
          camera.position.addScaledVector(forward, dz * step)
          camera.position.addScaledVector(right, dx * step)
        }
        let dy = 0
        pressedKeys.forEach((code) => { dy += VERTICAL_KEYS[code] ?? 0 })
        if (dy !== 0) {
          camera.position.y = Math.max(MIN_FLY_HEIGHT, camera.position.y + dy * speed * delta)
        }
      } else {
        controls.update()
      }

      // Orthographic mode reuses the perspective camera's live position/rotation, only
      // swapping the projection — see the orthoCamera comment near its declaration.
      const useOrtho = dataRef.current.cameraMode === 'orbit' && dataRef.current.orthographic
      if (useOrtho) {
        const distance = Math.max(camera.position.distanceTo(controls.target), 0.01)
        const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        const halfWidth = halfHeight * camera.aspect
        orthoCamera.left = -halfWidth
        orthoCamera.right = halfWidth
        orthoCamera.top = halfHeight
        orthoCamera.bottom = -halfHeight
        orthoCamera.near = camera.near
        orthoCamera.far = camera.far
        orthoCamera.position.copy(camera.position)
        orthoCamera.quaternion.copy(camera.quaternion)
        orthoCamera.updateProjectionMatrix()
      }
      activeCamera = useOrtho ? orthoCamera : camera

      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, width, height)
      renderer.render(scene, activeCamera)

      if (dataRef.current.cameraMode === 'orbit') {
        if (dataRef.current.showViewCube) {
          const currentDirection = camera.position.clone().sub(controls.target).normalize()
          viewCube.syncToCamera(currentDirection, camera.up)
          viewCube.setArrowsVisible(matchFaceView(currentDirection) !== null)
          renderer.clearDepth()
          renderer.setScissorTest(true)
          const x = width - OVERLAY_MARGIN - VIEW_CUBE_DIM
          const y = height - OVERLAY_MARGIN - VIEW_CUBE_DIM
          renderer.setScissor(x, y, VIEW_CUBE_DIM, VIEW_CUBE_DIM)
          renderer.setViewport(x, y, VIEW_CUBE_DIM, VIEW_CUBE_DIM)
          renderer.render(viewCube.scene, viewCube.camera)
        }
        if (dataRef.current.showAxisIndicator) {
          axisIndicator.group.quaternion.copy(camera.quaternion).invert()
          renderer.clearDepth()
          renderer.setScissorTest(true)
          renderer.setScissor(OVERLAY_MARGIN, OVERLAY_MARGIN, AXIS_INDICATOR_DIM, AXIS_INDICATOR_DIM)
          renderer.setViewport(OVERLAY_MARGIN, OVERLAY_MARGIN, AXIS_INDICATOR_DIM, AXIS_INDICATOR_DIM)
          renderer.render(axisIndicator.group, axisIndicator.camera)
        }
        renderer.setScissorTest(false)
      }
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
      viewCube.dispose()
      axisIndicator.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      objectsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
          else child.material.dispose()
        }
      })
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
    let cancelled = false
    setEnvStatus({ state: 'loading', progress: 0 })
    loadEnvironment(environmentId, { onProgress: (ratio) => { if (!cancelled) setEnvStatus({ state: 'loading', progress: ratio }) } })
      .then((loaded) => {
        if (cancelled) { loaded.dispose(); return }
        const holder = environmentGroupRef.current
        holder?.clear()
        holder?.add(loaded.group)
        currentEnvDisposeRef.current?.()
        currentEnvDisposeRef.current = loaded.dispose
        setEnvStatus({ state: 'ready', progress: 1 })
        applyPoseRef.current(dataRef.current.startCamera)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setEnvStatus({ state: 'error', progress: 0, message: error instanceof Error ? error.message : 'Failed to load environment' })
      })
    return () => { cancelled = true }
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
      {envStatus.state !== 'ready' && (
        <div className="viewport-overlay">
          {envStatus.state === 'loading' ? (
            <>
              <div className="spinner" />
              <p>Loading environment…</p>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(envStatus.progress * 100)}%` }} /></div>
            </>
          ) : (
            <>
              <p className="overlay-error">Could not load this environment.</p>
              <p className="overlay-detail">{envStatus.message}</p>
              <button className="button subtle" onClick={() => setReloadToken((value) => value + 1)}>Retry</button>
            </>
          )}
        </div>
      )}
      {hint && <div className="viewport-hint">{hint}</div>}
      {cameraMode === 'orbit' && showViewCube && <div className="viewcube-backdrop" />}
      {cameraMode === 'orbit' && showAxisIndicator && <div className="axis-indicator-backdrop" />}
      {cameraMode === 'orbit' && orthographic && <div className="viewport-projection-badge">Orthographic</div>}
    </div>
  )
})

export default Viewport
