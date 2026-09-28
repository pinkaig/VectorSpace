/**
 * @file        TextLayout.ts
 * @brief       Wraps a node tree into lines for a box, and groups lines into pages.
 *
 * @responsibility
 * Pure layout maths against the TextMeasurer seam. Wrapping breaks at word
 * boundaries via Intl.Segmenter where available (so CJK text wraps between
 * characters instead of overflowing), force-breaks a single unbreakable word
 * longer than the box at the grapheme, and never splits a grapheme. Paging
 * fits whole lines into the box height and never leaves a heading alone at
 * the bottom of a page. Overlay panels can rely on DOM wrapping instead;
 * this path exists for dialogue and canvas surfaces.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 6
 */
import type { InlineNode, TextNode } from '../parse/nodes'
import type { FontSpec, TextMeasurer } from './TextMeasurer'

export interface LayoutLine {
  text: string
  width: number
  /** True when this line begins a heading block — the paging widow rule keys off it. */
  startsHeading: boolean
}

export interface TextLayoutResult {
  lines: LayoutLine[]
  /** Lines grouped into pages that each fit the box height; one page when everything fits. */
  pages: LayoutLine[][]
}

const flattenInline = (children: InlineNode[]): string =>
  children
    .map((node) => {
      switch (node.type) {
        case 'text': return node.value
        case 'code': return node.value
        case 'break': return '\n'
        case 'link': return flattenInline(node.children)
        default: return flattenInline(node.children)
      }
    })
    .join('')

const blockText = (node: TextNode): { text: string; heading: boolean }[] => {
  if (node.type === 'list') {
    return node.items.map((item) => ({ text: flattenInline(item), heading: false }))
  }
  return flattenInline(node.children)
    .split('\n')
    .map((line) => ({ text: line, heading: node.type === 'heading' }))
}

/** Word segments where supported; graphemes otherwise — never inside a grapheme. */
const segment = (text: string): string[] => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    return [...segmenter.segment(text)].map((entry) => entry.segment)
  }
  return text.split(/(\s+)/).filter((piece) => piece.length > 0)
}

export class TextLayout {
  constructor(private readonly measurer: TextMeasurer) {}

  layout(nodes: TextNode[], box: { width: number; height: number }, font: FontSpec): TextLayoutResult {
    const lines: LayoutLine[] = []
    for (const node of nodes) {
      for (const { text, heading } of blockText(node)) {
        const wrapped = this.wrapLine(text, box.width, font)
        wrapped.forEach((line, index) => lines.push({ ...line, startsHeading: heading && index === 0 }))
      }
    }
    return { lines, pages: this.page(lines, box, font) }
  }

  private wrapLine(text: string, boxWidth: number, font: FontSpec): Array<{ text: string; width: number }> {
    if (!text) return [{ text: '', width: 0 }]
    const lines: Array<{ text: string; width: number }> = []
    let current = ''
    const push = () => {
      lines.push({ text: current, width: this.measurer.measure(current, font).width })
      current = ''
    }
    for (const piece of segment(text)) {
      const candidate = current + piece
      if (this.measurer.measure(candidate, font).width <= boxWidth || current === '') {
        if (this.measurer.measure(piece, font).width > boxWidth && current === '') {
          // one unbreakable word wider than the box: force-break at the grapheme
          for (const grapheme of [...piece]) {
            if (this.measurer.measure(current + grapheme, font).width > boxWidth && current !== '') push()
            current += grapheme
          }
        } else {
          current = candidate
        }
      } else {
        push()
        // a leading space carries no meaning at a line start
        current = piece.trim().length === 0 ? '' : piece
      }
    }
    if (current !== '' || lines.length === 0) push()
    return lines
  }

  private page(lines: LayoutLine[], box: { width: number; height: number }, font: FontSpec): LayoutLine[][] {
    const lineHeight = this.measurer.measure('x', font).height
    const perPage = Math.max(1, Math.floor(box.height / lineHeight))
    const pages: LayoutLine[][] = []
    let current: LayoutLine[] = []
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const isLastSlot = current.length === perPage - 1
      const hasFollowingContent = index + 1 < lines.length
      // a heading alone at the bottom of a page reads as a mistake; push it
      // to the next page so it opens the content it titles
      if (line.startsHeading && isLastSlot && hasFollowingContent) {
        pages.push(current)
        current = []
      }
      current.push(line)
      if (current.length === perPage) {
        pages.push(current)
        current = []
      }
    }
    if (current.length > 0) pages.push(current)
    return pages.length > 0 ? pages : [[]]
  }
}
