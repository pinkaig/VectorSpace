/**
 * @file        createGizmoSet.ts
 * @brief       Builds and disposes the editor gizmo handle set.
 *
 * @responsibility
 * Assembles move arrows, scale handles, and rotation rings under an editor-only
 * group and provides one disposal owner for their GPU resources.
 *
 * @inputs
 * No project state. Handle geometry is created through the specialised gizmo
 * factories in src/gizmo/.
 *
 * @outputs
 * A GizmoSet containing the group, typed handles, and dispose function.
 *
 * @ownership
 * Gizmos are presentation resources and remain outside the authored artefact
 * hierarchy.
 *
 * @documentation
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import * as THREE from "three";
import { AxisArrow } from "../gizmo/types";
import { makeAxisArrow } from "../gizmo/moveGizmo";
import { AxisScaleHandle, makeAxisScaleHandle } from "../gizmo/scaleGizmo";
import { AxisRotateHandle, makeAxisRotateHandle } from "../gizmo/rotateGizmo";
import { OriginHandle, makeOriginHandle } from "../gizmo/originHandle";
import { UniformScaleHandle, makeUniformScaleHandle } from "../gizmo/uniformScaleHandle";

export interface GizmoSet {
  group: THREE.Group;
  axisArrows: AxisArrow[];
  scaleHandles: AxisScaleHandle[];
  rotateHandles: AxisRotateHandle[];
  originHandle: OriginHandle;
  uniformScaleHandle: UniformScaleHandle;
  dispose: () => void;
}

export const createGizmoSet = (): GizmoSet => {
  const group = new THREE.Group();
  const axisArrows: AxisArrow[] = [
    makeAxisArrow("x"),
    makeAxisArrow("y"),
    makeAxisArrow("z"),
  ];

  // move gizmo: one arrow per axis, built once
  axisArrows.forEach((arrow) => group.add(arrow.group));

  // scale gizmo: one handle per axis, built once
  const scaleHandles: AxisScaleHandle[] = [
    makeAxisScaleHandle("x"),
    makeAxisScaleHandle("y"),
    makeAxisScaleHandle("z"),
  ];
  scaleHandles.forEach((handle) => group.add(handle.group));

  // rotate gizmo: one ring per axis, built once
  const rotateHandles: AxisRotateHandle[] = [
    makeAxisRotateHandle("x"),
    makeAxisRotateHandle("y"),
    makeAxisRotateHandle("z"),
  ];
  rotateHandles.forEach((handle) => group.add(handle.mesh));

  // origin handle: single center handle, triggers free move when grabbed
  const originHandle: OriginHandle = makeOriginHandle();
  group.add(originHandle.mesh);
  
  // uniform scale handle: single center handle, triggers uniform scaling when grabbed
  const uniformScaleHandle: UniformScaleHandle = makeUniformScaleHandle();
  group.add(uniformScaleHandle.mesh);

  return {
    group,
    axisArrows,
    scaleHandles,
    rotateHandles,
    originHandle,
    uniformScaleHandle,
    dispose: () => {
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => material.dispose());
      });
    },
  };
};
