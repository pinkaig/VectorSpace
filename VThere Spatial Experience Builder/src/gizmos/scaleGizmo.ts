// ======================================================================
// scaleGizmo.ts
// BRIEF: scale gizmo specific logic. Builds one small cube handle per axis, used to scale the selected object along that axis
// ======================================================================
import * as THREE from "three";
import { AxisName } from "./types";
import { AXIS_COLORS } from "./colors";


export interface AxisScaleHandle {
    axis: AxisName;
    mesh: THREE.Mesh; // a small cube, unlike the move arrow's body + head
    direction: THREE.Vector3; // unit vector pointing along the axis
}

// builds one scale handle per axis, each handle is a small cube positined along given axis
export const makeAxisScaleHandles = (axis: AxisName) : AxisScaleHandle =>  {
    const color = AXIS_COLORS[axis]
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color })
    )

    const direction = new THREE.Vector3()
    if (axis = 'x') direction.set(1, 0, 0)
    if (axis = 'y') direction.set(0, 1, 0)
    if (axis = 'z') direction.set(0, 0, 1)
    return { axis, mesh, direction }
}