import { describe, expect, it } from 'vitest'
import { deserializeProject, serializeProject } from './serializer'
import { defaultCameraPose, defaultEnvironmentId } from './model'
import { removeObject } from '../packages/authoring-engine/src/index'

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

describe('deserializeProject rules and zones', () => {
  const cube = {
    id: 'cube-1',
    name: 'Cube',
    assetId: 'primitive-cube',
    assetKind: 'cube',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  }
  const zone = {
    id: 'zone-a',
    name: 'Entry Zone',
    shape: { kind: 'box', size: [2, 2, 2] },
    position: [0, 0, 0],
  }
  const projectJson = (extra: Record<string, unknown> = {}, sceneExtra: Record<string, unknown> = {}) =>
    JSON.stringify({
      schemaVersion: 1,
      id: 'project-rules',
      name: 'Rules Draft',
      activeSceneId: 'scene-a',
      scenes: [{ id: 'scene-a', name: 'Room', objects: [cube], ...sceneExtra }],
      ...extra,
    })

  it('backfills rules and zones to empty for a project saved before they existed', () => {
    const project = deserializeProject(projectJson())
    expect(project.rules).toEqual([])
    expect(project.scenes[0].zones).toEqual([])
  })

  it('keeps a valid rule referencing an existing object', () => {
    const project = deserializeProject(
      projectJson({ rules: [{ id: 'r1', objectId: 'cube-1', triggers: ['click'], actions: [{ kind: 'showPanel' }] }] }),
    )
    expect(project.rules?.[0].id).toBe('r1')
  })

  it('keeps a valid rule referencing an existing zone', () => {
    const project = deserializeProject(
      projectJson(
        { rules: [{ id: 'r1', zoneId: 'zone-a', triggers: ['zoneEnter'], actions: [{ kind: 'playAudio' }] }] },
        { zones: [zone] },
      ),
    )
    expect(project.rules?.[0].zoneId).toBe('zone-a')
  })

  it('keeps a lifecycle rule that names no object', () => {
    const project = deserializeProject(
      projectJson({ rules: [{ id: 'r1', triggers: ['sceneStart'], actions: [{ kind: 'showPanel' }] }] }),
    )
    expect(project.rules?.[0].objectId).toBeUndefined()
  })

  it('rejects a rule referencing an object that does not exist', () => {
    expect(() =>
      deserializeProject(projectJson({ rules: [{ id: 'r1', objectId: 'ghost', triggers: ['click'], actions: [] }] })),
    ).toThrow(/object that does not exist/)
  })

  it('rejects a rule referencing a zone that does not exist', () => {
    expect(() =>
      deserializeProject(projectJson({ rules: [{ id: 'r1', zoneId: 'ghost-zone', triggers: [], actions: [] }] })),
    ).toThrow(/zone that does not exist/)
  })

  it('rejects duplicate rule IDs', () => {
    expect(() =>
      deserializeProject(projectJson({
        rules: [
          { id: 'r1', triggers: ['click'], actions: [] },
          { id: 'r1', triggers: ['hover'], actions: [] },
        ],
      })),
    ).toThrow(/duplicate interaction rule/i)
  })

  it('rejects an action with no kind', () => {
    expect(() =>
      deserializeProject(projectJson({ rules: [{ id: 'r1', triggers: ['click'], actions: [{ params: {} }] }] })),
    ).toThrow(/invalid action/)
  })

  it('rejects duplicate zone IDs', () => {
    expect(() => deserializeProject(projectJson({}, { zones: [zone, zone] }))).toThrow(/duplicate zone/i)
  })

  it('rejects a zone with a non-positive radius', () => {
    expect(() =>
      deserializeProject(projectJson({}, {
        zones: [{ id: 'z', name: 'Z', shape: { kind: 'sphere', radius: 0 }, position: [0, 0, 0] }],
      })),
    ).toThrow(/sphere radius/)
  })

  it('rejects a zone with an unknown shape', () => {
    expect(() =>
      deserializeProject(projectJson({}, {
        zones: [{ id: 'z', name: 'Z', shape: { kind: 'pyramid' }, position: [0, 0, 0] }],
      })),
    ).toThrow(/unknown shape/)
  })

  it('round-trips rules and zones through serialize and deserialize', () => {
    const original = deserializeProject(
      projectJson(
        { rules: [{ id: 'r1', zoneId: 'zone-a', triggers: ['zoneEnter'], actions: [{ kind: 'playAudio', params: { assetId: 'a1' } }], priority: 5 }] },
        { zones: [zone] },
      ),
    )
    const restored = deserializeProject(serializeProject(original))
    expect(restored.rules).toEqual(original.rules)
    expect(restored.scenes[0].zones).toEqual(original.scenes[0].zones)
  })

  it('round-trips after removing an object that a rule referenced', () => {
    const original = deserializeProject(
      projectJson({ rules: [{ id: 'r1', objectId: 'cube-1', triggers: ['click'], actions: [{ kind: 'playAudio' }] }] }),
    )

    const result = removeObject(original, { sceneId: 'scene-a', objectId: 'cube-1' })

    expect(result.project.rules).toEqual([])
    expect(() => deserializeProject(serializeProject(result.project))).not.toThrow()
    const restored = deserializeProject(serializeProject(result.project))
    expect(restored.rules).toEqual([])
  })
})
