import { describe, expect, it } from 'vitest'
import { TextLibrary, TextSystem } from '../../packages/text/src/index'
import { handlePanelKey } from './panelKeys'

const build = () => {
  const text = new TextSystem({ library: new TextLibrary([{ assetId: 'text-1', name: 'Intro', format: 'plain', lang: 'en', content: 'Hello' }]) })
  const open = (id: string) => text.open({ id, kind: 'text', assetId: 'text-1', presentation: { mode: 'card', title: id } })
  return { text, open }
}

describe('handlePanelKey', () => {
  it('closes only the top panel on Escape and reports it handled the key', () => {
    const { text, open } = build()
    open('att-a')
    open('att-b')
    expect(handlePanelKey({ key: 'Escape', repeat: false }, text)).toBe(true)
    expect(text.store.isOpen('att-b')).toBe(false)
    expect(text.store.isOpen('att-a')).toBe(true)
  })

  it('lets every other key through without closing anything', () => {
    const { text, open } = build()
    open('att-a')
    for (const key of ['Enter', ' ', 'a', 'ArrowLeft', 'Tab']) expect(handlePanelKey({ key, repeat: false }, text)).toBe(false)
    expect(text.store.isOpen('att-a')).toBe(true)
  })

  it('ignores a held-down Escape, so one press closes one panel', () => {
    const { text, open } = build()
    open('att-a')
    expect(handlePanelKey({ key: 'Escape', repeat: true }, text)).toBe(false)
    expect(text.store.isOpen('att-a')).toBe(true)
  })

  it('lets Escape through when no panel is open, so it can still leave Play', () => {
    const { text } = build()
    expect(handlePanelKey({ key: 'Escape', repeat: false }, text)).toBe(false)
  })
})
