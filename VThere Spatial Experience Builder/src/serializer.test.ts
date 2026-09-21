import { describe, expect, it } from 'vitest'
import { deserializeProject } from './serializer'
import { defaultCameraPose, defaultEnvironmentId } from './model'

describe('deserializeProject backfill', () => {
  it('fills in environmentId and startCamera for a project saved before those fields existed', () => {
    const legacy = JSON.stringify({
      schemaVersion: 1,
      id: 'project-legacy',
      name: 'Legacy Draft',
      activeSceneId: 'scene-a',
      scenes: [{ id: 'scene-a', name: 'Room', objects: [] }],
    })
    const project = deserializeProject(legacy)
    expect(project.scenes[0].environmentId).toBe(defaultEnvironmentId)
    expect(project.scenes[0].startCamera).toEqual(defaultCameraPose())
  })

  it('rejects an unsupported schema version', () => {
    expect(() => deserializeProject(JSON.stringify({ schemaVersion: 2 }))).toThrow()
  })
})

describe('deserializeProject hierarchy validation', () => {
  const objectJson = (id: string, parentId?: string) => ({
    id,
    name: id,
    assetId: 'primitive-cube',
    assetKind: 'cube',
    ...(parentId === undefined ? {} : { parentId }),
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  })
  const projectJson = (objects: unknown[]) => JSON.stringify({
    schemaVersion: 1,
    id: 'project-hierarchy',
    name: 'Hierarchy Draft',
    activeSceneId: 'scene-a',
    scenes: [{ id: 'scene-a', name: 'Room', objects }],
  })

  it('accepts a valid parent reference and keeps it', () => {
    const project = deserializeProject(projectJson([objectJson('table'), objectJson('vase', 'table')]))
    expect(project.scenes[0].objects[1].parentId).toBe('table')
  })

  it('rejects a parent that does not exist in the scene', () => {
    expect(() => deserializeProject(projectJson([objectJson('vase', 'missing-table')]))).toThrow()
  })

  it('rejects an object parented to itself', () => {
    expect(() => deserializeProject(projectJson([objectJson('vase', 'vase')]))).toThrow()
  })

  it('rejects a parent-child cycle', () => {
    expect(() => deserializeProject(projectJson([objectJson('a', 'b'), objectJson('b', 'a')]))).toThrow()
  })
})
