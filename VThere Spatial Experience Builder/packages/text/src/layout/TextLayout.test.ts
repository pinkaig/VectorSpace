import { describe, expect, it } from 'vitest'
import { TextLayout } from './TextLayout'
import { FakeTextMeasurer, type FontSpec } from './TextMeasurer'
import type { TextNode } from '../parse/nodes'

// every glyph 10px wide, lines 16px tall: a 100px box fits 10 glyphs per line
const layout = new TextLayout(new FakeTextMeasurer(10))
const font: FontSpec = { family: 'body', sizePx: 14, lineHeightPx: 16 }
const paragraph = (value: string): TextNode => ({ type: 'paragraph', children: [{ type: 'text', value }] })

describe('TextLayout wrapping', () => {
  it('wraps at word boundaries within the box width', () => {
    const result = layout.layout([paragraph('aaa bbb ccc ddd')], { width: 100, height: 160 }, font)
    for (const line of result.lines) expect(line.width).toBeLessThanOrEqual(100)
    expect(result.lines.map((line) => line.text)).toEqual(['aaa bbb ', 'ccc ddd'])
  })

  it('wraps CJK text between characters instead of overflowing', () => {
    const result = layout.layout([paragraph('欢迎来到滨海仓库展览空间')], { width: 50, height: 160 }, font)
    expect(result.lines.length).toBeGreaterThan(1)
    for (const line of result.lines) expect(line.width).toBeLessThanOrEqual(50)
  })

  it('force-breaks a single unbreakable word longer than the box at the grapheme', () => {
    const result = layout.layout([paragraph('abcdefghijklmnopqrstuvwxyz')], { width: 100, height: 160 }, font)
    expect(result.lines.map((line) => line.text)).toEqual(['abcdefghij', 'klmnopqrst', 'uvwxyz'])
  })
})

describe('TextLayout paging', () => {
  it('groups lines into pages that fit the box height', () => {
    const result = layout.layout([paragraph('aaa bbb ccc ddd eee fff ggg hhh')], { width: 40, height: 32 }, font)
    // 32px box at 16px lines = 2 lines per page
    for (const page of result.pages) expect(page.length).toBeLessThanOrEqual(2)
    expect(result.pages.flat()).toEqual(result.lines)
  })

  it('never leaves a heading alone at the bottom of a page', () => {
    const heading: TextNode = { type: 'heading', level: 2, children: [{ type: 'text', value: 'Title' }] }
    const result = layout.layout(
      [paragraph('one'), heading, paragraph('body text')],
      { width: 200, height: 32 },
      font,
    )
    for (const page of result.pages) {
      const last = page.at(-1)
      const pageIsLast = page === result.pages.at(-1)
      if (last?.startsHeading && !pageIsLast) throw new Error('heading stranded at page bottom')
    }
    expect(result.pages[0].map((line) => line.text)).toEqual(['one'])
    expect(result.pages[1].map((line) => line.text)).toEqual(['Title', 'body text'])
  })

  it('returns one empty page for empty content', () => {
    const result = layout.layout([], { width: 100, height: 32 }, font)
    expect(result.pages).toEqual([[]])
  })
})
