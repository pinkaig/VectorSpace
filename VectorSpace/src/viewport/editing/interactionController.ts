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
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Authoring boundary: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 */
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SceneObject } from '../../project/model'
import type { RuntimeEvent } from '@vectorspace/interaction'
import type { AxisName, AxisArrow } from '../../gizmo/types'
import { AXIS_COLORS, AXIS_HOVER_COLORS, ORIGIN_COLOR, ORIGIN_HOVER_COLOR } from '../../gizmo/colors'
import { closestPointOnAxis, angleAroundAxis } from '../../gizmo/math'
import { setArrowColor } from '../../gizmo/moveGizmo'
import type { AxisScaleHandle } from '../../gizmo/scaleGizmo'
import { setScaleHandleColor } from '../../gizmo/scaleGizmo'
import type { AxisRotateHandle } from '../../gizmo/rotateGizmo'
import { setRotateHandleColor } from '../../gizmo/rotateGizmo'
import type { ArrowKind } from './octaOrb'
import { matchFaceView, nudgeView, rollView } from './viewSnap'
import { artefactLocalCenter } from '../syncArtefacts'
import { LOOK_SENSITIVITY, MOVE_KEYS, SPRINT_KEYS, VERTICAL_KEYS, isTypingTarget } from '../viewportTypes'
import { normalizeAngle } from '../interactionMath'
import type { OriginHandle } from '../../gizmo/originHandle'
import type { UniformScaleHandle } from '../../gizmo/uniformScaleHandle'
import { setUniformScaleHandleColor, UNIFORM_SCALE_COLOR, UNIFORM_SCALE_HOVER_COLOR } from '../../gizmo/uniformScaleHandle'
import { setOriginHandleColor } from '../../gizmo/originHandle'
import type { ViewportOverlays } from './overlayWidgets'
import { createDragSessions } from './dragSessions'
import { ndcInRect, overlayDims, overlayRect, pointInRect } from './overlayWidgets'

export type InteractionCameraMode = 'orbit' | 'walk'
export type InteractionGizmoMode = 'select' | 'move' | 'rotate' | 'scale'

export interface ViewportInteractionData {
  objects: readonly SceneObject[]
  selectedId: string | null
  gizmoMode: InteractionGizmoMode
  scaleSpace: 'world' | 'local'
  rotateSpace: 'world' | 'local'
  cameraMode: InteractionCameraMode
  showOctaOrb: boolean
  showAxisIndicator: boolean
  // Widgets shrink in the quad layout (overlayDims), so their hit boxes must too.
  compactOverlays: boolean
  // Object ids whose asset is still resolving or failed to resolve. Raycasting
  // skips these so a click can't select or drag an object with no confirmed
  // visual representation yet — see https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager.
  // Links point at the project wiki; migration is still in progress.
  unpickableAssetIds: ReadonlySet<string>
  // True only while the WHEN→DO runtime is live. Gates the extra picking these
  // listeners do for Tier 1 events, so authoring pays nothing for them.
  runtimeActive: boolean
  // True while a modal text panel is open. The text system only reports this
  // (one one-way boolean, per its modal-input-boundary decision); what it means
  // for input is decided here: pointer picking, look, drags, runtime key
  // triggers, and walk movement all pause until the panel closes.
  modalOpen: boolean
}

export interface ViewportInteractionCallbacks {
  getData: () => ViewportInteractionData
  select: (id: string | null) => void
  commitMove: (id: string, position: [number, number, number]) => void
  commitScale: (id: string, scale: [number, number, number]) => void
  commitRotate: (id: string, rotation: [number, number, number], position?: [number, number, number]) => void
  // OctaOrb / axis-indicator navigation — camera policy lives in cameraController and
  // is invoked through Viewport.tsx, which owns applyPoseRef and the orthographic state.
  applyStartPose: () => void
  applyOrientation: (direction: THREE.Vector3, up: THREE.Vector3) => void
  snapTo: (direction: THREE.Vector3) => void
  setOrthographic: (value: boolean) => void
  showOctaOrbTooltip: (label: string, clientX: number, clientY: number) => void
  hideOctaOrbTooltip: () => void
  /**
   * WHEN→DO Tier 1 input events (click/hover/key), emitted from the same real
   * browser listeners below rather than polled. This is an independent path from
   * the gizmo/drag commit callbacks above: a runtime click never edits the
   * project, and an editor drag never fires a rule. Absent in edit mode, so the
   * listeners do no runtime work at all while authoring.
   */
  onRuntimeEvent?: (event: RuntimeEvent) => void
}

export interface ViewportInteractionInput {
  element: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  // The camera actually used for scene raycasting — swaps to the orthographic camera
  // while orthographic mode is active, since ortho rays aren't perspective rays.
  // `camera` above stays the real perspective camera for orientation/world-direction math.
  activeCamera: { current: THREE.Camera }
  overlays: ViewportOverlays
  objectsGroup: THREE.Group
  gizmoGroup: THREE.Group
  axisArrows: readonly AxisArrow[]
  scaleHandles: readonly AxisScaleHandle[]
  rotateHandles: readonly AxisRotateHandle[]
  originHandle: OriginHandle
  uniformScaleHandle: UniformScaleHandle
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
  const { element, camera, controls, raycaster, pointer, activeCamera, overlays, objectsGroup, gizmoGroup, axisArrows, scaleHandles, rotateHandles, originHandle, uniformScaleHandle, yaw, pitch, callbacks, interactive } = input

  let looking: { startPointerX: number; startPointerY: number; startYaw: number; startPitch: number } | null = null
  const pressedKeys = new Set<string>()
  // Where the pointer went down, so a runtime click can be distinguished from a
  // drag or a look-around by the same distance rule selection already uses.
  let pointerDownAt: { x: number; y: number } | null = null
  // Last object reported hovered, so hover fires once on entering an object and
  // once on leaving — the same edge-triggered discipline the zone tracker uses,
  // rather than one event per pointermove.
  let hoveredRuntimeId: string | null = null
  const dragPoint = new THREE.Vector3()
  const overlayRaycaster = new THREE.Raycaster()
  const overlayPointer = new THREE.Vector2()

  // Rays and drag planes are inherently world-space, so drag math runs in world
  // space and is converted back to the mesh's local space only when writing to
  // it or committing to the project. Identity when the mesh's parent is
  // objectsGroup (i.e. the object is top-level), so top-level drag behaviour is
  // unchanged by these conversions.
  const worldPositionOf = (mesh: THREE.Object3D) => mesh.getWorldPosition(new THREE.Vector3())
  const worldQuaternionOf = (mesh: THREE.Object3D) => mesh.getWorldQuaternion(new THREE.Quaternion())

  const getPointer = (event: PointerEvent) => {
  // In pointer lock mode, the mouse position stays fixed.
  // Use the screen center (crosshair) for picking and hover raycasts.
    if (document.pointerLockElement === element) {
      pointer.x = 0
      pointer.y = 0
      return
    }
    const rect = element.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  const dragSessions = createDragSessions({
  raycaster, pointer, activeCamera, objectsGroup, gizmoGroup, getPointer,
  callbacks: { commitMove: callbacks.commitMove, commitScale: callbacks.commitScale, commitRotate: callbacks.commitRotate },
})
  const pick = (event: PointerEvent) => {
    getPointer(event)
    raycaster.setFromCamera(pointer, activeCamera.current)
    // An object whose asset is still resolving or has failed has no confirmed
    // visual representation yet, so it must not be selectable or draggable.
    const { unpickableAssetIds, runtimeActive } = callbacks.getData()
    // Recursive because objects nest (parentId) and a `model` artefact is a Group of
    // sub-meshes; each hit is walked up to the nearest ancestor stamped with
    // userData.entityId, then checked for pickability. Non-pickable hits are skipped
    // so an object behind a disabled/unresolved one can still be selected.
    for (const hit of raycaster.intersectObjects(objectsGroup.children, true)) {
      let node: THREE.Object3D | null = hit.object
      while (node && node.userData.entityId === undefined) node = node.parent
      if (!node || !hit.object.visible) continue
      // Disabled objects stay clickable while editing so they can be re-enabled or moved;
      // they only become inert once the simulation is running.
      if (!node.visible || (node.userData.enabled === false && runtimeActive)) continue
      if (unpickableAssetIds.has(node.userData.entityId as string)) continue
      return node
    }
    return null
  }

  // Gizmo hits are kept separate from artefact hits because they start a
  // constrained transform session rather than selecting a scene object.
  const pickGizmo = (event: PointerEvent): { kind: 'origin' } | { kind: 'uniformScale' } | { axis: AxisName; kind: 'arrow' | 'scale' | 'rotate' } | null => {
    getPointer(event)
    raycaster.setFromCamera(pointer, activeCamera.current)
    const mode = callbacks.getData().gizmoMode
    if (mode === 'move') {
      if (raycaster.intersectObject(originHandle.mesh, true)[0]) return { kind: 'origin' }
      for (const arrow of axisArrows) if (raycaster.intersectObjects(arrow.group.children, true)[0]) return { axis: arrow.axis, kind: 'arrow' }
    }
    if (mode === 'scale') {
      if (raycaster.intersectObject(uniformScaleHandle.mesh, true)[0]) return { kind: 'uniformScale' }
      for (const handle of scaleHandles) if (raycaster.intersectObjects(handle.group.children, true)[0]) return { axis: handle.axis, kind: 'scale' }
    }
    if (mode === 'rotate') {
      for (const handle of rotateHandles) if (raycaster.intersectObject(handle.mesh, true)[0]) return { axis: handle.axis, kind: 'rotate' }
    }
    return null
  }
  const resetColours = () => {
    axisArrows.forEach((arrow) => setArrowColor(arrow, AXIS_COLORS[arrow.axis]))
    scaleHandles.forEach((handle) => setScaleHandleColor(handle, AXIS_COLORS[handle.axis]))
    rotateHandles.forEach((handle) => setRotateHandleColor(handle, AXIS_COLORS[handle.axis]))
    setOriginHandleColor(originHandle, ORIGIN_COLOR)
    setUniformScaleHandleColor(uniformScaleHandle, UNIFORM_SCALE_COLOR)
  }

  // OctaOrb / axis-indicator hit-testing. Both widgets render into their own small
  // overlay camera inside a corner of the canvas, so hits are resolved against that
  // camera and the corner's own screen rect rather than the main scene raycaster.
  // Consumes the pointerdown (returns true) whenever the click lands inside a visible
  // widget's box, even if it misses every target inside it — the click still shouldn't
  // fall through to walk-look or scene/gizmo picking underneath the widget.
  // Nearest face/edge orb under the overlay ray. The solid body is tested too: if it's
  // hit first, the orb behind it is on the far side and out of sight, so nothing is picked.
  const pickOctaOrbTarget = (): THREE.Intersection | undefined => {
    const { body, vertexMeshes, edgeMeshes } = overlays.octaOrb
    const hit = overlayRaycaster.intersectObjects([body, ...vertexMeshes, ...edgeMeshes], false)[0]
    return hit && hit.object !== body ? hit : undefined
  }

  const tryOverlayPointerDown = (event: PointerEvent): boolean => {
    const data = callbacks.getData()
    const rect = element.getBoundingClientRect()
    if (data.showOctaOrb) {
      const box = overlayRect('top-right', overlayDims(data.compactOverlays).octaOrb, rect)
      if (pointInRect(event.clientX, event.clientY, box)) {
        const ndc = ndcInRect(event.clientX, event.clientY, box, overlayPointer)
        overlays.octaOrb.scene.updateMatrixWorld(true)
        overlayRaycaster.setFromCamera(ndc, overlays.octaOrb.camera)

        const homeHit = overlayRaycaster.intersectObject(overlays.octaOrb.homeSprite, false)[0]
        if (homeHit) {
          callbacks.applyStartPose()
          callbacks.setOrthographic(false)
          return true
        }
        const currentDirection = camera.position.clone().sub(controls.target).normalize()
        if (matchFaceView(currentDirection) !== null) {
          const arrowHit = overlayRaycaster.intersectObjects(overlays.octaOrb.arrows.map((arrow) => arrow.sprite), false)[0]
          if (arrowHit) {
            const kind = arrowHit.object.userData.kind as ArrowKind
            const currentUp = camera.up.clone()
            const next = kind.startsWith('roll')
              ? rollView(currentDirection, currentUp, kind.replace('roll-', '') as 'left' | 'right')
              : nudgeView(currentDirection, currentUp, kind as 'up' | 'down' | 'left' | 'right')
            callbacks.applyOrientation(next.direction, next.up)
            callbacks.setOrthographic(true)
            return true
          }
        }
        const vertexHit = pickOctaOrbTarget()
        if (vertexHit) {
          callbacks.snapTo(vertexHit.object.userData.direction as THREE.Vector3)
          // Orthographic only suits flat face views; an edge view keeps its perspective.
          callbacks.setOrthographic(overlays.octaOrb.vertexMeshes.includes(vertexHit.object as THREE.Mesh))
        }
        return true
      }
    }
    if (data.showAxisIndicator) {
      const box = overlayRect('bottom-left', overlayDims(data.compactOverlays).axisIndicator, rect)
      if (pointInRect(event.clientX, event.clientY, box)) {
        const ndc = ndcInRect(event.clientX, event.clientY, box, overlayPointer)
        overlays.axisIndicator.group.updateMatrixWorld(true)
        overlayRaycaster.setFromCamera(ndc, overlays.axisIndicator.camera)
        const hit = overlayRaycaster.intersectObjects(overlays.axisIndicator.interactiveObjects, false)[0]
        if (hit) callbacks.snapTo(hit.object.userData.direction as THREE.Vector3)
        return true
      }
    }
    return false
  }

  // Hover feedback for the same two widgets. Returns whether the pointer is over
  // either box, so the caller can skip gizmo-hover handling underneath them.
  const tryOverlayPointerMove = (event: PointerEvent): boolean => {
    const data = callbacks.getData()
    const rect = element.getBoundingClientRect()
    let overlayHovered = false
    if (data.showOctaOrb) {
      const box = overlayRect('top-right', overlayDims(data.compactOverlays).octaOrb, rect)
      if (pointInRect(event.clientX, event.clientY, box)) {
        overlayHovered = true
        const ndc = ndcInRect(event.clientX, event.clientY, box, overlayPointer)
        overlays.octaOrb.scene.updateMatrixWorld(true)
        overlayRaycaster.setFromCamera(ndc, overlays.octaOrb.camera)

        const homeHit = overlayRaycaster.intersectObject(overlays.octaOrb.homeSprite, false)[0]
        overlays.octaOrb.setHomeHover(!!homeHit)

        // Raycasting ignores `visible`, so filter out the arrows hidden off a face view.
        const visibleArrows = overlays.octaOrb.arrows.map((arrow) => arrow.sprite).filter((sprite) => sprite.visible)
        const arrowHit = homeHit ? undefined : overlayRaycaster.intersectObjects(visibleArrows, false)[0]
        overlays.octaOrb.setArrowHover((arrowHit?.object as THREE.Sprite | undefined) ?? null)

        const hit = homeHit || arrowHit ? undefined : pickOctaOrbTarget()
        overlays.octaOrb.setVertexHover((hit?.object as THREE.Mesh | undefined) ?? null)
        if (hit) callbacks.showOctaOrbTooltip(hit.object.userData.label as string, event.clientX, event.clientY)
        else callbacks.hideOctaOrbTooltip()
      } else {
        overlays.octaOrb.setVertexHover(null)
        overlays.octaOrb.setHomeHover(false)
        overlays.octaOrb.setArrowHover(null)
        callbacks.hideOctaOrbTooltip()
      }
    }
    if (data.showAxisIndicator) {
      const box = overlayRect('bottom-left', overlayDims(data.compactOverlays).axisIndicator, rect)
      if (pointInRect(event.clientX, event.clientY, box)) {
        overlayHovered = true
        const ndc = ndcInRect(event.clientX, event.clientY, box, overlayPointer)
        overlays.axisIndicator.group.updateMatrixWorld(true)
        overlayRaycaster.setFromCamera(ndc, overlays.axisIndicator.camera)
        const hit = overlayRaycaster.intersectObjects(overlays.axisIndicator.interactiveObjects, false)[0]
        overlays.axisIndicator.setHover((hit?.object as THREE.Sprite) ?? null)
      } else {
        overlays.axisIndicator.setHover(null)
      }
    }
    return overlayHovered
  }

  // OctaOrb / axis indicator hits are consumed before anything else - both widgets
  // only make sense while orbiting, so they're inert (and not hit-tested) in walk mode.
  // Runs in the capture phase and stops the event outright: OrbitControls listens for
  // pointerdown on this same element and was registered first, so without this every
  // widget click also began an orbit drag - the slightest mouse movement during the
  // click then rotated the camera straight back off the face it had just snapped to.
  const onOverlayPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || callbacks.getData().cameraMode !== 'orbit') return
    if (!tryOverlayPointerDown(event)) return
    pointerDownAt = { x: event.clientX, y: event.clientY }
    event.stopImmediatePropagation()
  }

  const onPointerDown = (event: PointerEvent) => {
    const data = callbacks.getData()
    if (data.modalOpen) return
    if (event.button === 0) pointerDownAt = { x: event.clientX, y: event.clientY }
    if (data.cameraMode === 'walk') {
      if (event.button !== 0) return
      // Run simulation: mouse-look is driven by pointer lock (in onPointerMove), not
      // click-and-drag.
      if (!interactive && data.runtimeActive) {
        if (document.pointerLockElement !== element) element.requestPointerLock()
        return
      }
      looking = { startPointerX: event.clientX, startPointerY: event.clientY, startYaw: yaw.current, startPitch: pitch.current }
      element.setPointerCapture(event.pointerId)
      return
    }

    // Camera look/walk navigation always works; object selection, dragging, and the
    // gizmo are editing actions and stay off in read-only (e.g. visitor simulation) mode.
    if (!interactive || event.button !== 0) return
    const gizmoHit = pickGizmo(event)
    const selected = data.objects.find((object) => object.id === data.selectedId)
    const selectedMesh = selected ? objectsGroup.getObjectByName(selected.id) : undefined

    if (gizmoHit && selected && selectedMesh) {
      const origin = worldPositionOf(selectedMesh)
      const worldQuaternion = worldQuaternionOf(selectedMesh)

    if (gizmoHit.kind === 'origin') {
      const cameraForward = camera.getWorldDirection(new THREE.Vector3())
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward, origin)
      
      if (raycaster.ray.intersectPlane(plane, dragPoint)) {
        controls.enabled = false
        dragSessions.beginFreeDrag({ id: selected.id, plane, offset: origin.clone().sub(dragPoint) })
      }
    } else if (gizmoHit.kind === 'uniformScale') { // clicked the center scale cube, start a uniform-scale drag
      const cameraForward = camera.getWorldDirection(new THREE.Vector3())
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward, origin) // camera-facing plane, same technique as free-move
      const hitPoint = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        controls.enabled = false
        dragSessions.beginUniformScaleDrag({
          id: selected.id,
          origin,
          cameraForward,
          grabDistance: Math.max(0.01, hitPoint.distanceTo(origin)), // baseline distance, ratio to this drives the scale factor
          startScale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
        })
      }
    } else if (gizmoHit.kind === 'arrow') {
        const arrow = axisArrows.find((item) => item.axis === gizmoHit.axis)!
        getPointer(event); raycaster.setFromCamera(pointer, activeCamera.current)
        const grabT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, origin, arrow.direction)
        
        if (grabT !== null) { controls.enabled = false;  dragSessions.beginAxisDrag({ id: selected.id, origin, direction: arrow.direction.clone(), grabT }) }
    } else if (gizmoHit.kind === 'scale') {
        const handle = scaleHandles.find((item) => item.axis === gizmoHit.axis)!
        const direction = data.scaleSpace === 'local' ? handle.direction.clone().applyQuaternion(worldQuaternion) : handle.direction.clone()
        getPointer(event); raycaster.setFromCamera(pointer, activeCamera.current)
        const grabT = closestPointOnAxis(raycaster.ray.origin, raycaster.ray.direction, origin, direction)
        
        if (grabT !== null) { controls.enabled = false;  dragSessions.beginScaleDrag({ id: selected.id, axis: handle.axis, origin, direction, grabT, startScale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z] }) }
      } else {
        const handle = rotateHandles.find((item) => item.axis === gizmoHit.axis)!
        const local = data.rotateSpace === 'local'
        
        // Resolve the rotation plane once at grab time. Local rotation still
        // uses a fixed world-space axis for the duration of the drag.
        const normal = local ? handle.normal.clone().applyQuaternion(worldQuaternion) : handle.normal.clone()
        // Rotation pivots about the object's visual centre (where syncGizmo draws the
        // rings), not its origin, which for a model is usually its base.
        const localPivot = artefactLocalCenter(selectedMesh)
        const center = localPivot.clone().applyMatrix4(selectedMesh.matrixWorld)
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center)
        getPointer(event); raycaster.setFromCamera(pointer, activeCamera.current)
        const hitPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, hitPoint)) {
          controls.enabled = false
          const axisIndex = handle.axis === 'x' ? 0 : handle.axis === 'y' ? 1 : 2
          dragSessions.beginRotateDrag({ id: selected.id, axisIndex, center, localPivot, normal, plane, lastAngle: angleAroundAxis(hitPoint, center, normal), spaceMode: local ? 'local' : 'world', currentRotation: [...selected.transform.rotation], currentQuaternion: worldQuaternion.clone() })
        }
      }
      element.setPointerCapture(event.pointerId)
      return
    }
    const hit = pick(event)
    if (!hit) {
      if (data.gizmoMode === 'select') callbacks.select(null) // only deselect on empty click while in Select mode, so the gizmo doesn't vanish while actively transforming
      return
    }
    callbacks.select(hit.name)
    element.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (callbacks.getData().modalOpen) return
    // Run simulation, pointer locked: look follows raw mouse delta every frame, no
    // button held - this is what lets hover/click below keep raycasting from the
    // crosshair as the camera turns
    if (document.pointerLockElement === element) {
      yaw.current -= event.movementX * LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * LOOK_SENSITIVITY, -1.4, 1.4)
      camera.rotation.order = 'YXZ'; camera.rotation.set(pitch.current, yaw.current, 0)
    } else if (looking) {
      yaw.current = looking.startYaw - (event.clientX - looking.startPointerX) * LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(looking.startPitch - (event.clientY - looking.startPointerY) * LOOK_SENSITIVITY, -1.4, 1.4)
      camera.rotation.order = 'YXZ'; camera.rotation.set(pitch.current, yaw.current, 0)
      return
    }
    const noActiveDrag = !dragSessions.isActive()
    // Tier 1 hover, edge-triggered: one event when the pointer enters an object
    // and one when it leaves, never one per move. Skipped during a drag, where
    // the pointer is manipulating rather than pointing, and skipped entirely
    // outside play mode so authoring never pays for this extra raycast.
    if (callbacks.onRuntimeEvent && noActiveDrag && callbacks.getData().runtimeActive) {
      const hitId = pick(event)?.name ?? null
      if (hitId !== hoveredRuntimeId) {
        if (hoveredRuntimeId) callbacks.onRuntimeEvent({ kind: 'hoverExit', objectId: hoveredRuntimeId })
        if (hitId) callbacks.onRuntimeEvent({ kind: 'hover', objectId: hitId })
        hoveredRuntimeId = hitId
      }
    }
    if (noActiveDrag && callbacks.getData().cameraMode === 'orbit' && tryOverlayPointerMove(event)) return
    if (noActiveDrag) {
      const hovering = pickGizmo(event)
      resetColours()
      if (hovering?.kind === 'origin') setOriginHandleColor(originHandle, ORIGIN_HOVER_COLOR)
      if (hovering?.kind === 'uniformScale') setUniformScaleHandleColor(uniformScaleHandle, UNIFORM_SCALE_HOVER_COLOR)
      if (hovering?.kind === 'arrow') setArrowColor(axisArrows.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      if (hovering?.kind === 'scale') setScaleHandleColor(scaleHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      if (hovering?.kind === 'rotate') setRotateHandleColor(rotateHandles.find((item) => item.axis === hovering.axis)!, AXIS_HOVER_COLORS[hovering.axis])
      return
    }

    dragSessions.updatePreview(event)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (callbacks.getData().modalOpen) {
      // a click that opened the modal must not also select behind it
      pointerDownAt = null
      return
    }
    // Tier 1 click, emitted before any editor handling below so it fires in both
    // orbit and walk mode. A pointer that travelled is a drag or a look-around,
    // not a click — same 4px rule selection already uses.
    if (callbacks.onRuntimeEvent && pointerDownAt && event.button === 0 && callbacks.getData().runtimeActive) {
      const travelled = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y)
      if (travelled < 4) {
        const hit = pick(event)
        if (hit) callbacks.onRuntimeEvent({ kind: 'click', objectId: hit.name })
      }
    }

    if (event.button === 0) pointerDownAt = null
    if (looking) {
      const moved = Math.hypot(event.clientX - looking.startPointerX, event.clientY - looking.startPointerY); looking = null
      if (moved < 4) callbacks.select(pick(event)?.name ?? null)
      return
    }

    // Commit only the final preview value. Pointer-move events must not spam
    // the authoring timeline.
    dragSessions.commit()
    controls.enabled = callbacks.getData().cameraMode === 'orbit'
  }
  const onKeyDown = (event: KeyboardEvent) => {
    // Behind a modal panel, keys neither trigger rules nor move the walker;
    // onKeyUp stays ungated so a key held across the open still releases.
    if (callbacks.getData().modalOpen) return
    // Tier 1 key, emitted before the movement-key filter below: a rule may bind
    // any key, not only the ones that drive the camera. Typing in a field is
    // never a runtime trigger. `repeat` is dropped so holding a key fires once.
    if (callbacks.onRuntimeEvent && !isTypingTarget(event.target) && !event.repeat && callbacks.getData().runtimeActive) {
      callbacks.onRuntimeEvent({ kind: 'key', payload: { code: event.code, key: event.key } })
    }
    if (!isTypingTarget(event.target) && ((event.code in MOVE_KEYS) || (event.code in VERTICAL_KEYS) || SPRINT_KEYS.has(event.code))) { if (callbacks.getData().cameraMode === 'walk') event.preventDefault(); pressedKeys.add(event.code) } }
  const onKeyUp = (event: KeyboardEvent) => { pressedKeys.delete(event.code) }
  const onContextMenu = (event: MouseEvent) => { event.preventDefault() }
  const onBlur = () => { pressedKeys.clear() }
  const onPointerLeave = () => { callbacks.hideOctaOrbTooltip() }
  // cursor disappears while pointer-locked and replaced with a crosshair
  // so it's hidden only for as long as the lock is actually held.
  const onPointerLockChange = () => { element.style.cursor = document.pointerLockElement === element ? 'none' : '' }
  element.addEventListener('pointerdown', onOverlayPointerDown, { capture: true })
  element.addEventListener('pointerdown', onPointerDown); element.addEventListener('pointermove', onPointerMove); element.addEventListener('pointerup', onPointerUp); element.addEventListener('contextmenu', onContextMenu); element.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  return {
    isDragging: dragSessions.isActive,
    pressedKeys,
    dispose: () => {
      element.removeEventListener('pointerdown', onOverlayPointerDown, { capture: true })
      element.removeEventListener('pointerdown', onPointerDown); element.removeEventListener('pointermove', onPointerMove); element.removeEventListener('pointerup', onPointerUp); element.removeEventListener('contextmenu', onContextMenu); element.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      // Leaving the run mid-lock (Esc, restart, exit) must always release the
      // cursor - an unmount never fires pointerlockchange on its own.
      if (document.pointerLockElement === element) document.exitPointerLock()
    },
  }
}
