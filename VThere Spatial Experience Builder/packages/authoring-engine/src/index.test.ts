import { describe, expect, it } from 'vitest'
import { createCommandTimeline, createObject, duplicateObject, ObjectOperationError, removeObject } from './index'
import { defaultProject } from '@vthere/project'

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
})