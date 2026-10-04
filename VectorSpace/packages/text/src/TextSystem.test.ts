import { describe, expect, it } from 'vitest'
import { TextSystem } from './TextSystem'
import { TextLibrary } from './TextLibrary'
import { FakeTextMeasurer } from './layout/TextMeasurer'
import type { TextAttachment, TextAssetMeta } from '@vthere/project'

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
    expect(result.lines.length).toBeGreaterThan(0)
    expect(result.lines[0].startsHeading).toBe(true)
  })

  it('dispose closes every panel and clears listeners', () => {
    const text = build()
    text.open(attachment())
    text.dispose()
    expect(text.getStats().openPanels).toBe(0)
  })
})
