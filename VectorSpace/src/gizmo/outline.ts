/**
 * @file        outline.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Shared "inverted hull" outline helper for gizmo meshes, a
 *              slightly larger, inverted, dark copy rendered behind the real
 *              mesh so a thin rim shows around its edges.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
 import * as THREE from 'three'

const OUTLINE_COLOR = 0x000000
const OUTLINE_SCALE = 1.15 // outline shell size relative to the real mesh

// adds a slightly larger, inverted, dark copy of a mesh so a thin outline shows around its edges
export const addOutline = (mesh: THREE.Mesh) => {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide, depthTest: false, depthWrite: false }),
  )
  outline.scale.setScalar(OUTLINE_SCALE)
  outline.renderOrder = mesh.renderOrder - 1
  mesh.add(outline)
}