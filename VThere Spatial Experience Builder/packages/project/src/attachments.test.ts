import { describe, expect, it } from 'vitest'
import { assetRefForAttachment, collectAttachments, findAttachment } from './attachments'
import { defaultProject, makeObject, type Attachment } from './index'

const audio = (id: string): Attachment => ({ id, kind: 'audio', assetId: 'creak' })
const text = (id: string): Attachment => ({ id, kind: 'text', assetId: 'text-1', presentation: { mode: 'panel' } })

const build = () => {
  const project = defaultProject()
  const scene = project.scenes[0]
  const cube = makeObject('cube', 0)
  cube.id = 'obj-0'
  cube.attachments = [audio('att-0'), text('att-1')]
  scene.objects.push(cube)
  scene.zones = [{ id: 'zone-0', name: 'Zone', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0], attachments: [text('att-2')] }]
  return project
}

describe('attachment lookup helpers', () => {
  it('finds an attachment on an object or a zone with its host and scene', () => {
    const project = build()
    expect(findAttachment(project, 'att-1')).toMatchObject({ sceneId: 'scene-gallery', host: { kind: 'object', id: 'obj-0' } })
    expect(findAttachment(project, 'att-2')).toMatchObject({ host: { kind: 'zone', id: 'zone-0' } })
    expect(findAttachment(project, 'missing')).toBeUndefined()
  })

  it('collects every attachment in a scene, hosts included', () => {
    const found = collectAttachments(build().scenes[0])
    expect(found.map((item) => item.attachment.id)).toEqual(['att-0', 'att-1', 'att-2'])
    expect(found[2].host).toEqual({ kind: 'zone', id: 'zone-0' })
  })

  it('builds the AssetRef an attachment resolves through', () => {
    expect(assetRefForAttachment(audio('att-0'))).toEqual({ assetId: 'creak', kind: 'audio' })
    expect(assetRefForAttachment(text('att-1'))).toEqual({ assetId: 'text-1', kind: 'text' })
  })
})
