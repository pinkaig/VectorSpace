import { describe, expect, it } from 'vitest'
import type { SceneObject } from '@vthere/project'
import { composeWorldTransform, eulerToQuaternion, localTransformForNewParent, quaternionToEuler } from './transformMath'

const transformOf = (position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => ({
  position,
  rotation,
  scale,
})

const object = (id: string, position: [number, number, number], opts: { parentId?: string; rotation?: [number, number, number]; scale?: [number, number, number] } = {}): SceneObject => ({
  id,
  name: id,
  assetId: 'primitive-cube',
  assetKind: 'cube',
  visible: true,
  enabled: true,
  parentId: opts.parentId,
  transform: transformOf(position, opts.rotation, opts.scale),
})

const closeTo = (a: number, b: number, precision = 6) => expect(a).toBeCloseTo(b, precision)
const vecCloseTo = (v: { x: number; y: number; z: number }, expected: [number, number, number]) => {
  closeTo(v.x, expected[0]); closeTo(v.y, expected[1]); closeTo(v.z, expected[2])
}

describe('eulerToQuaternion / quaternionToEuler', () => {
  it('round-trips small and large rotations', () => {
    const cases: [number, number, number][] = [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 4, 0], [0.3, -0.7, 1.1]]
    for (const euler of cases) {
      const roundTripped = quaternionToEuler(eulerToQuaternion(euler))
      const back = eulerToQuaternion(roundTripped)
      const original = eulerToQuaternion(euler)
      closeTo(Math.abs(back.w), Math.abs(original.w))
    }
  })
})

describe('composeWorldTransform', () => {
  it('returns identity-composed local transform for a top-level object', () => {
    const objects = [object('a', [1, 2, 3])]
    const world = composeWorldTransform(objects, 'a')
    vecCloseTo(world.position, [1, 2, 3])
    vecCloseTo(world.scale, [1, 1, 1])
  })

  it('translates a child by its parent position', () => {
    const objects = [object('a', [10, 0, 0]), object('b', [1, 1, 1], { parentId: 'a' })]
    const world = composeWorldTransform(objects, 'b')
    vecCloseTo(world.position, [11, 1, 1])
  })

  it('scales a child position by the parent scale', () => {
    const objects = [object('a', [0, 0, 0], { scale: [2, 2, 2] }), object('b', [1, 0, 0], { parentId: 'a' })]
    const world = composeWorldTransform(objects, 'b')
    vecCloseTo(world.position, [2, 0, 0])
    vecCloseTo(world.scale, [2, 2, 2])
  })

  it('rotates a child position around a rotated parent', () => {
    const objects = [object('a', [0, 0, 0], { rotation: [0, Math.PI / 2, 0] }), object('b', [1, 0, 0], { parentId: 'a' })]
    const world = composeWorldTransform(objects, 'b')
    // Rotating [1,0,0] by +90deg around Y sends it to roughly [0,0,-1].
    vecCloseTo(world.position, [0, 0, -1])
  })

  it('composes multiple levels of nesting', () => {
    const objects = [
      object('a', [10, 0, 0]),
      object('b', [0, 5, 0], { parentId: 'a' }),
      object('c', [0, 0, 2], { parentId: 'b' }),
    ]
    const world = composeWorldTransform(objects, 'c')
    vecCloseTo(world.position, [10, 5, 2])
  })
})

describe('localTransformForNewParent (reparent preserves world position)', () => {
  it('detaching to top-level yields the local == world transform', () => {
    const objects = [object('a', [10, 0, 0]), object('b', [1, 1, 1], { parentId: 'a' })]
    const childWorld = composeWorldTransform(objects, 'b')
    const identityWorld = composeWorldTransform([object('root', [0, 0, 0])], 'root')
    const local = localTransformForNewParent(childWorld, identityWorld)
    expect(local.position[0]).toBeCloseTo(11, 6)
    expect(local.position[1]).toBeCloseTo(1, 6)
    expect(local.position[2]).toBeCloseTo(1, 6)
  })

  it('reparenting under a translated parent recomputes local position so world position is unchanged', () => {
    const objects = [
      object('oldParent', [10, 0, 0]),
      object('newParent', [0, 20, 0]),
      object('child', [1, 1, 1], { parentId: 'oldParent' }),
    ]
    const childWorldBefore = composeWorldTransform(objects, 'child')
    const newParentWorld = composeWorldTransform(objects, 'newParent')
    const newLocal = localTransformForNewParent(childWorldBefore, newParentWorld)

    const reparented = objects.map((item) => (item.id === 'child' ? { ...item, parentId: 'newParent', transform: newLocal } : item))
    const childWorldAfter = composeWorldTransform(reparented, 'child')

    vecCloseTo(childWorldAfter.position, [childWorldBefore.position.x, childWorldBefore.position.y, childWorldBefore.position.z])
  })

  it('reparenting under a rotated and scaled parent still preserves world position', () => {
    const objects = [
      object('oldParent', [0, 0, 0]),
      object('newParent', [5, 0, 0], { rotation: [0, Math.PI / 2, 0], scale: [2, 2, 2] }),
      object('child', [3, 4, 0], { parentId: 'oldParent' }),
    ]
    const childWorldBefore = composeWorldTransform(objects, 'child')
    const newParentWorld = composeWorldTransform(objects, 'newParent')
    const newLocal = localTransformForNewParent(childWorldBefore, newParentWorld)

    const reparented = objects.map((item) => (item.id === 'child' ? { ...item, parentId: 'newParent', transform: newLocal } : item))
    const childWorldAfter = composeWorldTransform(reparented, 'child')

    vecCloseTo(childWorldAfter.position, [childWorldBefore.position.x, childWorldBefore.position.y, childWorldBefore.position.z])
    vecCloseTo(childWorldAfter.scale, [childWorldBefore.scale.x, childWorldBefore.scale.y, childWorldBefore.scale.z])
  })
})
