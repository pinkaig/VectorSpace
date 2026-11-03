import { describe, expect, it } from 'vitest'
import { deserializeProject, serializeProject } from '../project/serializer'
import { defaultProject, makeObject, type ProjectData } from '../project/model'
import { createHotspotCard, findCard, findVideo, removeObjectCard, removeObjectVideo, saveObjectCard, saveObjectVideo, type CardInput } from './cardEditorOperations'

const build = (): ProjectData => {
  const project = defaultProject()
  const cube = makeObject('cube', 0)
  cube.id = 'obj-1'
  project.scenes[0].objects.push(cube)
  return project
}
const sceneId = (project: ProjectData) => project.scenes[0].id
const card: CardInput = {
  title: 'The Rosetta Stone',
  body: 'Found in **1799**.',
  media: { kind: 'image', assetId: 'media-stone', caption: ' Found near Rashid ', alt: 'A dark stone slab' },
}
const ok = <T extends { ok: boolean }>(result: T) => {
  if (!result.ok) throw new Error(JSON.stringify(result))
  return result as Extract<T, { ok: true }>
}

describe('saveObjectCard', () => {
  it('adds the card and its text in one project value that saves and loads', () => {
    const before = build()
    const { project, attachmentId } = ok(saveObjectCard(before, sceneId(before), 'obj-1', card))
    const found = findCard(project, project.scenes[0].objects[0])
    expect(found?.attachment).toMatchObject({ id: attachmentId, presentation: { mode: 'card', title: 'The Rosetta Stone', media: { caption: 'Found near Rashid' } } })
    expect(found?.meta).toMatchObject({ format: 'markdown-lite', content: 'Found in **1799**.' })
    expect(before.scenes[0].objects[0].attachments).toBeUndefined()
    const loaded = deserializeProject(serializeProject(project))
    expect(loaded.scenes[0].objects[0].attachments).toEqual(project.scenes[0].objects[0].attachments)
    expect(loaded.textAssets).toEqual(project.textAssets)
  })

  it('edits the existing card instead of adding a second one', () => {
    const first = ok(saveObjectCard(build(), 'scene-gallery', 'obj-1', card))
    const second = ok(saveObjectCard(first.project, 'scene-gallery', 'obj-1', { title: 'Renamed', body: 'New text' }))
    expect(second.attachmentId).toBe(first.attachmentId)
    expect(second.project.scenes[0].objects[0].attachments).toHaveLength(1)
    expect(findCard(second.project, second.project.scenes[0].objects[0])?.attachment.presentation.media).toBeUndefined()
    expect(second.project.textAssets).toHaveLength(1)
    expect(second.project.textAssets?.[0].content).toBe('New text')
  })

  it('refuses input the save file would reject', () => {
    const project = build()
    expect(saveObjectCard(project, 'scene-gallery', 'obj-1', { ...card, title: '  ' })).toMatchObject({ ok: false })
    expect(saveObjectCard(project, 'scene-gallery', 'obj-1', { ...card, title: 'x'.repeat(201) })).toMatchObject({ ok: false })
    expect(saveObjectCard(project, 'scene-gallery', 'obj-1', { ...card, body: 'x'.repeat(65_537) })).toMatchObject({ ok: false })
    expect(saveObjectCard(project, 'scene-gallery', 'obj-1', { ...card, media: { kind: 'image', assetId: 'm', alt: '', caption: ' ' } })).toMatchObject({ ok: false, error: /Add a caption/ })
    expect(saveObjectCard(project, 'scene-gallery', 'missing', card)).toMatchObject({ ok: false })
  })
})

describe('removeObjectCard', () => {
  it('removes the card and its text together', () => {
    const { project } = ok(saveObjectCard(build(), 'scene-gallery', 'obj-1', card))
    const removed = removeObjectCard(project, 'scene-gallery', 'obj-1')
    expect(removed.scenes[0].objects[0].attachments).toEqual([])
    expect(removed.textAssets).toEqual([])
  })

  it('returns the same project when there is no card to remove', () => {
    const project = build()
    expect(removeObjectCard(project, 'scene-gallery', 'obj-1')).toBe(project)
  })
})

describe('createHotspotCard', () => {
  it('adds a marked sphere zone holding one card, and the save loads', () => {
    const { project, attachmentId } = ok(createHotspotCard(build(), 'scene-gallery', [1, 0, 2], card))
    const zone = project.scenes[0].zones?.at(-1)
    expect(zone).toMatchObject({ marker: 'hotspot', shape: { kind: 'sphere' }, position: [1, 0, 2] })
    expect(zone?.attachments?.[0].id).toBe(attachmentId)
    expect(deserializeProject(serializeProject(project)).scenes[0].zones?.at(-1)?.marker).toBe('hotspot')
  })

  it('rejects an unknown zone marker on load, and loads zones saved before markers existed', () => {
    const { project } = ok(createHotspotCard(build(), 'scene-gallery', [0, 0, 0], card))
    const json = JSON.parse(serializeProject(project))
    json.scenes[0].zones[0].marker = 'beacon'
    expect(() => deserializeProject(JSON.stringify(json))).toThrow(/unknown marker/)
    delete json.scenes[0].zones[0].marker
    expect(deserializeProject(JSON.stringify(json)).scenes[0].zones?.[0].marker).toBeUndefined()
  })
})

describe('picture captions', () => {
  it('uses the caption as the picture description when none is given', () => {
    const { project } = ok(saveObjectCard(build(), 'scene-gallery', 'obj-1', { title: 'Stone', body: '', media: { kind: 'image', assetId: 'm', caption: 'A dark slab' } }))
    expect(findCard(project, project.scenes[0].objects[0])?.attachment.presentation.media).toEqual({ kind: 'image', assetId: 'm', caption: 'A dark slab', alt: 'A dark slab' })
  })
})

describe('object video', () => {
  it('adds, changes and removes the one video on an object, and the save loads', () => {
    const first = ok(saveObjectVideo(build(), 'scene-gallery', 'obj-1', 'media-clip'))
    const second = ok(saveObjectVideo(first.project, 'scene-gallery', 'obj-1', 'media-other'))
    expect(second.attachmentId).toBe(first.attachmentId)
    expect(findVideo(second.project.scenes[0].objects[0])).toMatchObject({ kind: 'video', assetId: 'media-other' })
    expect(deserializeProject(serializeProject(second.project)).scenes[0].objects[0].attachments).toEqual(second.project.scenes[0].objects[0].attachments)
    const removed = removeObjectVideo(second.project, 'scene-gallery', 'obj-1')
    expect(findVideo(removed.scenes[0].objects[0])).toBeUndefined()
    expect(saveObjectVideo(build(), 'scene-gallery', 'obj-1', '')).toMatchObject({ ok: false })
    const onScreen = ok(saveObjectVideo(build(), 'scene-gallery', 'obj-1', 'media-clip', true))
    expect(findVideo(onScreen.project.scenes[0].objects[0])).toMatchObject({ screen: true })
    const offScreen = ok(saveObjectVideo(onScreen.project, 'scene-gallery', 'obj-1', 'media-clip', false))
    expect(findVideo(offScreen.project.scenes[0].objects[0])).not.toHaveProperty('screen')
  })
})
