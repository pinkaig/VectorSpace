/**
 * @file        dragSessions.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En (Move + Scale), Goh Pin Kai (Rotate)
 * @brief       Owns the four transform drag sessions (free, axis, scale, rotate)
 *              extracted from interactionController.ts. Each session is
 *              renderer-side preview state only; the project is changed by the
 *              commit callbacks on pointer release, so one drag creates one
 *              history entry.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import * as THREE from "three";
import type { AxisName } from "../gizmo/types";
import { closestPointOnAxis, angleAroundAxis } from "../gizmo/math";
import { normalizeAngle } from "./interactionMath";

export interface DragCommitCallbacks {
  commitMove: (id: string, position: [number, number, number]) => void;
  commitScale: (id: string, scale: [number, number, number]) => void;
  commitRotate: (id: string, rotation: [number, number, number]) => void;
}

export interface DragSessionsInput {
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  activeCamera: { current: THREE.Camera };
  objectsGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  getPointer: (event: PointerEvent) => void;
  callbacks: DragCommitCallbacks;
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
  center: THREE.Vector3;
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

/**
 * Creates a drag-session manager holding all four transform drag types
 * (free, axis, scale, rotate) as private state, with begin/preview/commit
 * entry points for the interaction controller to call into.
 *
 * @param input - Shared references (raycaster, pointer, active camera,
 * object/gizmo groups, a getPointer helper, and the project commit
 * callbacks) needed to preview and commit a drag.
 * @returns An object exposing beginAxisDrag, beginScaleDrag, beginRotateDrag,
 * beginFreeDrag, updatePreview, commit, and isActive.
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
  let lastRotateValue: [number, number, number] | null = null;
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
   * Reports whether any of the four drag sessions is currently active.
   * Used by the interaction controller to gate hover feedback, overlay
   * picking, and OrbitControls re-enabling.
   *
   * @returns True if a free, axis, scale, or rotate drag is in progress.
   */
  const isActive = () =>
    !!dragging || !!axisDragging || !!scaleDragging || !!rotateDragging;

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
      const next = axisDragging.origin
        .clone()
        .addScaledVector(axisDragging.direction, hitT - axisDragging.grabT);
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
      scale[axisIndex] = Math.max(
        0.05,
        scaleDragging.startScale[axisIndex] * (1 + hitT - scaleDragging.grabT),
      );
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
      let rotation: [number, number, number];
      if (rotateDragging.spaceMode === "local") {
        // A local-axis rotation must compose quaternions. Incrementing one
        // Euler component would be wrong after rotation on another axis.
        // currentQuaternion accumulates in world space; convert to local only
        // when writing to the mesh and when deriving the committed Euler.
        rotateDragging.currentQuaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(rotateDragging.normal, step),
        );
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
        rotation = [...rotateDragging.currentRotation];
        rotation[rotateDragging.axisIndex] += step;
        rotateDragging.currentRotation = rotation;
        objectsGroup
          .getObjectByName(rotateDragging.id)
          ?.rotation.set(...rotation);
      }
      lastRotateValue = rotation;
      return;
    }
    if (dragging) {
      getPointer(event);
      raycaster.setFromCamera(pointer, activeCamera.current);
      if (!raycaster.ray.intersectPlane(dragging.plane, dragPoint)) return;
      dragPoint.add(dragging.offset);
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
   * clears all four sessions' state. Called once from onPointerUp, so a
   * whole drag produces exactly one history entry, never one per
   * pointermove event.
   */
  const commit = () => {
    if (axisDragging && lastAxisDragPosition)
      callbacks.commitMove(axisDragging.id, lastAxisDragPosition);
    if (scaleDragging && lastScaleValue)
      callbacks.commitScale(scaleDragging.id, lastScaleValue);
    if (rotateDragging && lastRotateValue)
      callbacks.commitRotate(
        rotateDragging.id,
        lastRotateValue.map(normalizeAngle) as [number, number, number],
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
  };

  return {
    beginAxisDrag,
    beginScaleDrag,
    beginRotateDrag,
    beginFreeDrag,
    updatePreview,
    commit,
    isActive,
  };
};

export type DragSessions = ReturnType<typeof createDragSessions>;
