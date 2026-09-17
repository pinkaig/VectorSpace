// ======================================================================
// types.ts
// BRIEF: shared TypeScript types for gizmo code. AxisName lists the three axis identifiers, AxisArrow describes the shape of one built arrow (its group, meshes, and direction)
// ======================================================================
import * as THREE from 'three'

export type AxisName = 'x' | 'y' | 'z'

export interface AxisArrow {
  axis: AxisName
  group: THREE.Group // the whole arrow (shaft plus head) moved and rotated as one unit
  body: THREE.Mesh // the shaft
  head: THREE.Mesh // the cone tip
  direction: THREE.Vector3 // unit vector pointing along this axis, used for drag math
}