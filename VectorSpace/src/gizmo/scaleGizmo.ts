/**
 * @file        scaleGizmo.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       scale gizmo specific logic. Builds one axis scale handle with a
 *              thin shaft and a cube tip, mirroring the move arrow's shape,
 *              used to scale the selected object along that axis
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from "three";
import { AxisName } from "./types";
import { AXIS_COLORS } from "./colors";
import { addOutline } from "./outline";

export interface AxisScaleHandle {
  axis: AxisName;
  group: THREE.Group; // the whole handle (shaft plus cube), moved/rotated as one unit, mirrors AxisArrow
  shaft: THREE.Mesh;
  cube: THREE.Mesh;
  direction: THREE.Vector3; // unit vector pointing along the axis
  baseQuaternion: THREE.Quaternion; // the handle's own axis orientation, set once at creation
}

// builds one scale handle: a thin shaft with a cube tip, same shape convention as makeAxisArrow, so it visually connects to the object's center instead of floating
export const makeAxisScaleHandle = (axis: AxisName): AxisScaleHandle => {
  const color = AXIS_COLORS[axis];
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), // same shaft dimensions as the move arrow, for visual consistency
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
  shaft.position.y = 0.45; // shift shaft so its base sits at the group's origin, matching the arrow
  cube.position.y = 0.95; // sit the cube just past the end of the shaft

  shaft.renderOrder = 999;
  cube.renderOrder = 999;
  addOutline(shaft);
  addOutline(cube);

  const group = new THREE.Group();
  group.add(shaft, cube);

  const direction = new THREE.Vector3();
  if (axis === "x") { group.rotation.z = -Math.PI / 2; direction.set(1, 0, 0); }
  if (axis === "y") { direction.set(0, 1, 0); }
  if (axis === "z") { group.rotation.x = Math.PI / 2; direction.set(0, 0, 1); }

  return { axis, group, shaft, cube, direction, baseQuaternion: group.quaternion.clone() };
};

// sets both meshes of one handle to the same color together, since the shaft and cube are two separate materials but should look like one handle
export const setScaleHandleColor = (handle: AxisScaleHandle, color: number) => {
  ;(handle.shaft.material as THREE.MeshBasicMaterial).color.setHex(color);
  ;(handle.cube.material as THREE.MeshBasicMaterial).color.setHex(color);
};