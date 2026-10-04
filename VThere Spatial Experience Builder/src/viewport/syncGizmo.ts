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
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
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
import { UniformScaleHandle } from "../gizmo/uniformScaleHandle";
import { ARROW_LENGTH, GIZMO_GAP } from "./viewportTypes";
import { artefactLocalCenter } from "./syncArtefacts";

export type GizmoMode = "select" | "move" | "rotate" | "scale";
export type TransformSpace = "world" | "local";

const GIZMO_REFERENCE_DISTANCE = 8; // this is the distance from the camera at which the gizmo will be at its reference size (GIZMO_SCREEN_SCALE * viewport height in world units)

export interface GizmoSyncInput {
  gizmoGroup: THREE.Group;
  camera: THREE.Camera;
  controlsTarget: THREE.Vector3;
  isOrtho: boolean;
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
  uniformScaleHandle: UniformScaleHandle;
}

export const syncGizmo = ({
  gizmoGroup,
  camera,
  controlsTarget,
  isOrtho,
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
  uniformScaleHandle,
}: GizmoSyncInput): void => {
  gizmoGroup.visible =
    !!selected && (mode === "move" || mode === "scale" || mode === "rotate");
  axisArrows.forEach((arrow) => {
    arrow.group.visible = mode === "move";
  });
  scaleHandles.forEach((handle) => {
    handle.group.visible = mode === "scale";
  });
  rotateHandles.forEach((handle) => {
    handle.mesh.visible = mode === "rotate";
  });

  originHandle.mesh.visible = mode == "move";
  uniformScaleHandle.mesh.visible = mode === "scale";

  if (!selected || !selectedMesh || isDragging) return;

  // Move/scale sit on the object's origin (a model's base, which placement relies on);
  // rotate sits on its visual centre, which is also the point the rotate drag pivots about.
  if (mode === "rotate") {
    const center = artefactLocalCenter(selectedMesh);
    gizmoGroup.position.copy(center.applyMatrix4(selectedMesh.matrixWorld));
  } else {
    gizmoGroup.position.copy(selectedMesh.getWorldPosition(new THREE.Vector3()));
  }

  const worldUnitsPerScreen = isOrtho
    ? camera.position.distanceTo(controlsTarget)
    : camera.position.distanceTo(gizmoGroup.position);
  const screenScaleFactor = worldUnitsPerScreen / GIZMO_REFERENCE_DISTANCE;

  axisArrows.forEach((arrow) => {
    arrow.group.position.set(0, 0, 0);
    arrow.group.scale.setScalar(screenScaleFactor);
  });
  originHandle.mesh.position.set(0, 0, 0);
  originHandle.mesh.scale.setScalar(screenScaleFactor);

  uniformScaleHandle.mesh.position.set(0, 0, 0);
  uniformScaleHandle.mesh.scale.setScalar(screenScaleFactor);

  const isLocalScale = scaleSpace === "local";
  scaleHandles.forEach((handle) => {
    handle.group.position.set(0, 0, 0);
    handle.group.scale.setScalar(screenScaleFactor);
    if (isLocalScale) {
      const localDirection = handle.direction.clone().applyEuler(new THREE.Euler(...selected.transform.rotation));
      const localRotation = new THREE.Quaternion().setFromUnitVectors(handle.direction, localDirection);
      handle.group.quaternion.copy(localRotation).multiply(handle.baseQuaternion); // compose on top of the base orientation, don't overwrite it
    } else {
      handle.group.quaternion.copy(handle.baseQuaternion); // restore to base orientation, not identity
    }
  });

  if (mode !== "rotate") return;
  const box = new THREE.Box3().setFromObject(selectedMesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetRadius = Math.max(size.x, size.y, size.z) / 2 + GIZMO_GAP + 0.2;
  const scale = (targetRadius / ROTATE_RING_BASE_RADIUS) * screenScaleFactor;
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


