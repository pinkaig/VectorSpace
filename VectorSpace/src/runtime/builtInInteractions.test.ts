import { describe, expect, it } from 'vitest'
import { createActionRegistry, createEffectRegistry, createRuntimeState } from '../../packages/interaction/src/index'
import { TextLibrary, TextSystem } from '../../packages/text/src/index'
import { makeObject, type SceneObject, type TextAttachment, type VideoAttachment } from '../project/model'
import { clickPanelFor, registerMediaActions, videoPopup } from './builtInInteractions'

const card: TextAttachment = { id: 'att-card', kind: 'text', assetId: 'card-text', presentation: { mode: 'card', title: 'T-rex' } }
const video: VideoAttachment = { id: 'att-video', kind: 'video', assetId: 'media-clip' }
const thing = (attachments: SceneObject['attachments'], overrides: Partial<SceneObject> = {}): SceneObject =>
  ({ ...makeObject('cube', 0), id: 'obj', name: 'Dino', attachments, ...overrides })

describe('clickPanelFor', () => {
  it('opens the info card when the thing has one, even if it also has a video', () => {
    expect(clickPanelFor(thing([video, card]))).toBe(card)
  })

  it('opens the video in a pop-up when there is no card', () => {
    expect(clickPanelFor(thing([video]))).toEqual({
      id: 'video:att-video', kind: 'text', assetId: '',
      presentation: { mode: 'card', title: 'Dino', media: { kind: 'video', assetId: 'media-clip' } },
    })
  })

  it('opens nothing for a plain message panel, a hidden thing, or a thing with nothing attached', () => {
    const panel: TextAttachment = { ...card, presentation: { mode: 'panel' } }
    expect(clickPanelFor(thing([panel]))).toBeUndefined()
    expect(clickPanelFor(thing([card], { visible: false }))).toBeUndefined()
    expect(clickPanelFor(thing(undefined))).toBeUndefined()
    expect(clickPanelFor(undefined)).toBeUndefined()
  })
})

describe('video pop-up in the text system', () => {
  it('opens as a card with only the video, no text asset needed', () => {
    const text = new TextSystem({ library: new TextLibrary([]) })
    const handle = text.open(videoPopup({ name: 'Dino' }, video))
    expect(handle.state).toBe('open')
    expect(text.store.getSnapshot().panels[0]).toMatchObject({ mode: 'card', title: 'Dino', media: { kind: 'video', assetId: 'media-clip' } })
  })

  it('playMedia opens it and stopMedia closes it', async () => {
    const text = new TextSystem({ library: new TextLibrary([]) })
    const registry = createActionRegistry()
    registerMediaActions(registry, text, (id) => (id === 'att-video' ? { object: thing([video]), video } : undefined))
    const ctx = { state: createRuntimeState('scene'), effects: createEffectRegistry() }
    await registry.execute({ kind: 'playMedia', params: { attachmentId: 'att-video' } }, ctx)
    expect(text.store.isOpen('video:att-video')).toBe(true)
    await registry.execute({ kind: 'stopMedia', params: { attachmentId: 'att-video' } }, ctx)
    expect(text.store.isOpen('video:att-video')).toBe(false)
  })
})
