/**
 * @file       floorGrid.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      The editor's floor grid: soft green tiles with lighter lines and a darker
 *             rim, shared by the main Viewport and the Top/Front/Right reference panes.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'

// 16 x 16 one-metre tiles in the soft green of the room mockups.
export const FLOOR_SIZE = 16
const FLOOR_FILL = 0xcfe6c2
const FLOOR_LINE = 0xb3d59e
const FLOOR_RIM = 0x8dbf72
// How far below y = 0 the green fill sits, so a room's own floor always wins.
const FLOOR_FILL_DEPTH = -0.03

// Light sky blue behind the floor, matching the main viewport's scene background.
export const FLOOR_BACKGROUND = 0xdcebfa

export interface FloorGrid {
  /** Lies flat in the XZ plane at y = 0; rotate/position the group to reuse it as a wall. */
  group: THREE.Group
  dispose: () => void
}

/**
 * Builds the floor. The fill sits just below its plane (and is polygon-offset back) so an
 * environment's own floor draws over it; lines and rim sit a hair above so they always show.
 * `opacity` < 1 fades the whole floor, for reference panes that use it as a backdrop.
 */
export const createFloorGrid = (opacity = 1): FloorGrid => {
  const faded = opacity < 1
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: FLOOR_FILL, side: THREE.DoubleSide, transparent: faded, opacity, depthWrite: !faded,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }),
  )
  // Coplanar with an environment's floor at y = 0, polygon offset alone still z-fights
  // (green/grey stripes while orbiting) — depth precision is too coarse at orbit distance.
  // Sinking the fill a few centimetres puts it unambiguously underneath.
  fill.position.y = FLOOR_FILL_DEPTH
  const lines = new THREE.GridHelper(FLOOR_SIZE, FLOOR_SIZE, FLOOR_LINE, FLOOR_LINE)
  lines.position.y = 0.01
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE).rotateX(-Math.PI / 2)),
    new THREE.LineBasicMaterial({ color: FLOOR_RIM }),
  )
  rim.position.y = 0.012
  for (const part of [lines, rim]) {
    const material = part.material as THREE.Material
    material.transparent = faded
    material.opacity = opacity
  }
  const group = new THREE.Group()
  group.add(fill, lines, rim)
  return {
    group,
    dispose: () => {
      for (const part of [fill, lines, rim]) {
        part.geometry.dispose()
        ;(part.material as THREE.Material).dispose()
      }
    },
  }
}
