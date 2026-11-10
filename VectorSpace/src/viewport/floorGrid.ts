/**
 * @file       floorGrid.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      The editor's floor grid: soft green tiles with lighter lines and a darker
 *             rim, shared by the main Viewport and the Top/Front/Right reference panes.
 *             The grid fits itself to the loaded environment: it covers the room's floor
 *             footprint and its one-metre cells are measured out from the room's centre.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'

// An empty room (no environment) gets 16 x 16 one-metre tiles around the origin.
export const FLOOR_SIZE = 16
// Each tile is one metre (snapping.ts snaps to half of this).
export const FLOOR_CELL = 1
const FLOOR_FILL = 0xcfe6c2
const FLOOR_LINE = 0xb3d59e
const FLOOR_RIM = 0x8dbf72
// How far below y = 0 the green fill sits, so a room's own floor always wins.
const FLOOR_FILL_DEPTH = -0.03
// Smallest side the grid will shrink to, so a tiny or flat environment still shows a floor.
const MIN_FLOOR_SIDE = 2

// Light sky blue behind the floor, matching the main viewport's scene background.
export const FLOOR_BACKGROUND = 0xdcebfa

/** Where the grid sits on the floor: its centre (the cells' origin) and its size, in metres. */
export interface FloorLayout {
  centerX: number
  centerZ: number
  width: number
  depth: number
}

export const DEFAULT_FLOOR_LAYOUT: FloorLayout = { centerX: 0, centerZ: 0, width: FLOOR_SIZE, depth: FLOOR_SIZE }

/** The grid that fits an environment's bounds: its floor footprint, or the default for an empty room. */
export const floorLayoutFor = (bounds: THREE.Box3 | null): FloorLayout => {
  if (!bounds || bounds.isEmpty()) return DEFAULT_FLOOR_LAYOUT
  return {
    centerX: (bounds.min.x + bounds.max.x) / 2,
    centerZ: (bounds.min.z + bounds.max.z) / 2,
    width: Math.max(MIN_FLOOR_SIDE, bounds.max.x - bounds.min.x),
    depth: Math.max(MIN_FLOOR_SIDE, bounds.max.z - bounds.min.z),
  }
}

/** The room box the layout covers (floor up to `height`), for code that needs the room outline. */
export const floorLayoutBox = (layout: FloorLayout, height = 3): THREE.Box3 =>
  new THREE.Box3(
    new THREE.Vector3(layout.centerX - layout.width / 2, 0, layout.centerZ - layout.depth / 2),
    new THREE.Vector3(layout.centerX + layout.width / 2, height, layout.centerZ + layout.depth / 2),
  )

// The floor must lie in the bottom part of the room; anything higher is a table, a sill or a wall top.
const FLOOR_BAND = 0.25

/**
 * The height of the top of an environment's floor. Rooms built as solid slabs have their
 * walkable surface above y = 0, which would hide a grid drawn at 0 under the slab.
 * Uses the meshes tagged as 'floor' (roomSurfaces.ts) when the model has them, else casts
 * rays straight down through the room and takes the middle of what they land on.
 * Falls back to 0 when no floor is found.
 */
export const findFloorHeight = (room: THREE.Object3D, bounds: THREE.Box3): number => {
  if (bounds.isEmpty()) return 0
  room.updateMatrixWorld(true)
  const ceiling = bounds.min.y + (bounds.max.y - bounds.min.y) * FLOOR_BAND
  let tagged = -Infinity
  room.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.userData.roomSurface?.part !== 'floor') return
    const top = new THREE.Box3().setFromObject(child).max.y
    if (top <= ceiling) tagged = Math.max(tagged, top)
  })
  if (tagged > -Infinity) return tagged

  const raycaster = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  const hits: number[] = []
  const size = bounds.getSize(new THREE.Vector3())
  for (const [fx, fz] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    raycaster.set(new THREE.Vector3(bounds.min.x + size.x * fx, bounds.max.y + 1, bounds.min.z + size.z * fz), down)
    const hit = raycaster.intersectObject(room, true)
      .find((h) => h.point.y <= ceiling && (!h.face || h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.5))
    if (hit) hits.push(hit.point.y)
  }
  if (!hits.length) return 0
  hits.sort((a, b) => a - b)
  return hits[Math.floor(hits.length / 2)]
}

export interface FloorGrid {
  /** Lies flat in the XZ plane at y = 0; rotate/position the group to reuse it as a wall. */
  group: THREE.Group
  /** The layout currently drawn. */
  readonly layout: FloorLayout
  /** Redraws the grid to cover a new layout (e.g. after an environment loads). */
  fit: (layout: FloorLayout) => void
  dispose: () => void
}

// Interior grid lines, one every cell outward from the centre; the rim draws the edges.
const buildLineGeometry = ({ width, depth }: FloorLayout): THREE.BufferGeometry => {
  const halfW = width / 2
  const halfD = depth / 2
  const points: number[] = []
  for (let k = Math.ceil(-halfW / FLOOR_CELL); k * FLOOR_CELL < halfW; k++) {
    const x = k * FLOOR_CELL
    if (Math.abs(Math.abs(x) - halfW) < 1e-4) continue
    points.push(x, 0, -halfD, x, 0, halfD)
  }
  for (let k = Math.ceil(-halfD / FLOOR_CELL); k * FLOOR_CELL < halfD; k++) {
    const z = k * FLOOR_CELL
    if (Math.abs(Math.abs(z) - halfD) < 1e-4) continue
    points.push(-halfW, 0, z, halfW, 0, z)
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
}

const buildPlane = ({ width, depth }: FloorLayout) => new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2)

const buildRimGeometry = (layout: FloorLayout) => {
  const plane = buildPlane(layout)
  const edges = new THREE.EdgesGeometry(plane)
  plane.dispose()
  return edges
}

/**
 * Builds the floor. The fill sits just below its plane (and is polygon-offset back) so an
 * environment's own floor draws over it; lines and rim sit a hair above so they always show.
 * `opacity` < 1 fades the whole floor, for reference panes that use it as a backdrop.
 *
 * The parts live in an inner `surface` group shifted to the layout's centre, so callers can
 * still rotate/position the outer `group` freely (the reference panes stand it up as a wall).
 */
export const createFloorGrid = (opacity = 1, initialLayout: FloorLayout = DEFAULT_FLOOR_LAYOUT): FloorGrid => {
  const faded = opacity < 1
  const fill = new THREE.Mesh(
    buildPlane(initialLayout),
    new THREE.MeshBasicMaterial({
      color: FLOOR_FILL, side: THREE.DoubleSide, transparent: faded, opacity, depthWrite: !faded,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }),
  )
  // Coplanar with an environment's floor at y = 0, polygon offset alone still z-fights
  // (green/grey stripes while orbiting) — depth precision is too coarse at orbit distance.
  // Sinking the fill a few centimetres puts it unambiguously underneath.
  fill.position.y = FLOOR_FILL_DEPTH
  const lines = new THREE.LineSegments(buildLineGeometry(initialLayout), new THREE.LineBasicMaterial({ color: FLOOR_LINE }))
  lines.position.y = 0.01
  const rim = new THREE.LineSegments(buildRimGeometry(initialLayout), new THREE.LineBasicMaterial({ color: FLOOR_RIM }))
  rim.position.y = 0.012
  for (const part of [lines, rim]) {
    const material = part.material as THREE.Material
    material.transparent = faded
    material.opacity = opacity
  }
  const surface = new THREE.Group()
  surface.add(fill, lines, rim)
  const group = new THREE.Group()
  group.add(surface)

  let layout = initialLayout
  const place = () => surface.position.set(layout.centerX, 0, layout.centerZ)
  place()

  return {
    group,
    get layout() { return layout },
    fit: (next) => {
      if (next.centerX === layout.centerX && next.centerZ === layout.centerZ
        && next.width === layout.width && next.depth === layout.depth) return
      layout = next
      fill.geometry.dispose()
      fill.geometry = buildPlane(layout)
      lines.geometry.dispose()
      lines.geometry = buildLineGeometry(layout)
      rim.geometry.dispose()
      rim.geometry = buildRimGeometry(layout)
      place()
    },
    dispose: () => {
      for (const part of [fill, lines, rim]) {
        part.geometry.dispose()
        ;(part.material as THREE.Material).dispose()
      }
    },
  }
}
