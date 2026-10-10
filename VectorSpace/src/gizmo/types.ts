/**
 * @file        types.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       shared TypeScript types for gizmo code. AxisName lists
 *              the three axis identifiers, AxisArrow describes the shape of
 *              one built arrow (its group, meshes, and direction)
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'

export type AxisName = 'x' | 'y' | 'z'

export interface AxisArrow {
  axis: AxisName
  group: THREE.Group // the whole arrow (shaft plus head) moved and rotated as one unit
  body: THREE.Mesh // the shaft
  head: THREE.Mesh // the cone tip
  direction: THREE.Vector3 // unit vector pointing along this axis, used for drag math
}