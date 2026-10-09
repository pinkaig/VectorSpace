import { describe, expect, it } from 'vitest'
import { buildSceneTree, grandparentId, previousSibling } from './sceneTree'
import type { SceneObject } from '../project/model'

const object = (id: string, parentId?: string): SceneObject => ({
  id,
  name: id,
  assetId: `primitive-cube`,
  assetKind: 'cube',
  visible: true,
  enabled: true,
  parentId,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
})

describe('buildSceneTree', () => {
  it('returns an empty list for an empty scene', () => {
    expect(buildSceneTree([])).toEqual([])
  })

  it('keeps a flat scene in original order, all at depth 0', () => {
    const objects = [object('a'), object('b'), object('c')]
    expect(buildSceneTree(objects)).toEqual([
      { object: objects[0], depth: 0 },
      { object: objects[1], depth: 0 },
      { object: objects[2], depth: 0 },
    ])
  })

  it('nests children directly under their parent, preserving each group\'s original order', () => {
    const a = object('a')
    const b = object('b', 'a')
    const c = object('c')
    const d = object('d', 'a')
    const rows = buildSceneTree([a, b, c, d])
    expect(rows.map((row) => [row.object.id, row.depth])).toEqual([
      ['a', 0],
      ['b', 1],
      ['d', 1],
      ['c', 0],
    ])
  })

  it('handles multiple levels of nesting across multiple root branches', () => {
    const root1 = object('root1')
    const child1 = object('child1', 'root1')
    const grandchild1 = object('grandchild1', 'child1')
    const root2 = object('root2')
    const child2 = object('child2', 'root2')
    const rows = buildSceneTree([root1, child1, grandchild1, root2, child2])
    expect(rows.map((row) => [row.object.id, row.depth])).toEqual([
      ['root1', 0],
      ['child1', 1],
      ['grandchild1', 2],
      ['root2', 0],
      ['child2', 1],
    ])
  })
})

describe('previousSibling', () => {
  it('returns null for the first object in its sibling group', () => {
    const objects = [object('a'), object('b', 'a'), object('c', 'a')]
    expect(previousSibling(objects, 'b')).toBeNull()
    expect(previousSibling(objects, 'a')).toBeNull()
  })

  it('returns the preceding sibling under the same parent', () => {
    const objects = [object('a'), object('b', 'a'), object('c', 'a')]
    expect(previousSibling(objects, 'c')).toEqual(objects[1])
  })

  it('returns null for an unknown object id', () => {
    expect(previousSibling([object('a')], 'missing')).toBeNull()
  })

  it('finds the immediately preceding sibling mid-group, ignoring objects under other parents', () => {
    const root = object('root')
    const first = object('first', 'root')
    const other = object('other')
    const second = object('second', 'root')
    const objects = [root, first, other, second]
    expect(previousSibling(objects, 'second')).toEqual(first)
  })
})

describe('grandparentId', () => {
  it('returns null for a top-level object', () => {
    expect(grandparentId([object('a')], 'a')).toBeNull()
  })

  it('returns null when the parent is itself top-level', () => {
    const objects = [object('a'), object('b', 'a')]
    expect(grandparentId(objects, 'b')).toBeNull()
  })

  it('returns the grandparent id for a nested object', () => {
    const objects = [object('a'), object('b', 'a'), object('c', 'b')]
    expect(grandparentId(objects, 'c')).toBe('a')
  })

  it('returns null for an unknown object id', () => {
    expect(grandparentId([object('a')], 'missing')).toBeNull()
  })
})
