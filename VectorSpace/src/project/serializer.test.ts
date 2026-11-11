import { describe, expect, it } from 'vitest'
import { deserializeProject, serializeProject } from './serializer'
import { defaultCameraPose, defaultEnvironmentId } from './model'
import { removeObject } from '@vectorspace/authoring-engine'

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

  // triggerParams is new and optional, so a rule saved before it existed must come back exactly the same
  it('loads an older rule without triggerParams unchanged', () => {
    const rule = { id: 'r1', objectId: 'cube-1', triggers: ['click'], actions: [{ kind: 'showPanel', params: { attachmentId: 'att-1' } }] }
    const project = deserializeProject(projectJson({ rules: [rule] }))
    expect(project.rules).toEqual([rule])
  })

  it('keeps triggerParams on a card-closed rule through save and load', () => {
    const original = deserializeProject(
      projectJson({ rules: [{ id: 'r1', objectId: 'cube-1', triggers: ['panelClosed'], triggerParams: { cardId: 'att-1' }, actions: [{ kind: 'playAudio' }] }] }),
    )
    const restored = deserializeProject(serializeProject(original))
    expect(restored.rules?.[0].triggerParams).toEqual({ cardId: 'att-1' })
  })

  it('rejects triggerParams that is not a plain object', () => {
    for (const triggerParams of [null, ['att-1'], 'att-1']) {
      expect(() =>
        deserializeProject(projectJson({ rules: [{ id: 'r1', triggers: ['panelClosed'], triggerParams, actions: [] }] })),
      ).toThrow(/invalid trigger parameters/)
    }
  })

  // a deleted card must never make a student's project fail to open
  it('loads a card-closed rule whose card no longer exists', () => {
    expect(() =>
      deserializeProject(projectJson({ rules: [{ id: 'r1', objectId: 'cube-1', triggers: ['panelClosed'], triggerParams: { cardId: 'deleted-card' }, actions: [] }] })),
    ).not.toThrow()
  })
})

describe('deserializeProject attachments and text assets', () => {
  const objectJson = (id: string, attachments?: unknown) => ({
    id,
    name: 'Cube',
    assetId: 'primitive-cube',
    assetKind: 'cube',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    ...(attachments === undefined ? {} : { attachments }),
  })
  const textAttachment = (id: string, presentation: Record<string, unknown> = { mode: 'panel' }) =>
    ({ id, kind: 'text', assetId: 'text-1', presentation })
  const projectJson = (objects: unknown[], extra: Record<string, unknown> = {}, sceneExtra: Record<string, unknown> = {}) =>
    JSON.stringify({
      schemaVersion: 1,
      id: 'project-attachments',
      name: 'Attachments Draft',
      activeSceneId: 'scene-a',
      scenes: [{ id: 'scene-a', name: 'Room', objects, ...sceneExtra }],
      ...extra,
    })

  it('round-trips audio and text attachments on objects and zones', () => {
    const original = deserializeProject(projectJson(
      [objectJson('cube-1', [{ id: 'att-1', kind: 'audio', assetId: 'creak' }, textAttachment('att-2', { mode: 'panel', title: 'Info', modal: true, style: { color: '#ffcc00' } })])],
      {},
      { zones: [{ id: 'zone-a', name: 'Z', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0], attachments: [textAttachment('att-3', { mode: 'dialogue' })] }] },
    ))
    const restored = deserializeProject(serializeProject(original))
    expect(restored.scenes[0].objects[0].attachments).toEqual(original.scenes[0].objects[0].attachments)
    expect(restored.scenes[0].zones?.[0].attachments).toHaveLength(1)
  })

  it('round-trips image and video attachments on objects and zones', () => {
    const original = deserializeProject(projectJson(
      [objectJson('cube-1', [{ id: 'att-1', kind: 'image', assetId: 'media-photo', name: 'Photo' }, { id: 'att-2', kind: 'video', assetId: 'media-clip' }])],
      {},
      { zones: [{ id: 'zone-a', name: 'Z', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0], attachments: [{ id: 'att-3', kind: 'video', assetId: 'media-clip' }] }] },
    ))
    const restored = deserializeProject(serializeProject(original))
    expect(restored.scenes[0].objects[0].attachments).toEqual([
      { id: 'att-1', kind: 'image', assetId: 'media-photo', name: 'Photo' },
      { id: 'att-2', kind: 'video', assetId: 'media-clip' },
    ])
    expect(restored.scenes[0].zones?.[0].attachments).toEqual([{ id: 'att-3', kind: 'video', assetId: 'media-clip' }])
  })

  it('loads a save written before image and video existed with its attachments unchanged', () => {
    // the attachment shapes a save could hold before Step 0: audio and text only
    const before = [{ id: 'att-1', kind: 'audio', assetId: 'creak' }, textAttachment('att-2', { mode: 'panel', title: 'Info', autoCloseMs: 3000 })]
    const project = deserializeProject(projectJson([objectJson('cube-1', before)]))
    expect(project.scenes[0].objects[0].attachments).toEqual(before)
  })

  it('rejects an image or video attachment without a library entry id', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [{ id: 'att-1', kind: 'image' }])]))).toThrow(/invalid attachment/)
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [{ id: 'att-1', kind: 'video', assetId: '' }])]))).toThrow(/invalid attachment/)
  })

  it('round-trips an info card with media and reserved fields', () => {
    const card = textAttachment('att-1', {
      mode: 'card',
      title: 'The Rosetta Stone',
      autoCloseMs: 8000,
      media: { kind: 'image', assetId: 'media-stone', caption: 'Found in 1799', alt: 'A dark stone slab covered in writing' },
      fields: [{ key: 'reflection', label: 'What surprised you?', prompt: 'Write one sentence' }, { key: 'intro', label: 'Intro', locked: true }],
    })
    const original = deserializeProject(projectJson([objectJson('cube-1', [card])]))
    const restored = deserializeProject(serializeProject(original))
    expect(restored.scenes[0].objects[0].attachments).toEqual([card])
  })

  it('accepts a card with no media and no fields', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [textAttachment('att-1', { mode: 'card', title: 'Plain card' })])]))).not.toThrow()
  })

  it('rejects card media that is not an image or video library reference', () => {
    const withMedia = (media: unknown) => projectJson([objectJson('cube-1', [textAttachment('att-1', { mode: 'card', media })])])
    expect(() => deserializeProject(withMedia({ kind: 'audio', assetId: 'creak' }))).toThrow(/invalid media/)
    expect(() => deserializeProject(withMedia({ kind: 'image' }))).toThrow(/invalid media/)
    expect(() => deserializeProject(withMedia({ kind: 'video', assetId: 'clip', caption: 'x'.repeat(501) }))).toThrow(/invalid caption/)
    expect(() => deserializeProject(withMedia({ kind: 'image', assetId: 'photo', alt: 42 }))).toThrow(/invalid alt text/)
  })

  it('rejects malformed reserved card fields', () => {
    const withFields = (fields: unknown) => projectJson([objectJson('cube-1', [textAttachment('att-1', { mode: 'card', fields })])])
    expect(() => deserializeProject(withFields('blank'))).toThrow(/invalid field list/)
    expect(() => deserializeProject(withFields([{ key: '', label: 'Empty key' }]))).toThrow(/invalid field/)
    expect(() => deserializeProject(withFields([{ key: 'a', label: 'A', locked: 'yes' }]))).toThrow(/invalid field/)
  })

  it('accepts an attachment whose assetId is in no catalog', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [{ id: 'att-1', kind: 'audio', assetId: 'missing-forever' }])]))).not.toThrow()
  })

  it('leaves attachments undefined and backfills textAssets to empty for older files', () => {
    const project = deserializeProject(projectJson([objectJson('cube-1')]))
    expect(project.scenes[0].objects[0].attachments).toBeUndefined()
    expect(project.textAssets).toEqual([])
  })

  it('rejects duplicate attachment IDs even across different hosts', () => {
    expect(() => deserializeProject(projectJson([
      objectJson('cube-1', [{ id: 'att-1', kind: 'audio', assetId: 'a' }]),
      objectJson('cube-2', [{ id: 'att-1', kind: 'audio', assetId: 'b' }]),
    ]))).toThrow(/duplicate attachment/)
  })

  it('rejects unknown attachment kinds', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [{ id: 'att-1', kind: 'hologram', assetId: 'a' }])]))).toThrow(/unknown kind/)
  })

  it('rejects a host with more than 16 attachments', () => {
    const attachments = Array.from({ length: 17 }, (_, index) => ({ id: `att-${index}`, kind: 'audio', assetId: 'a' }))
    expect(() => deserializeProject(projectJson([objectJson('cube-1', attachments)]))).toThrow(/too many attachments/)
  })

  it('rejects a text attachment with an invalid presentation mode or colour', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [textAttachment('att-1', { mode: 'hud' })])]))).toThrow(/invalid presentation/)
    expect(() => deserializeProject(projectJson([objectJson('cube-1', [textAttachment('att-1', { mode: 'panel', style: { color: 'url(evil)' } })])]))).toThrow(/invalid colour/)
  })

  const textAsset = (assetId: string, content: string, extra: Record<string, unknown> = {}) =>
    ({ assetId, name: assetId, format: 'plain', lang: 'en', content, ...extra })

  it('keeps a valid text asset and strips control characters from its content', () => {
    const project = deserializeProject(projectJson([objectJson('cube-1')], {
      textAssets: [textAsset('text-1', 'Hello world\nline two\ttabbed')],
    }))
    expect(project.textAssets?.[0].content).toBe('Hello world\nline two\ttabbed')
  })

  it('rejects duplicate text asset IDs and unknown formats', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1')], {
      textAssets: [textAsset('text-1', 'a'), textAsset('text-1', 'b')],
    }))).toThrow(/duplicate text asset/)
    expect(() => deserializeProject(projectJson([objectJson('cube-1')], {
      textAssets: [textAsset('text-1', 'a', { format: 'html' })],
    }))).toThrow(/invalid text asset/)
  })

  it('rejects a text asset over 64 KB, counting variants toward the cap', () => {
    expect(() => deserializeProject(projectJson([objectJson('cube-1')], {
      textAssets: [textAsset('text-1', 'x'.repeat(65_537))],
    }))).toThrow(/64 KB/)
    expect(() => deserializeProject(projectJson([objectJson('cube-1')], {
      textAssets: [textAsset('text-1', 'x'.repeat(40_000), { variants: { fr: 'y'.repeat(40_000) } })],
    }))).toThrow(/64 KB/)
  })

  it('rejects project text totalling over 512 KB', () => {
    const textAssets = Array.from({ length: 9 }, (_, index) => textAsset(`text-${index}`, 'x'.repeat(60_000)))
    expect(() => deserializeProject(projectJson([objectJson('cube-1')], { textAssets }))).toThrow(/512 KB/)
  })
})
