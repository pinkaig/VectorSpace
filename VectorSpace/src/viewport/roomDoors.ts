/**
 * @file       roomDoors.ts
 * @project    VectorSpace
 * @author     Goh Pin Kai
 * @brief
 *             Adds doors on walls connected to adjacent rooms (doorsFor).
 *             Each door shows the next room's name and allows navigation
 *             in both Editor and Play mode.
 *             
 *             Door positions are calculated automatically (findDoorway)
 *             based on wall openings and room layout. If no opening exists,
 *             the door is placed at the wall's center.
 *             The entry position is set just inside the door, facing the room.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'
import type { CameraPose } from '../project/model'

export type DoorSide = 'north' | 'east' | 'south' | 'west'

/** A door on one side of the room, to the room beside it. */
export type RoomDoor = { side: DoorSide; sceneId: string; label: string }

const DOOR_WIDTH = 1.1
const DOOR_HEIGHT = 2.1
const DOOR_DEPTH = 0.08
// where there is no wall to set it into, the door stands this far inside the room's edge
const OPEN_INSET = 0.05
// finding the doorway: rays this far apart along the wall, at this height above the floor,
// each looking this deep into the room for the wall; a gap at least this wide is a doorway
const SAMPLE_STEP = 0.15
const MAX_SAMPLES = 160
const RAY_HEIGHT = 1
const WALL_BAND = 1
const MIN_DOORWAY = 0.7
// where a visitor arrives through a door: this far in, looking this far ahead
const ARRIVE_IN = 1.6
const LOOK_AHEAD = 5
const LABEL_HEIGHT = 0.045
const LABEL_RISE = DOOR_HEIGHT + 0.45

const DOOR_FILL = '#e8b98c'
const DOOR_EDGE = '#b97a4a'
const GREEN = '#2e8b57'
const INK = '#1e1b3a'

// the unit step into the room from each side's wall
const INWARD: Record<DoorSide, [number, number]> = {
  north: [0, 1],
  south: [0, -1],
  east: [-1, 0],
  west: [1, 0],
}

/** Where a door stands: on the floor in the doorway, and the step into the room from it. */
export type Doorway = { point: THREE.Vector3; inward: THREE.Vector3 }

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * The doorway on one side of a room. room: the loaded environment (null for an empty room);
 * bounds: its outline. Rays cross the wall from both sides at each step along it (from both
 * sides, so a wall drawn one-sided still counts); where neither meets anything is open.
 */
export const findDoorway = (room: THREE.Object3D | null, bounds: THREE.Box3, side: DoorSide): Doorway => {
  const [ix, iz] = INWARD[side]
  const inward = new THREE.Vector3(ix, 0, iz)
  const runsAlongX = side === 'north' || side === 'south'
  const from = runsAlongX ? bounds.min.x : bounds.min.z
  const to = runsAlongX ? bounds.max.x : bounds.max.z
  const edge = side === 'north' ? bounds.min.z : side === 'south' ? bounds.max.z : side === 'east' ? bounds.max.x : bounds.min.x
  const middle = (from + to) / 2
  const height = bounds.min.y + RAY_HEIGHT
  // a point `along` the wall, `depth` in from the room's edge
  const at = (along: number, depth: number, y = height) =>
    runsAlongX ? new THREE.Vector3(along, y, edge + iz * depth) : new THREE.Vector3(edge + ix * depth, y, along)

  if (!room) return { point: at(middle, OPEN_INSET, 0), inward }

  // the rays only ever meet triangles in a thin strip along this wall, so they are cast at
  // just those (one pass over the room) rather than at the whole room, ray after ray
  const near = new THREE.Box3()
    .expandByPoint(at(from - 0.1, -0.1, height - 0.01))
    .expandByPoint(at(to + 0.1, WALL_BAND + 0.1, height + 0.01))
  const strip = trianglesIn(room, near)
  if (!strip) return { point: at(middle, OPEN_INSET, 0), inward }

  const count = Math.max(1, Math.min(MAX_SAMPLES, Math.ceil((to - from) / SAMPLE_STEP)))
  const step = (to - from) / count
  const ray = new THREE.Raycaster()
  ray.far = WALL_BAND + 0.05
  const outward = inward.clone().negate()
  const open: boolean[] = []
  // how deep the wall's middle is, from the room's edge, wherever a wall was met
  const wallMiddles: number[] = []
  for (let index = 0; index < count; index += 1) {
    const along = from + (index + 0.5) * step
    ray.set(at(along, -0.05), inward)
    const outerFace = ray.intersectObject(strip, false)[0]
    ray.set(at(along, WALL_BAND), outward)
    const innerFace = ray.intersectObject(strip, false)[0]
    if (!outerFace && !innerFace) {
      open.push(true)
      continue
    }
    open.push(false)
    const outer = outerFace ? outerFace.distance - 0.05 : null
    const inner = innerFace ? WALL_BAND - innerFace.distance : null
    wallMiddles.push(outer !== null && inner !== null ? (outer + inner) / 2 : (outer ?? inner)!)
  }
  strip.geometry.dispose()
  ;(strip.material as THREE.Material).dispose()

  // nothing on this side at all (no wall there): the middle, at the edge
  if (wallMiddles.length === 0) return { point: at(middle, OPEN_INSET, 0), inward }
  const depth = median(wallMiddles)

  // the gaps wide enough to walk through; the one nearest the middle of the side wins
  let best: number | null = null
  for (let start = 0; start < count; ) {
    if (!open[start]) {
      start += 1
      continue
    }
    let end = start
    while (end + 1 < count && open[end + 1]) end += 1
    const width = (end - start + 1) * step
    const centre = from + ((start + end + 1) / 2) * step
    if (width >= MIN_DOORWAY && (best === null || Math.abs(centre - middle) < Math.abs(best - middle))) best = centre
    start = end + 1
  }
  // a wall with no doorway: against its inside, in the middle
  return best === null
    ? { point: at(middle, depth + 0.15, 0), inward }
    : { point: at(best, depth, 0), inward }
}

/**
 * The room's triangles that reach into `box`, in world space, as one two-sided mesh (null
 * if there are none). Two-sided, so a wall drawn with one face is still met from behind.
 */
const trianglesIn = (room: THREE.Object3D, box: THREE.Box3): THREE.Mesh | null => {
  room.updateMatrixWorld(true)
  const kept: number[] = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const triangle = new THREE.Box3()
  const meshBox = new THREE.Box3()
  room.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!position) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    // a whole mesh away from the wall (most furniture) is skipped without looking inside
    if (!meshBox.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).intersectsBox(box)) return
    const index = mesh.geometry.getIndex()
    const corners = index ? index.count : position.count
    for (let i = 0; i + 2 < corners; i += 3) {
      const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2]
      a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld)
      if (!triangle.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c).intersectsBox(box)) continue
      kept.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    }
  })
  if (kept.length === 0) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
}

/** Where a visitor stands after coming in through a doorway: a step in, facing the room. */
export const entrancePose = ({ point, inward }: Doorway): CameraPose => {
  const stand = point.clone().addScaledVector(inward, ARRIVE_IN)
  const look = stand.clone().addScaledVector(inward, LOOK_AHEAD)
  return { position: [stand.x, 1.6, stand.z], target: [look.x, 1.6, look.z] }
}

/**
 * Where a visit starts when nobody came in through a door: the middle of the room, facing the
 * way the start view faces (looking north if the start view looks straight down).
 */
export const centrePose = (bounds: THREE.Box3, start: CameraPose): CameraPose => {
  const centre = bounds.getCenter(new THREE.Vector3())
  const facing = new THREE.Vector3(start.target[0] - start.position[0], 0, start.target[2] - start.position[2])
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, -1)
  facing.normalize()
  return {
    position: [centre.x, 1.6, centre.z],
    target: [centre.x + facing.x * LOOK_AHEAD, 1.6, centre.z + facing.z * LOOK_AHEAD],
  }
}

// "Fossil lab →", or "← Entrance hall" on the west wall, so the arrow points the way it leads
const labelText = (door: RoomDoor) => (door.side === 'west' ? `← ${door.label}` : `${door.label} →`)

const labelSprite = (text: string) => {
  const font = '700 16px system-ui, sans-serif'
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const width = Math.ceil(measure.measureText(text).width) + 40
  const height = 36
  const canvas = document.createElement('canvas')
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.beginPath()
  ctx.roundRect(1.5, 1.5, width - 3, height - 3, (height - 3) / 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = GREEN
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2 + 1)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, sizeAttenuation: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(LABEL_HEIGHT * (width / height), LABEL_HEIGHT, 1)
  sprite.renderOrder = 1000
  return sprite
}

// a plain door: a panel with a darker edge and a knob, its face toward the room
const doorMesh = () => {
  const door = new THREE.Group()
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_DEPTH),
    new THREE.MeshStandardMaterial({ color: DOOR_FILL, roughness: 0.8 }),
  )
  panel.position.y = DOOR_HEIGHT / 2
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(panel.geometry),
    new THREE.LineBasicMaterial({ color: DOOR_EDGE }),
  )
  edge.position.copy(panel.position)
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 8),
    new THREE.MeshStandardMaterial({ color: DOOR_EDGE, roughness: 0.5 }),
  )
  knob.position.set(DOOR_WIDTH / 2 - 0.15, DOOR_HEIGHT * 0.48, DOOR_DEPTH / 2 + 0.03)
  door.add(panel, edge, knob)
  return door
}

const disposeGroup = (group: THREE.Group) => {
  group.traverse((child) => {
    const item = child as THREE.Mesh
    item.geometry?.dispose()
    const material = item.material as (THREE.Material & { map?: THREE.Texture | null }) | undefined
    material?.map?.dispose()
    material?.dispose()
  })
  group.clear()
}

/**
 * Adds a door layer to the scene. update() redraws the doors in their doorways; pickDoor()
 * is the room whose door or label a ray hits (null for none); dispose() removes them.
 */
export const createRoomDoors = (scene: THREE.Scene) => {
  const group = new THREE.Group()
  scene.add(group)

  const update = (doors: readonly RoomDoor[], doorwayOn: (side: DoorSide) => Doorway) => {
    disposeGroup(group)
    for (const door of doors) {
      const { point, inward } = doorwayOn(door.side)
      const holder = new THREE.Group()
      holder.position.copy(point)
      // the door's front (+z) faces into the room
      holder.rotation.y = Math.atan2(inward.x, inward.z)
      holder.add(doorMesh())
      const label = labelSprite(labelText(door))
      label.position.y = LABEL_RISE
      holder.add(label)
      holder.traverse((child) => { child.userData.doorSceneId = door.sceneId })
      group.add(holder)
    }
  }

  const pickDoor = (raycaster: THREE.Raycaster): string | null => {
    const hit = raycaster.intersectObjects(group.children, true).find((item) => item.object.userData.doorSceneId)
    return (hit?.object.userData.doorSceneId as string | undefined) ?? null
  }

  const dispose = () => {
    disposeGroup(group)
    scene.remove(group)
  }

  return { update, pickDoor, dispose }
}
