import { describe, expect, it } from 'vitest'
import { composeWorldTransform, createCommandTimeline, createObject, duplicateObject, ObjectOperationError, removeObject, reparentObject, setObjectEnabled, setObjectVisible, updateObjectTransform } from './index'
import { defaultProject, InteractionRule, ProjectData } from '@vthere/project'

describe('command timeline', () => {
  it('restores committed snapshots without sharing mutable state', () => {
    const timeline = createCommandTimeline({ value: 0 }, (state) => ({ ...state }))

    timeline.commit('change value', { value: 1 })
    expect(timeline.current).toEqual({ value: 1 })

    timeline.undo()
    expect(timeline.current).toEqual({ value: 0 })
    expect(timeline.canRedo).toBe(true)

    const snapshot = timeline.current
    snapshot.value = 99
    expect(timeline.current).toEqual({ value: 0 })

    timeline.redo()
    expect(timeline.current).toEqual({ value: 1 })
  })

  it('records one history entry for one committed user action', () => {
    const timeline = createCommandTimeline({ value: 0 }, (state) => ({ ...state }))

    timeline.commit('change value', { value: 1 })

    expect(timeline.past).toHaveLength(1)
    expect(timeline.current).toEqual({ value: 1 })
  })
})

describe('object operations', () => {
  const ids = { nextId: (_project: ReturnType<typeof defaultProject>, sceneId: string) => `${sceneId}-created` }

  it('creates an object in a new immutable project snapshot', () => {
    const project = defaultProject()
    const result = createObject(project, { sceneId: 'scene-gallery', assetKind: 'cube' }, ids)

    expect(result.objectId).toBe('scene-gallery-created')
    expect(result.project.scenes[0].objects).toHaveLength(1)
    expect(project.scenes[0].objects).toHaveLength(0)
  })

  it('duplicates an object with a fresh identity and copied transform', () => {
    const project = createObject(defaultProject(), { sceneId: 'scene-gallery', assetKind: 'sphere' }, ids).project
    const source = project.scenes[0].objects[0]
    const result = duplicateObject(project, { sceneId: 'scene-gallery', objectId: source.id }, {
      nextId: () => 'sphere-copy',
    })

    expect(result.objectId).toBe('sphere-copy')
    expect(result.project.scenes[0].objects[1]).toMatchObject({ id: 'sphere-copy', name: 'Sphere 0 Copy' })
    expect(result.project.scenes[0].objects[1].transform).toEqual(source.transform)
    expect(result.project.scenes[0].objects[1].transform).not.toBe(source.transform)
  })

  it('removes an object while returning undo information', () => {
    const project = createObject(defaultProject(), { sceneId: 'scene-gallery', assetKind: 'cylinder' }, ids).project
    const object = project.scenes[0].objects[0]
    const result = removeObject(project, { sceneId: 'scene-gallery', objectId: object.id })

    expect(result.originalIndex).toBe(0)
    expect(result.removedObject?.id).toBe(object.id)
    expect(result.project.scenes[0].objects).toHaveLength(0)
    expect(project.scenes[0].objects).toHaveLength(1)
  })

  it('rejects unknown scenes and objects', () => {
    expect(() => createObject(defaultProject(), { sceneId: 'missing', assetKind: 'cube' }, ids)).toThrow(ObjectOperationError)
    expect(() => removeObject(defaultProject(), { sceneId: 'scene-gallery', objectId: 'missing' })).toThrow(ObjectOperationError)
  })

  it('updates visibility and enabled state immutably', () => {
    const project = createObject(defaultProject(), { sceneId: 'scene-gallery', assetKind: 'cube' }, ids).project
    const object = project.scenes[0].objects[0]
    const hidden = setObjectVisible(project, { sceneId: 'scene-gallery', objectId: object.id, value: false }).project
    const disabled = setObjectEnabled(hidden, { sceneId: 'scene-gallery', objectId: object.id, value: false }).project

    expect(project.scenes[0].objects[0]).toMatchObject({ visible: true, enabled: true })
    expect(disabled.scenes[0].objects[0]).toMatchObject({ visible: false, enabled: false })
  })

  it('restores a deleted object through timeline undo and removes it again on redo', () => {
    const created = createObject(defaultProject(), { sceneId: 'scene-gallery', assetKind: 'cube' }, ids)
    const object = created.project.scenes[0].objects[0]
    const timeline = createCommandTimeline(created.project, (state) => JSON.parse(JSON.stringify(state)) as ProjectData)

    const removed = removeObject(timeline.current, { sceneId: 'scene-gallery', objectId: object.id })
    timeline.commit('Delete object', removed.project)
    expect(timeline.current.scenes[0].objects).toHaveLength(0)

    timeline.undo()
    expect(timeline.current.scenes[0].objects[0]).toMatchObject({ id: object.id, name: object.name })

    timeline.redo()
    expect(timeline.current.scenes[0].objects).toHaveLength(0)
  })
})

describe('parent-child hierarchy', () => {
  // a table (obj-0) with two children: a vase (obj-1) and a lamp (obj-2)
  const buildFamily = () => {
    let n = 0
    const ids = { nextId: () => `obj-${n++}` }
    let project = createObject(defaultProject(), { sceneId: 'scene-gallery', assetKind: 'cube' }, ids).project
    project = createObject(project, { sceneId: 'scene-gallery', assetKind: 'sphere' }, ids).project
    project = createObject(project, { sceneId: 'scene-gallery', assetKind: 'cylinder' }, ids).project
    project = reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-1', parentId: 'obj-0' }).project
    project = reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-2', parentId: 'obj-0' }).project
    return { project, ids }
  }
  const objects = (project: ProjectData) => project.scenes[0].objects

  it('sets a parent and clears it again with null', () => {
    const { project } = buildFamily()
    expect(objects(project).find((item) => item.id === 'obj-1')?.parentId).toBe('obj-0')

    const detached = reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-1', parentId: null }).project
    expect(objects(detached).find((item) => item.id === 'obj-1')?.parentId).toBeUndefined()
    expect(objects(project).find((item) => item.id === 'obj-1')?.parentId).toBe('obj-0')
  })

  it('recomputes local transform on reparent so world position is unchanged', () => {
    let { project } = buildFamily()
    project = updateObjectTransform(project, { sceneId: 'scene-gallery', objectId: 'obj-0', changes: { position: [10, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [2, 2, 2] } }).project
    project = updateObjectTransform(project, { sceneId: 'scene-gallery', objectId: 'obj-1', changes: { position: [0, 0, 0] } }).project

    const worldBefore = composeWorldTransform(objects(project), 'obj-1')
    const detached = reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-1', parentId: null }).project
    const worldAfter = composeWorldTransform(objects(detached), 'obj-1')

    expect(worldAfter.position.x).toBeCloseTo(worldBefore.position.x, 6)
    expect(worldAfter.position.y).toBeCloseTo(worldBefore.position.y, 6)
    expect(worldAfter.position.z).toBeCloseTo(worldBefore.position.z, 6)
    // Detaching to top-level makes local === world, so the local transform now
    // carries the parent's rotation/scale contribution directly.
    const detachedObject = objects(detached).find((item) => item.id === 'obj-1')!
    expect(detachedObject.parentId).toBeUndefined()
    expect(detachedObject.transform.position[0]).toBeCloseTo(10, 6)
  })

  it('recomputes local transform when reparenting between two transformed parents', () => {
    let { project } = buildFamily()
    project = updateObjectTransform(project, { sceneId: 'scene-gallery', objectId: 'obj-0', changes: { position: [10, 0, 0] } }).project
    project = updateObjectTransform(project, { sceneId: 'scene-gallery', objectId: 'obj-2', changes: { position: [0, 5, 0], rotation: [0, Math.PI / 2, 0] } }).project

    const worldBefore = composeWorldTransform(objects(project), 'obj-1')
    const moved = reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-1', parentId: 'obj-2' }).project
    const worldAfter = composeWorldTransform(objects(moved), 'obj-1')

    expect(worldAfter.position.x).toBeCloseTo(worldBefore.position.x, 6)
    expect(worldAfter.position.y).toBeCloseTo(worldBefore.position.y, 6)
    expect(worldAfter.position.z).toBeCloseTo(worldBefore.position.z, 6)
    expect(objects(moved).find((item) => item.id === 'obj-1')?.parentId).toBe('obj-2')
  })

  it('rejects self-parenting, cycles, and missing parents', () => {
    const { project } = buildFamily()
    expect(() => reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-0', parentId: 'obj-0' })).toThrow(ObjectOperationError)
    expect(() => reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-0', parentId: 'obj-1' })).toThrow(ObjectOperationError)
    expect(() => reparentObject(project, { sceneId: 'scene-gallery', objectId: 'obj-1', parentId: 'missing' })).toThrow(ObjectOperationError)
  })

  it('duplicates a parent together with its subtree and remaps child links', () => {
    const { project, ids } = buildFamily()
    const result = duplicateObject(project, { sceneId: 'scene-gallery', objectId: 'obj-0' }, ids)

    expect(objects(result.project)).toHaveLength(6)
    const rootCopy = objects(result.project).find((item) => item.id === result.objectId)
    expect(rootCopy?.name).toBe('Cube 0 Copy')
    expect(rootCopy?.parentId).toBeUndefined()
    expect(objects(result.project).filter((item) => item.parentId === result.objectId)).toHaveLength(2)
    expect(objects(project)).toHaveLength(3)
  })

  it('drops rules referencing a removed object, keeps unrelated and surviving-object rules', () => {
    const { project } = buildFamily()
    const rules: InteractionRule[] = [
      { id: 'rule-target', objectId: 'obj-1', triggers: ['onClick'], actions: [{ kind: 'playAudio' }] },
      { id: 'rule-other', objectId: 'obj-2', triggers: ['onClick'], actions: [{ kind: 'playAudio' }] },
      { id: 'rule-scene-start', triggers: ['sceneStart'], actions: [{ kind: 'playAudio' }] },
    ]
    const withRules = { ...project, rules }

    const result = removeObject(withRules, { sceneId: 'scene-gallery', objectId: 'obj-1' })

    expect(result.project.rules?.map((rule) => rule.id)).toEqual(['rule-other', 'rule-scene-start'])
    expect(result.removedRules?.map((rule) => rule.id)).toEqual(['rule-target'])
    expect(withRules.rules).toHaveLength(3)
  })

  it('drops rules for every descendant when removing a parent', () => {
    const { project } = buildFamily()
    const rules: InteractionRule[] = [
      { id: 'rule-parent', objectId: 'obj-0', triggers: ['onClick'], actions: [{ kind: 'playAudio' }] },
      { id: 'rule-child-1', objectId: 'obj-1', triggers: ['onClick'], actions: [{ kind: 'playAudio' }] },
      { id: 'rule-child-2', objectId: 'obj-2', triggers: ['onClick'], actions: [{ kind: 'playAudio' }] },
    ]
    const withRules = { ...project, rules }

    const result = removeObject(withRules, { sceneId: 'scene-gallery', objectId: 'obj-0' })

    expect(result.project.rules).toEqual([])
    expect(result.removedRules?.map((rule) => rule.id).sort()).toEqual(['rule-child-1', 'rule-child-2', 'rule-parent'])
  })

  it('removes a parent together with its whole subtree', () => {
    const { project } = buildFamily()
    const result = removeObject(project, { sceneId: 'scene-gallery', objectId: 'obj-0' })

    expect(objects(result.project)).toHaveLength(0)
    expect(result.removedObject?.id).toBe('obj-0')
    expect(objects(project)).toHaveLength(3)
  })

  it('restores a removed subtree with parent links intact through timeline undo', () => {
    const { project } = buildFamily()
    const timeline = createCommandTimeline(project, (state) => JSON.parse(JSON.stringify(state)) as ProjectData)
    timeline.commit('Delete subtree', removeObject(timeline.current, { sceneId: 'scene-gallery', objectId: 'obj-0' }).project)
    expect(objects(timeline.current)).toHaveLength(0)

    timeline.undo()
    expect(objects(timeline.current)).toHaveLength(3)
    expect(objects(timeline.current).find((item) => item.id === 'obj-2')?.parentId).toBe('obj-0')
  })
})