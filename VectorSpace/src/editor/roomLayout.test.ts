import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { defaultProject, makeScene, type ProjectData } from '../project/model'
import { doorsFor, entranceRoomId, OPPOSITE_SIDE } from './roomLayout'
import { centrePose, entrancePose, findDoorway } from '../viewport/roomDoors'

// Room 1 in the middle, the Fossil lab east of it, a Gift shop north of it
const museum = (): ProjectData => ({
  ...defaultProject(),
  activeSceneId: 'lab',
  scenes: [
    { ...makeScene('hall', 'Entrance hall'), layout: { x: 0, z: 0 } },
    { ...makeScene('lab', 'Fossil lab'), layout: { x: 1, z: 0 } },
    { ...makeScene('shop', 'Gift shop'), layout: { x: 0, z: -1 } },
  ],
})

describe('doors between rooms', () => {
  it('puts a door on each wall with a room beside it, named after that room', () => {
    const project = museum()
    expect(doorsFor(project, project.scenes[0])).toEqual([
      { side: 'north', sceneId: 'shop', label: 'Gift shop' },
      { side: 'east', sceneId: 'lab', label: 'Fossil lab' },
    ])
    // the lab's only door leads back west to the hall
    expect(doorsFor(project, project.scenes[1])).toEqual([{ side: 'west', sceneId: 'hall', label: 'Entrance hall' }])
  })

  it('arrives through the matching door on the other side', () => {
    expect(OPPOSITE_SIDE.east).toBe('west')
    expect(OPPOSITE_SIDE.north).toBe('south')
  })

  it('starts a visit in Room 1, whichever room was open last', () => {
    expect(entranceRoomId(museum())).toBe('hall')
  })
})

// a room 10 wide (x -5..5) and 8 deep (z -4..4) with 0.2-thick walls, and a 1.2-wide gap in
// its north wall from x = -3.6 to -2.4
const wall = (x0: number, x1: number, z0: number, z1: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 3, z1 - z0), new THREE.MeshBasicMaterial())
  mesh.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2)
  return mesh
}
const roomWithGap = () => {
  const room = new THREE.Group()
  room.add(
    wall(-5, -3.6, -4, -3.8), wall(-2.4, 5, -4, -3.8), // north, with the gap
    wall(-5, 5, 3.8, 4), // south, solid
    wall(-5, -4.8, -4, 4), wall(4.8, 5, -4, 4), // west and east, solid
  )
  return room
}

describe('finding the doorway', () => {
  it('puts the door in the gap in the wall, set into the wall', () => {
    const room = roomWithGap()
    const { point } = findDoorway(room, new THREE.Box3().setFromObject(room), 'north')
    expect(point.x).toBeCloseTo(-3, 0)
    expect(point.z).toBeCloseTo(-3.9, 1)
    expect(point.y).toBe(0)
  })

  it('stands against the middle of a wall with no gap', () => {
    const room = roomWithGap()
    const { point } = findDoorway(room, new THREE.Box3().setFromObject(room), 'south')
    expect(point.x).toBeCloseTo(0, 0)
    expect(point.z).toBeLessThan(3.8) // inside the wall, not in it
  })

  it('uses the middle of the floor edge in a room with no walls', () => {
    const grid = new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 3, 8))
    const { point } = findDoorway(null, grid, 'east')
    expect(point.x).toBeCloseTo(8 - 0.05)
    expect(point.z).toBeCloseTo(0)
  })
})

describe('the entrance with no door', () => {
  it('stands in the middle of the room, facing the way the start view faces', () => {
    const room = roomWithGap()
    const pose = centrePose(new THREE.Box3().setFromObject(room), { position: [0, 5, 10], target: [0, 0, 0] })
    expect(pose.position[0]).toBeCloseTo(0)
    expect(pose.position[2]).toBeCloseTo(0)
    expect(pose.position[1]).toBe(1.6)
    expect(pose.target[2]).toBeLessThan(0) // looking north, like the start view
  })
})

describe('the entrance through a door', () => {
  it('stands a step inside the doorway, facing into the room', () => {
    const room = roomWithGap()
    const pose = entrancePose(findDoorway(room, new THREE.Box3().setFromObject(room), 'north'))
    expect(pose.position[0]).toBeCloseTo(-3, 0)
    expect(pose.position[2]).toBeCloseTo(-3.9 + 1.6, 1)
    expect(pose.target[2]).toBeGreaterThan(pose.position[2]) // looking south, into the room
  })
})
