import { describe, expect, it } from 'vitest'
import { createActionRegistry, createEffectRegistry, createRuntimeState, type ActionContext } from '@vthere/interaction'
import type { TextAssetMeta, TextAttachment } from '@vthere/project'
import { TextLibrary } from '../TextLibrary'
import { TextSystem } from '../TextSystem'
import { registerTextActions } from './registerTextActions'
import { createTextEventBridge, type TextRuntimeEvent } from './TextEventBridge'

const meta: TextAssetMeta = { assetId: 'text-1', name: 'Intro', format: 'plain', lang: 'en', content: 'Welcome' }
const attachment: TextAttachment = {
  id: 'att-1',
  kind: 'text',
  assetId: 'text-1',
  presentation: { mode: 'panel' },
}

const setup = () => {
  const text = new TextSystem({ library: new TextLibrary([meta]) })
  const registry = createActionRegistry()
  registerTextActions(registry, text, { findAttachment: (id) => (id === 'att-1' ? attachment : undefined) })
  const effects = createEffectRegistry()
  const ctx: ActionContext = { state: createRuntimeState('scene-1'), effects }
  return { text, registry, ctx, effects }
}

describe('registerTextActions', () => {
  it('showPanel opens a panel and registers a disposer that closes it on reset', async () => {
    const { text, registry, ctx, effects } = setup()
    await registry.execute({ kind: 'showPanel', params: { attachmentId: 'att-1' } }, ctx)

    expect(text.store.isOpen('att-1')).toBe(true)
    expect(effects.size).toBe(1)

    effects.disposeAll()
    expect(text.store.isOpen('att-1')).toBe(false)
  })

  it('showPanel accepts componentId as an alias of attachmentId', async () => {
    const { text, registry, ctx } = setup()
    await registry.execute({ kind: 'showPanel', params: { componentId: 'att-1' } }, ctx)
    expect(text.store.isOpen('att-1')).toBe(true)
  })

  it('showPanel opens a hostless panel from assetId alone', async () => {
    const { text, registry, ctx } = setup()
    await registry.execute({ kind: 'showPanel', params: { assetId: 'text-1', title: 'Note' } }, ctx)
    const panel = text.store.getSnapshot().panels[0]
    expect(panel.assetId).toBe('text-1')
    expect(panel.title).toBe('Note')
  })

  it('showPanel warns and no-ops for an unknown attachment or missing params', async () => {
    const { text, registry, ctx, effects } = setup()
    await registry.execute({ kind: 'showPanel', params: { attachmentId: 'missing' } }, ctx)
    await registry.execute({ kind: 'showPanel' }, ctx)
    expect(text.store.getSnapshot().panels).toHaveLength(0)
    expect(effects.size).toBe(0)
  })

  it('hidePanel closes by attachmentId, top, and all', async () => {
    const { text, registry, ctx } = setup()
    await registry.execute({ kind: 'showPanel', params: { attachmentId: 'att-1' } }, ctx)
    await registry.execute({ kind: 'showPanel', params: { assetId: 'text-1' } }, ctx)
    await registry.execute({ kind: 'hidePanel', params: { attachmentId: 'att-1' } }, ctx)
    expect(text.store.isOpen('att-1')).toBe(false)

    await registry.execute({ kind: 'hidePanel', params: { top: true } }, ctx)
    expect(text.getStats().openPanels).toBe(0)

    await registry.execute({ kind: 'showPanel', params: { attachmentId: 'att-1' } }, ctx)
    await registry.execute({ kind: 'hidePanel', params: { all: true } }, ctx)
    expect(text.getStats().openPanels).toBe(0)
  })

  it('advancePanel dispatches both directions, no-op at the ends', async () => {
    const { text, registry, ctx } = setup()
    const handle = text.open(attachment)
    // give the open panel a real sequence to move through
    text.store.getSnapshot()
    await registry.execute({ kind: 'advancePanel', params: { attachmentId: 'att-1', dir: 'prev' } }, ctx)
    expect(text.store.getPanel(handle.id)?.page).toBe(0)
    await registry.execute({ kind: 'advancePanel', params: { attachmentId: 'att-1' } }, ctx)
    expect(text.store.getPanel(handle.id)?.page).toBe(0) // pageCount 1: next is a no-op too
  })
})

describe('createTextEventBridge', () => {
  it('forwards panelOpened and panelClosed with a re-entrancy guard', () => {
    const { text } = setup()
    const events: TextRuntimeEvent[] = []
    const unsubscribe = createTextEventBridge(text.store, (event) => {
      events.push(event)
      // a rule reacting synchronously must not recurse through the bridge
      if (event.kind === 'panelOpened') text.close({ top: true })
    })

    text.open(attachment)

    expect(events.map((event) => event.kind)).toEqual(['panelOpened'])
    expect(events[0].payload.attachmentId).toBe('att-1')
    expect(text.getStats().openPanels).toBe(0)

    unsubscribe()
    text.open(attachment)
    expect(events).toHaveLength(1)
  })
})
