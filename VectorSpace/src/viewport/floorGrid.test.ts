import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FLOOR_LAYOUT, findFloorHeight, floorLayoutFor } from './floorGrid'

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d))
  mesh.position.set(x, y, z)
  return mesh
}

// A 32 x 24 m room on a 5 cm slab with 3 m walls, like highlight_exhibit.glb
const slabRoom = () => {
  const room = new THREE.Group()
  room.add(box(32, 0.05, 24, 0, 0.025, 0), box(32, 3, 0.2, 0, 1.5, -12), box(0.2, 3, 24, 16, 1.5, 0))
  room.updateMatrixWorld(true)
  return room
}

describe('floorGrid', () => {
  it('fits the room footprint, centred on the room', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-4, 0, 2), new THREE.Vector3(8, 3, 10))
    expect(floorLayoutFor(bounds)).toEqual({ centerX: 2, centerZ: 6, width: 12, depth: 8 })
    expect(floorLayoutFor(new THREE.Box3())).toBe(DEFAULT_FLOOR_LAYOUT)
  })

  it('finds the top of a slab floor so the grid is not hidden under it', () => {
    const room = slabRoom()
    expect(findFloorHeight(room, new THREE.Box3().setFromObject(room))).toBeCloseTo(0.05)
  })

  it('uses a floor-tagged mesh when the room has one', () => {
    const room = slabRoom()
    ;(room.children[0] as THREE.Mesh).userData.roomSurface = { part: 'floor' }
    expect(findFloorHeight(room, new THREE.Box3().setFromObject(room))).toBeCloseTo(0.05)
  })
})
