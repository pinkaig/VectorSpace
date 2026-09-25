/**
 * @file        syncGizmo.ts
 * @brief       Synchronises editor gizmo presentation with the selected object.
 *
 * @responsibility
 * Controls gizmo visibility, placement, handle offsets, local/world orientation,
 * and rotation-ring sizing without changing authored project data.
 *
 * @inputs
 * Three.js gizmo handles, the selected SceneObject, its render mesh, gizmo mode,
 * transform-space settings, and current drag state.
 *
 * @outputs
 * Updated editor-only Three.js gizmo transforms and visibility.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
import * as THREE from "three";
import type { SceneObject } from "../model";
import type { AxisArrow } from "../gizmo/types";
import { extentAlong, extentAlongLocal } from "../gizmo/moveGizmo";
import { AxisScaleHandle } from "../gizmo/scaleGizmo";
import {
  AxisRotateHandle,
  ROTATE_RING_BASE_RADIUS,
} from "../gizmo/rotateGizmo";
import { OriginHandle } from "../gizmo/originHandle";
import { ARROW_LENGTH, GIZMO_GAP } from "./viewportTypes";

export type GizmoMode = "select" | "move" | "rotate" | "scale";
export type TransformSpace = "world" | "local";

export interface GizmoSyncInput {
  gizmoGroup: THREE.Group;
  axisArrows: readonly AxisArrow[];
  scaleHandles: readonly AxisScaleHandle[];
  rotateHandles: readonly AxisRotateHandle[];
  selected: SceneObject | null;
  selectedMesh: THREE.Object3D | undefined;
  mode: GizmoMode;
  scaleSpace: TransformSpace;
  rotateSpace: TransformSpace;
  isDragging: boolean;
  originHandle: OriginHandle;
}

export const syncGizmo = ({
  gizmoGroup,
  axisArrows,
  scaleHandles,
  rotateHandles,
  selected,
  selectedMesh,
  mode,
  scaleSpace,
  rotateSpace,
  isDragging,
  originHandle,
}: GizmoSyncInput): void => {
  gizmoGroup.visible =
    !!selected && (mode === "move" || mode === "scale" || mode === "rotate");
  axisArrows.forEach((arrow) => {
    arrow.group.visible = mode === "move";
  });
  scaleHandles.forEach((handle) => {
    handle.mesh.visible = mode === "scale";
  });
  rotateHandles.forEach((handle) => {
    handle.mesh.visible = mode === "rotate";
  });

  originHandle.mesh.visible = mode == "move";

  if (!selected || !selectedMesh || isDragging) return;

  gizmoGroup.position.copy(selectedMesh.getWorldPosition(new THREE.Vector3()));
  axisArrows.forEach((arrow) => {
    arrow.group.position.set(0, 0, 0);
  });
  originHandle.mesh.position.set(0, 0, 0);

  const isLocalScale = scaleSpace === "local";
  scaleHandles.forEach((handle) => {
    const direction = isLocalScale
      ? handle.direction
          .clone()
          .applyEuler(new THREE.Euler(...selected.transform.rotation))
      : handle.direction;
    const offset =
      (isLocalScale
        ? extentAlongLocal(selectedMesh, handle.axis)
        : extentAlong(selectedMesh, handle.axis)) +
      GIZMO_GAP +
      ARROW_LENGTH;
    handle.mesh.position.copy(direction).multiplyScalar(offset);
  });

  if (mode !== "rotate") return;
  const box = new THREE.Box3().setFromObject(selectedMesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetRadius = Math.max(size.x, size.y, size.z) / 2 + GIZMO_GAP + 0.2;
  const scale = targetRadius / ROTATE_RING_BASE_RADIUS;
  const isLocalRotate = rotateSpace === "local";
  const objectQuaternion = isLocalRotate
    ? new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...selected.transform.rotation),
      )
    : null;
  rotateHandles.forEach((handle) => {
    handle.mesh.scale.setScalar(scale);
    if (objectQuaternion)
      handle.mesh.quaternion
        .copy(objectQuaternion)
        .multiply(handle.baseQuaternion);
    else handle.mesh.quaternion.copy(handle.baseQuaternion);
  });
};
