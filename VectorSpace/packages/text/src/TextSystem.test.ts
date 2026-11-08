import { describe, expect, it } from 'vitest'
import { TextSystem } from './TextSystem'
import { TextLibrary } from './TextLibrary'
import { FakeTextMeasurer } from './layout/TextMeasurer'
import type { TextAttachment, TextAssetMeta } from '@vectorspace/project'

const meta: TextAssetMeta = {
  assetId: 'text-1',
  name: 'Intro',
  format: 'markdown-lite',
  lang: 'en',
  content: '# Welcome\n\nEnjoy the **exhibition**.',
}
const attachment = (overrides: Partial<TextAttachment> = {}): TextAttachment => ({
  id: 'att-1',
  kind: 'text',
  assetId: 'text-1',
  presentation: { mode: 'panel' },
  ...overrides,
})
const build = (opts: { clock?: () => number } = {}) =>
  new TextSystem({ library: new TextLibrary([meta]), measurer: new FakeTextMeasurer(10), clock: opts.clock })

describe('TextSystem', () => {
  it('opens a panel with the parsed node tree, synchronously', async () => {
    const text = build()
    const handle = text.open(attachment())

    expect(handle.state).toBe('open')
    expect(handle.nodes?.[0]).toEqual({ type: 'heading', level: 1, children: [{ type: 'text', value: 'Welcome' }] })
    expect(text.getNodes(handle.id)).toBe(handle.nodes)
    expect(text.store.isOpen('att-1')).toBe(true)
    await handle.ready

    handle.close()
    expect(text.store.isOpen('att-1')).toBe(false)
    expect(text.getNodes(handle.id)).toBeUndefined()
  })

  it('opens an error panel and emits panelError for a missing assetId, without throwing', () => {
    const text = build()
    const kinds: string[] = []
    text.store.onEvent((event) => kinds.push(event.kind))

    const handle = text.open(attachment({ id: 'att-broken', assetId: 'no-such-asset' }))

    expect(handle.state).toBe('error')
    expect(handle.nodes).toBeUndefined()
    expect(kinds).toEqual(['panelOpened', 'panelError'])
  })

  it('carries title and lang into the panel status for the overlay, params first', () => {
    const text = build()
    text.open(attachment({ presentation: { mode: 'panel', title: 'From presentation' } }), { title: 'From action' })
    const panel = text.store.getSnapshot().panels[0]
    expect(panel.title).toBe('From action')
    expect(panel.lang).toBe('en')
  })

  it('lets action params override the attachment presentation for modal and auto-close', () => {
    let now = 0
    const text = build({ clock: () => now })
    text.open(attachment({ presentation: { mode: 'panel', modal: false } }), { modal: true, autoCloseMs: 100 })
    expect(text.store.getSnapshot().modalOpen).toBe(true)

    now = 100
    text.tick()
    expect(text.getStats()).toEqual({ openPanels: 0, modalOpen: false })
  })

  it('lays out an attachment through the measurer seam', () => {
    const text = build()
    const result = text.layout(attachment(), { width: 100, height: 64 }, { family: 'body', sizePx: 14, lineHeightPx: 16 })
    expect(result?.lines.length).toBeGreaterThan(0)
    expect(result?.lines[0].startsHeading).toBe(true)
  })

  it('dispose closes every panel and clears listeners', () => {
    const text = build()
    text.open(attachment())
    text.dispose()
    expect(text.getStats().openPanels).toBe(0)
  })
})

describe('TextSystem info cards', () => {
  const card = (id: string, presentation: Partial<TextAttachment['presentation']> = {}): TextAttachment =>
    attachment({ id, presentation: { mode: 'card', title: 'Card', ...presentation } })
  const media = { kind: 'image' as const, assetId: 'media-stone', caption: 'Found in 1799', alt: 'A stone slab' }

  it('carries a card\'s media reference into the panel status', () => {
    const text = build()
    const handle = text.open(card('att-card', { media }))
    const status = text.store.getSnapshot().panels.find((panel) => panel.id === handle.id)
    expect(status).toMatchObject({ mode: 'card', media })
  })

  it('ignores media on a plain panel, so only cards show it', () => {
    const text = build()
    text.open(attachment({ presentation: { mode: 'panel', media } }))
    expect(text.store.getSnapshot().panels[0].media).toBeUndefined()
  })

  it('stacks two cards with the modal one on top, the same as panels', () => {
    const text = build()
    const modal = text.open(card('att-a', { modal: true }))
    const plain = text.open(card('att-b'))
    const snapshot = text.store.getSnapshot()
    expect(snapshot.panels.map((panel) => panel.id)).toEqual([plain.id, modal.id])
    expect(snapshot.topPanelId).toBe(modal.id)
    expect(snapshot.modalOpen).toBe(true)
  })

  it('closes a card on its auto-close timer and never after it was closed by hand', () => {
    let now = 0
    const text = build({ clock: () => now })
    text.open(card('att-timed', { autoCloseMs: 5000 }))
    const closedEarly = text.open(card('att-early', { autoCloseMs: 5000 }))
    closedEarly.close()
    now = 4999
    text.tick()
    expect(text.store.isOpen('att-timed')).toBe(true)
    now = 5000
    text.tick()
    expect(text.store.isOpen('att-timed')).toBe(false)
    expect(text.store.getSnapshot().panels).toEqual([])
  })

  it('still drops javascript: links from a card\'s text', () => {
    const text = new TextSystem({
      library: new TextLibrary([{ ...meta, content: 'A [bad link](javascript:alert(1)) and a [good one](https://example.org).' }]),
    })
    const nodes = text.open(card('att-links')).nodes ?? []
    const hrefs = JSON.stringify(nodes).match(/"href":"[^"]*"/g) ?? []
    expect(hrefs).toEqual(['"href":"https://example.org"'])
  })
})
