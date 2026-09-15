/**
 * @file        interactionController.ts
 * @brief       Owns viewport pointer, picking, drag, and keyboard interaction.
 *
 * @responsibility
 * Translates browser input into selection and transform previews, manages free,
 * axis, scale, and rotation drag sessions, and commits only the final value on
 * pointer release through narrow callbacks.
 *
 * @inputs
 * Three.js camera, controls, raycaster, render groups, gizmo handles, camera
 * orientation refs, current viewport data, and authoring callbacks.
 *
 * @outputs
 * Registered browser listeners, renderer-side previews, commit callbacks, and
 * explicit disposal of all listeners.
 *
 * @ownership
 * The controller owns interaction session state, not ProjectData, history, or
 * persistence. The editor callback decides how a committed action is recorded.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 * Authoring boundary: docs/05-subsystems/authoring-engine.md
 */
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SceneObject } from '../model'
import type { AxisName, AxisArrow } from '../gizmo/types'
import { AXIS_COLORS, AXIS_HOVER_COLORS } from '../gizmo/colors'
import { closestPointOnAxis, angleAroundAxis } from '../gizmo/math'
import { setArrowColor } from '../gizmo/moveGizmo'
import type { AxisScaleHandle } from '../gizmo/scaleGizmo'
import { setScaleHandleColor } from '../gizmo/scaleGizmo'
import type { AxisRotateHandle } from '../gizmo/rotateGizmo'
import { setRotateHandleColor } from '../gizmo/rotateGizmo'
import { MOVE_KEYS, SPRINT_KEYS, VERTICAL_KEYS, isTypingTarget } from './viewportTypes'
import { normalizeAngle } from './interactionMath'

export type InteractionCameraMode = 'orbit' | 'walk'
export type InteractionGizmoMode = 'select' | 'move' | 'rotate' | 'scale'

export interface ViewportInteractionData {
  objects: readonly SceneObject[]
  selectedId: string | null
  gizmoMode: InteractionGizmoMode
  scaleSpace: 'world' | 'local'
  rotateSpace: 'world' | 'local'
  cameraMode: InteractionCameraMode
}

export interface ViewportInteractionCallbacks {
  getData: () => ViewportInteractionData
  select: (id: string | null) => void
  commitMove: (id: string, position: [number, number, number]) => void
  commitScale: (id: string, scale: [number, number, number]) => void
  commitRotate: (id: string, rotation: [number, number, number]) => void
}

export interface ViewportInteractionInput {
  element: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  objectsGroup: THREE.Group
  gizmoGroup: THREE.Group
  axisArrows: readonly AxisArrow[]
  scaleHandles: readonly AxisScaleHandle[]
  rotateHandles: readonly AxisRotateHandle[]
  yaw: { current: number }
  pitch: { current: number }
  callbacks: ViewportInteractionCallbacks
  interactive: boolean
}

export interface ViewportInteractionController {
  readonly isDragging: () => boolean
  readonly pressedKeys: ReadonlySet<string>
  dispose: () => void
}

export const createViewportInteractionController = (input: ViewportInteractionInput): ViewportInteractionController => {
  const { element, camera, controls, raycaster, pointer, objectsGroup, gizmoGroup, axisArrows, scaleHandles, rotateHandles, yaw, pitch, callbacks, interactive } = input

  // Each drag state is renderer-side preview state. The project is changed only
  // by the commit callbacks on pointer release, so one drag creates one history entry.
  let dragging: { id: string; plane: THREE.Plane; offset: THREE.Vector3 } | null = null
  let lastDragPosition: [number, number, number] | null = null
  let axisDragging: { id: string; origin: THREE.Vector3; direction: THREE.Vector3; grabT: number } | null = null
  let lastAxisDragPosition: [number, number, number] | null = null
  let scaleDragging: { id: string; axis: AxisName; origin: THREE.Vector3; direction: THREE.Vector3; grabT: number; startScale: [number, number, number] } | null = null
  let lastScaleValue: [number, number, number] | null = null
  let rotateDragging: { id: string; axisIndex: 0 | 1 | 2; center: THREE.Vector3; normal: THREE.Vector3; plane: THREE.Plane; lastAngle: number; spaceMode: 'world' | 'local'; currentRotation: [number, number, number]; currentQuaternion: THREE.Quaternion } | null = null
  let lastRotateValue: [number, number, number] | null = null
  let looking: { startPointerX: number; startPointerY: number; startYaw: number; startPitch: number } | null = null
  const pressedKeys = new Set<string>()
  const dragPoint = new THREE.Vector3()

  const getPointer = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }
  const pick = (event: PointerEvent) => {
    getPointer(event)
    raycaster.setFromCamera(pointer, camera)
    const pickable = objectsGroup.children.filter((object) => object.visible && object.userData.enabled !== false)
    return raycaster.intersectObjects(pickable, false)[0]?.object ?? null
  }

  // Gizmo hits are kept separate from artefact hits because they start a
  // constrained transform session rather than selecting a scene object.
  const pickGizmo = (event: PointerEvent): { axis: AxisName; kind: 'arrow' | 'scale' | 'rotate' } | null => {
    getPointer(event)
    raycaster.setFromCamera(pointer, camera)
    const mode = callbacks.getData().gizmoMode
    if (mode === 'move') for (const arrow of axisArrows) if (raycaster.intersectObjects(arrow.group.children, true)[0]) return { axis: arrow.axis, kind: 'arrow' }
    if (mode === 'scale') for (const handle of scaleHandles) if (raycaster.intersectObject(handle.mesh, true)[0]) return { axis: handle.axis, kind: 'scale' }
    if (mode === 'rotate') for (const handle of rotateHandles) if (raycaster.intersectObject(handle.mesh, true)[0]) return { axis: handle.axis, kind: 'rotate' }
    return null
  }
  const resetColours = () => {
    axisArrows.forEach((arrow) => setArrowColor(arrow, AXIS_COLORS[arrow.axis]))
    scaleHandles.forEach((handle) => setScaleHandleColor(handle, AXIS_COLORS[handle.axis]))
    rotateHandles.forEach((handle) => setRotateHandleColor(handle, AXIS_COLORS[handle.axis]))
  }
  const onPointerDown = (event: PointerEvent) => {
    const data = callbacks.getData()
    if (data.cameraMode === 'walk') {
      if (event.button !== 0) return
      looking = { startPointerX: event.clientX, startPointerY: event.clientY, startYaw: yaw.current, startPitch: pitch.current }
      element.setPointerCapture(event.pointerId)
      return
    }
    if (!interactive || event.button !== 0) return
    const gizmoHit = pickGizmo(event)
    const selected = data.objects.find((object) => object.id === data.selectedId)
    if (gizmoHit && selected) {
      const origin = new THREE.Vector3(...selected.transform.position)
      if (gizmoHit.kind === 'arrow') {
        const arrow = axisArrows.find((item) => item.axis === gizmoHit.axis)!
        getPointer(event); raycaster.setFromCamera(pointer, camera)
        const grabT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, origin, arrow.direction)
        if (grabT !== null) { controls.enabled = false; axisDragging = { id: selected.id, origin, direction: arrow.direction.clone(), grabT } }
      } else if (gizmoHit.kind === 'scale') {
        const handle = scaleHandles.find((item) => item.axis === gizmoHit.axis)!
        const mesh = objectsGroup.getObjectByName(selected.id)
        if (mesh) {
          const direction = data.scaleSpace === 'local' ? handle.direction.clone().applyEuler(new THREE.Euler(...selected.transform.rotation)) : handle.direction.clone()
          getPointer(event); raycaster.setFromCamera(pointer, camera)
          const grabT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, origin, direction)
          if (grabT !== null) { controls.enabled = false; scaleDragging = { id: selected.id, axis: handle.axis, origin, direction, grabT, startScale: [mesh.scale.x, mesh.scale.y, mesh.scale.z] } }
        }
      } else {
        const handle = rotateHandles.find((item) => item.axis === gizmoHit.axis)!
        const local = data.rotateSpace === 'local'
        const objectEuler = new THREE.Euler(...selected.transform.rotation)
        // Resolve the rotation plane once at grab time. Local rotation still
        // uses a fixed world-space axis for the duration of the drag.
        const normal = local ? handle.normal.clone().applyEuler(objectEuler) : handle.normal.clone()
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
        getPointer(event); raycaster.setFromCamera(pointer, camera)
        const hitPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, hitPoint)) {
          controls.enabled = false
          const axisIndex = handle.axis === 'x' ? 0 : handle.axis === 'y' ? 1 : 2
          rotateDragging = { id: selected.id, axisIndex, center: origin, normal, plane, lastAngle: angleAroundAxis(hitPoint, origin, normal), spaceMode: local ? 'local' : 'world', currentRotation: [...selected.transform.rotation], currentQuaternion: new THREE.Quaternion().setFromEuler(objectEuler) }
        }
      }
      element.setPointerCapture(event.pointerId)
      return
    }
    const hit = pick(event)
    if (!hit) { callbacks.select(null); return }
    controls.enabled = false
    callbacks.select(hit.name)
    const item = data.objects.find((object) => object.id === hit.name)
    if (item) {
      const objectPosition = new THREE.Vector3(...item.transform.position)
      const cameraForward = camera.getWorldDirection(new THREE.Vector3())
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward, objectPosition)
      if (raycaster.ray.intersectPlane(plane, dragPoint)) dragging = { id: item.id, plane, offset: objectPosition.clone().sub(dragPoint) }
    }
    element.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (looking) {
      const sensitivity = 0.0045
      yaw.current = looking.startYaw - (event.clientX - looking.startPointerX) * sensitivity
      pitch.current = THREE.MathUtils.clamp(looking.startPitch - (event.clientY - looking.startPointerY) * sensitivity, -1.4, 1.4)
      camera.rotation.order = 'YXZ'; camera.rotation.set(pitch.current, yaw.current, 0)
      return
    }
    if (!axisDragging && !scaleDragging && !rotateDragging && !dragging) {
      const hovering = pickGizmo(event)
      resetColours()
      if (hovering?.kind === 'arrow') setArrowColor(axisArrows.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      if (hovering?.kind === 'scale') setScaleHandleColor(scaleHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      if (hovering?.kind === 'rotate') setRotateHandleColor(rotateHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      return
    }
    if (axisDragging) {
      getPointer(event); raycaster.setFromCamera(pointer, camera)
      const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, axisDragging.origin, axisDragging.direction)
      // A camera looking down the constrained axis produces an unstable
      // closest-point solution; skip that frame instead of jumping.
      if (hitT === null) return
      const next = axisDragging.origin.clone().addScaledVector(axisDragging.direction, hitT - axisDragging.grabT)
      lastAxisDragPosition = [next.x, next.y, next.z]
      const mesh = objectsGroup.getObjectByName(axisDragging.id); mesh?.position.set(...lastAxisDragPosition); gizmoGroup.position.set(...lastAxisDragPosition)
      return
    }
    if (scaleDragging) {
      getPointer(event); raycaster.setFromCamera(pointer, camera)
      const hitT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, scaleDragging.origin, scaleDragging.direction)
      if (hitT === null) return
      const scale = [...scaleDragging.startScale] as [number, number, number]
      const axisIndex = scaleDragging.axis === 'x' ? 0 : scaleDragging.axis === 'y' ? 1 : 2
      scale[axisIndex] = Math.max(0.05, scaleDragging.startScale[axisIndex] * (1 + hitT - scaleDragging.grabT))
      lastScaleValue = scale; objectsGroup.getObjectByName(scaleDragging.id)?.scale.set(...scale)
      return
    }
    if (rotateDragging) {
      getPointer(event); raycaster.setFromCamera(pointer, camera)
      const hitPoint = new THREE.Vector3()
      // A parallel camera ray can miss the rotation plane for a frame.
      if (!raycaster.ray.intersectPlane(rotateDragging.plane, hitPoint)) return
      const angle = angleAroundAxis(hitPoint, rotateDragging.center, rotateDragging.normal)
      // Unwrap atan2 at +/- PI so crossing the seam does not snap the object.
      let step = angle - rotateDragging.lastAngle
      if (step > Math.PI) step -= Math.PI * 2
      if (step < -Math.PI) step += Math.PI * 2
      rotateDragging.lastAngle = angle
      let rotation: [number, number, number]
      if (rotateDragging.spaceMode === 'local') {
        // A local-axis rotation must compose quaternions. Incrementing one
        // Euler component would be wrong after rotation on another axis.
        rotateDragging.currentQuaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rotateDragging.normal, step))
        const euler = new THREE.Euler().setFromQuaternion(rotateDragging.currentQuaternion, 'XYZ'); rotation = [euler.x, euler.y, euler.z]
        objectsGroup.getObjectByName(rotateDragging.id)?.quaternion.copy(rotateDragging.currentQuaternion)
      } else {
        rotation = [...rotateDragging.currentRotation]; rotation[rotateDragging.axisIndex] += step; rotateDragging.currentRotation = rotation
        objectsGroup.getObjectByName(rotateDragging.id)?.rotation.set(...rotation)
      }
      lastRotateValue = rotation; return
    }
    if (dragging) {
      getPointer(event); raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(dragging.plane, dragPoint)) return
      dragPoint.add(dragging.offset); lastDragPosition = [dragPoint.x, dragPoint.y, dragPoint.z]
      objectsGroup.getObjectByName(dragging.id)?.position.set(...lastDragPosition); gizmoGroup.position.set(...lastDragPosition)
    }
  }
  const onPointerUp = (event: PointerEvent) => {
    if (looking) {
      const moved = Math.hypot(event.clientX - looking.startPointerX, event.clientY - looking.startPointerY); looking = null
      if (moved < 4) callbacks.select(pick(event)?.name ?? null)
      return
    }
    // Commit only the final preview value. Pointer-move events must not spam
    // the authoring timeline.
    if (axisDragging && lastAxisDragPosition) callbacks.commitMove(axisDragging.id, lastAxisDragPosition)
    if (scaleDragging && lastScaleValue) callbacks.commitScale(scaleDragging.id, lastScaleValue)
    if (rotateDragging && lastRotateValue) callbacks.commitRotate(rotateDragging.id, lastRotateValue.map(normalizeAngle) as [number, number, number])
    if (dragging && lastDragPosition) callbacks.commitMove(dragging.id, lastDragPosition)
    dragging = null; lastDragPosition = null; axisDragging = null; lastAxisDragPosition = null; scaleDragging = null; lastScaleValue = null; rotateDragging = null; lastRotateValue = null
    controls.enabled = callbacks.getData().cameraMode === 'orbit'
  }
  const onKeyDown = (event: KeyboardEvent) => { if (!isTypingTarget(event.target) && ((event.code in MOVE_KEYS) || (event.code in VERTICAL_KEYS) || SPRINT_KEYS.has(event.code))) { if (callbacks.getData().cameraMode === 'walk') event.preventDefault(); pressedKeys.add(event.code) } }
  const onKeyUp = (event: KeyboardEvent) => { pressedKeys.delete(event.code) }
  const onContextMenu = (event: MouseEvent) => { event.preventDefault() }
  const onBlur = () => { pressedKeys.clear() }
  element.addEventListener('pointerdown', onPointerDown); element.addEventListener('pointermove', onPointerMove); element.addEventListener('pointerup', onPointerUp); element.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur)
  return {
    isDragging: () => !!dragging || !!axisDragging || !!scaleDragging || !!rotateDragging,
    pressedKeys,
    dispose: () => {
      element.removeEventListener('pointerdown', onPointerDown); element.removeEventListener('pointermove', onPointerMove); element.removeEventListener('pointerup', onPointerUp); element.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur)
    },
  }
}
