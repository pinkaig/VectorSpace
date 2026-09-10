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
