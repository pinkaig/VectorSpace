/**
 * @file        dragSessions.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En (Move + Scale), Goh Pin Kai (Rotate)
 * @brief       Owns the five transform drag sessions (free, axis, scale, rotate,
 *              uniform scale) extracted from interactionController.ts. Each
 *              session is renderer-side preview state only; the project is
 *              changed by the commit callbacks on pointer release, so one
 *              drag creates one history entry.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import * as THREE from "three";
import type { AxisName } from "../../gizmo/types";
import { closestPointOnAxis, angleAroundAxis } from "../../gizmo/math";
import { normalizeAngle } from "../interactionMath";
import { snapAngle, snapScale, snapToFloorGrid } from "./snapping";

export interface DragCommitCallbacks {
  commitMove: (id: string, position: [number, number, number]) => void;
  commitScale: (id: string, scale: [number, number, number]) => void;
  commitRotate: (
    id: string,
    rotation: [number, number, number],
    position?: [number, number, number],
  ) => void;
}

export interface DragSessionsInput {
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  activeCamera: { current: THREE.Camera };
  objectsGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  getPointer: (event: PointerEvent) => void;
  callbacks: DragCommitCallbacks;
  /** The object panel's Snap switch, read on every move so flipping it mid-drag applies at once. */
  getSnap?: () => boolean;
}

export interface AxisDragParams {
  id: string;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  grabT: number;
}

export interface ScaleDragParams {
  id: string;
  axis: AxisName;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  grabT: number;
  startScale: [number, number, number];
}

export interface RotateDragParams {
  id: string;
  axisIndex: 0 | 1 | 2;
  /** World-space pivot: the object's visual centre at grab time. */
  center: THREE.Vector3;
  /** The same pivot in the object's local space, so its drift can be measured. */
  localPivot: THREE.Vector3;
  normal: THREE.Vector3;
  plane: THREE.Plane;
  lastAngle: number;
  spaceMode: "world" | "local";
  currentRotation: [number, number, number];
  currentQuaternion: THREE.Quaternion;
}

export interface FreeDragParams {
  id: string;
  plane: THREE.Plane;
  offset: THREE.Vector3;
}

// params captured once when the uniform-scale handle is grabbed
export interface UniformScaleDragParams {
  id: string;
  origin: THREE.Vector3;
  cameraForward: THREE.Vector3;
  grabDistance: number;
  startScale: [number, number, number];
}

/**
 * Creates a drag-session manager holding all five transform drag types
 * (free, axis, scale, rotate, uniform scale) as private state, with
 * begin/preview/commit entry points for the interaction controller to call
 * into.
 *
 * @param input - Shared references (raycaster, pointer, active camera,
 * object/gizmo groups, a getPointer helper, and the project commit
 * callbacks) needed to preview and commit a drag.
 * @returns An object exposing beginAxisDrag, beginScaleDrag, beginRotateDrag,
 * beginFreeDrag, beginUniformScaleDrag, updatePreview, commit, and isActive.
 */
export const createDragSessions = (input: DragSessionsInput) => {
  const {
    raycaster,
    pointer,
    activeCamera,
    objectsGroup,
    gizmoGroup,
    getPointer,
    callbacks,
  } = input;
  const snapping = () => input.getSnap?.() ?? false;

  /**
   * With Snap on, puts a world position on the floor grid, but only along the floor
   * directions this drag moves in: an arrow drag snaps only its own axis (so lifting an
   * object does not shift it sideways), a free drag snaps both x and z. Height is never snapped.
   */
  const snapPosition = (world: THREE.Vector3, direction?: THREE.Vector3) => {
    if (!snapping()) return world;
    const [x, , z] = snapToFloorGrid([world.x, world.y, world.z]);
    return new THREE.Vector3(
      !direction || Math.abs(direction.x) > 0.5 ? x : world.x,
      world.y,
      !direction || Math.abs(direction.z) > 0.5 ? z : world.z,
    );
  };

  /**
   * Converts a world-space position into the given mesh's parent's local
   * space, so a drag preview writes the correct value for a nested
   * (parented) object. Identity for a top-level object, since its parent
   * is objectsGroup.
   *
   * @param mesh - The mesh being dragged.
   * @param world - The target position in world space.
   * @returns The equivalent position in the mesh's parent's local space.
   */
  const toLocalPosition = (mesh: THREE.Object3D, world: THREE.Vector3) =>
    mesh.parent && mesh.parent !== objectsGroup
      ? mesh.parent.worldToLocal(world.clone())
      : world.clone();

  /**
   * Converts a world-space quaternion into the given mesh's parent's local
   * space, the rotation equivalent of toLocalPosition. Identity for a
   * top-level object.
   *
   * @param mesh - The mesh being dragged.
   * @param world - The target orientation in world space.
   * @returns The equivalent orientation in the mesh's parent's local space.
   */
  const toLocalQuaternion = (mesh: THREE.Object3D, world: THREE.Quaternion) => {
    if (!mesh.parent || mesh.parent === objectsGroup) return world.clone();
    return mesh.parent
      .getWorldQuaternion(new THREE.Quaternion())
      .invert()
      .multiply(world);
  };

  let dragging: FreeDragParams | null = null;
  let lastDragPosition: [number, number, number] | null = null;
  let axisDragging: AxisDragParams | null = null;
  let lastAxisDragPosition: [number, number, number] | null = null;
  let scaleDragging: ScaleDragParams | null = null;
  let lastScaleValue: [number, number, number] | null = null;
  let rotateDragging: RotateDragParams | null = null;
  // the rotation at grab time and the total turn since, so a snapped angle comes from the whole
  // turn instead of adding up rounded steps
  let rotateStartRotation: [number, number, number] = [0, 0, 0];
  let rotateStartQuaternion = new THREE.Quaternion();
  let rotateTotal = 0;
  let lastRotateValue: [number, number, number] | null = null;
  let lastRotatePosition: [number, number, number] | null = null;
  let uniformScaleDragging: UniformScaleDragParams | null = null; // active uniform-scale session, if any
  let lastUniformScaleValue: [number, number, number] | null = null; // most recent preview value, committed once on release
  const dragPoint = new THREE.Vector3();

  /**
   * Starts a single-axis move session, called when a move-arrow is grabbed.
   *
   * @param params - The object id, the axis origin/direction, and grabT
   * (where along the axis the pointer grabbed it), all resolved by the
   * caller at grab time.
   */
  const beginAxisDrag = (params: AxisDragParams) => {
    axisDragging = params;
  };

  /**
   * Starts a single-axis scale session, called when a scale handle is
   * grabbed.
   *
   * @param params - The object id, axis, axis origin/direction, grabT, and
   * the object's scale at the moment of grab.
   */
  const beginScaleDrag = (params: ScaleDragParams) => {
    scaleDragging = params;
  };

  /**
   * Starts a single-axis rotate session, called when a rotate ring is
   * grabbed.
   *
   * @param params - The object id, which Euler component it maps to, the
   * rotation plane/normal, the starting angle, space mode, and the object's
   * rotation/quaternion at the moment of grab.
   */
  const beginRotateDrag = (params: RotateDragParams) => {
    rotateDragging = params;
    rotateStartRotation = [...params.currentRotation];
    rotateStartQuaternion = params.currentQuaternion.clone();
    rotateTotal = 0;
  };

  /**
   * Starts a free (camera-plane) move session, called when the object's own
   * body is grabbed directly, not through a gizmo handle.
   *
   * @param params - The object id, the camera-facing drag plane, and the
   * grab offset from the object's position to the initial pointer hit on
   * that plane.
   */
  const beginFreeDrag = (params: FreeDragParams) => {
    dragging = params;
  };

  /**
   * Starts a uniform-scale session, called when the center scale handle is
   * grabbed. Scales all three axes together, proportional to how far the
   * pointer moves away from or toward the object's center.
   *
   * @param params - The object id, the object's world position, the
   * camera-facing plane's normal, the initial grab distance from center,
   * and the object's scale at the moment of grab.
   */
  const beginUniformScaleDrag = (params: UniformScaleDragParams) => {
    uniformScaleDragging = params;
  };

  /**
   * Reports whether any of the five drag sessions is currently active.
   * Used by the interaction controller to gate hover feedback, overlay
   * picking, and OrbitControls re-enabling.
   *
   * @returns True if a free, axis, scale, rotate, or uniform-scale drag is
   * in progress.
   */
  const isActive = () =>
    !!dragging ||
    !!axisDragging ||
    !!scaleDragging ||
    !!rotateDragging ||
    !!uniformScaleDragging;

  /**
   * Updates whichever drag session is currently active for this pointer
   * move: re-raycasts, resolves the new position/scale/rotation, writes it
   * directly to the Three.js mesh (and the gizmo group's position) as a
   * preview, and caches the latest value for commit(). Never writes to the
   * project; called every pointermove while a session is active.
   *
   * @param event - The pointermove event driving this frame's preview update.
   */
  const updatePreview = (event: PointerEvent) => {
    if (axisDragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      const hitT = closestPointOnAxis(
        raycaster.ray.origin,
        raycaster.ray.direction,
        axisDragging.origin,
        axisDragging.direction,
      );
      // A camera looking down the constrained axis produces an unstable
      // closest-point solution; skip that frame instead of jumping.
      if (hitT === null) return;
      const next = snapPosition(
        axisDragging.origin
          .clone()
          .addScaledVector(axisDragging.direction, hitT - axisDragging.grabT),
        axisDragging.direction,
      );
      const mesh = objectsGroup.getObjectByName(axisDragging.id);
      if (mesh) {
        const local = toLocalPosition(mesh, next);
        lastAxisDragPosition = [local.x, local.y, local.z];
        mesh.position.copy(local);
      }
      gizmoGroup.position.copy(next);
      return;
    }
    if (scaleDragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      const hitT = closestPointOnAxis(
        raycaster.ray.origin,
        raycaster.ray.direction,
        scaleDragging.origin,
        scaleDragging.direction,
      );
      if (hitT === null) return;
      const scale = [...scaleDragging.startScale] as [number, number, number];
      const axisIndex =
        scaleDragging.axis === "x" ? 0 : scaleDragging.axis === "y" ? 1 : 2;
      const raw = Math.max(
        0.05,
        scaleDragging.startScale[axisIndex] * (1 + hitT - scaleDragging.grabT),
      );
      scale[axisIndex] = snapping() ? snapScale(raw) : raw;
      lastScaleValue = scale;
      objectsGroup.getObjectByName(scaleDragging.id)?.scale.set(...scale);
      return;
    }
    if (rotateDragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      const hitPoint = new THREE.Vector3();
      // A parallel camera ray can miss the rotation plane for a frame.
      if (!raycaster.ray.intersectPlane(rotateDragging.plane, hitPoint)) return;
      const angle = angleAroundAxis(
        hitPoint,
        rotateDragging.center,
        rotateDragging.normal,
      );
      // Unwrap atan2 at +/- PI so crossing the seam does not snap the object.
      let step = angle - rotateDragging.lastAngle;
      if (step > Math.PI) step -= Math.PI * 2;
      if (step < -Math.PI) step += Math.PI * 2;
      rotateDragging.lastAngle = angle;
      rotateTotal += step;
      let rotation: [number, number, number];
      if (rotateDragging.spaceMode === "local") {
        // A local-axis rotation must compose quaternions. Incrementing one
        // Euler component would be wrong after rotation on another axis.
        // currentQuaternion is the grab-time orientation turned by the whole
        // drag so far (snapped to 15° steps with Snap on), in world space;
        // convert to local only when writing to the mesh and when deriving
        // the committed Euler.
        const turn = snapping() ? snapAngle(rotateTotal) : rotateTotal;
        rotateDragging.currentQuaternion
          .setFromAxisAngle(rotateDragging.normal, turn)
          .multiply(rotateStartQuaternion);
        const mesh = objectsGroup.getObjectByName(rotateDragging.id);
        const localQuaternion = mesh
          ? toLocalQuaternion(mesh, rotateDragging.currentQuaternion)
          : rotateDragging.currentQuaternion;
        const euler = new THREE.Euler().setFromQuaternion(
          localQuaternion,
          "XYZ",
        );
        rotation = [euler.x, euler.y, euler.z];
        mesh?.quaternion.copy(localQuaternion);
      } else {
        // with Snap on, the angle itself lands on a 15° step (0°, 15°, 30° ...), not just the turn
        rotation = [...rotateStartRotation];
        const target = rotateStartRotation[rotateDragging.axisIndex] + rotateTotal;
        rotation[rotateDragging.axisIndex] = snapping() ? snapAngle(target) : target;
        rotateDragging.currentRotation = rotation;
        objectsGroup
          .getObjectByName(rotateDragging.id)
          ?.rotation.set(...rotation);
      }
      lastRotateValue = rotation;
      // Rotating turns the object about its own origin, which swings the centre away.
      // Shift the origin by that drift so the centre stays put - i.e. the object turns
      // about its centre, where the rings are drawn.
      const mesh = objectsGroup.getObjectByName(rotateDragging.id);
      if (mesh) {
        mesh.updateMatrixWorld(true);
        const drift = rotateDragging.center
          .clone()
          .sub(rotateDragging.localPivot.clone().applyMatrix4(mesh.matrixWorld));
        const local = toLocalPosition(
          mesh,
          mesh.getWorldPosition(new THREE.Vector3()).add(drift),
        );
        mesh.position.copy(local);
        lastRotatePosition = [local.x, local.y, local.z];
      }
      return;
    }
    if (uniformScaleDragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        uniformScaleDragging.cameraForward,
        uniformScaleDragging.origin,
      );
      const hitPoint = new THREE.Vector3();
      // Camera-parallel ray this frame, skip rather than jump.
      if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      const currentDistance = hitPoint.distanceTo(uniformScaleDragging.origin);
      // Clamp so it can't invert or vanish.
      const rawRatio = Math.max(
        0.05,
        currentDistance / uniformScaleDragging.grabDistance,
      );
      // with Snap on, the whole object grows in steps of 0.25 of its original size; all three
      // axes keep their proportions
      const ratio = snapping() ? snapScale(rawRatio) : rawRatio;
      const nextScale: [number, number, number] = [
        uniformScaleDragging.startScale[0] * ratio,
        uniformScaleDragging.startScale[1] * ratio,
        uniformScaleDragging.startScale[2] * ratio,
      ];
      objectsGroup
        .getObjectByName(uniformScaleDragging.id)
        ?.scale.set(...nextScale);
      lastUniformScaleValue = nextScale;
      return;
    }
    if (dragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      if (!raycaster.ray.intersectPlane(dragging.plane, dragPoint)) return;
      dragPoint.add(dragging.offset);
      dragPoint.copy(snapPosition(dragPoint));
      const mesh = objectsGroup.getObjectByName(dragging.id);
      if (mesh) {
        const local = toLocalPosition(mesh, dragPoint);
        lastDragPosition = [local.x, local.y, local.z];
        mesh.position.copy(local);
      }
      gizmoGroup.position.copy(dragPoint);
    }
  };

  /**
   * Commits only the final preview value of whichever session was active,
   * through the relevant commitMove/commitScale/commitRotate callback, then
   * clears all five sessions' state. Called once from onPointerUp, so a
   * whole drag produces exactly one history entry, never one per
   * pointermove event.
   */
  const commit = () => {
    if (axisDragging && lastAxisDragPosition)
      callbacks.commitMove(axisDragging.id, lastAxisDragPosition);
    if (scaleDragging && lastScaleValue)
      callbacks.commitScale(scaleDragging.id, lastScaleValue);
    // Same commitScale callback as axis-scale, just a different source.
    if (uniformScaleDragging && lastUniformScaleValue)
      callbacks.commitScale(uniformScaleDragging.id, lastUniformScaleValue);
    if (rotateDragging && lastRotateValue)
      callbacks.commitRotate(
        rotateDragging.id,
        lastRotateValue.map(normalizeAngle) as [number, number, number],
        lastRotatePosition ?? undefined,
      );
    if (dragging && lastDragPosition)
      callbacks.commitMove(dragging.id, lastDragPosition);
    dragging = null;
    lastDragPosition = null;
    axisDragging = null;
    lastAxisDragPosition = null;
    scaleDragging = null;
    lastScaleValue = null;
    rotateDragging = null;
    lastRotateValue = null;
    lastRotatePosition = null;
    uniformScaleDragging = null;
    lastUniformScaleValue = null;
  };

  return {
    beginAxisDrag,
    beginScaleDrag,
    beginRotateDrag,
    beginFreeDrag,
    beginUniformScaleDrag,
    updatePreview,
    commit,
    isActive,
  };
};

export type DragSessions = ReturnType<typeof createDragSessions>;