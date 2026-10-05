/**
 * @file        RichTextParser.ts
 * @brief       Hand-written markdown-lite/plain parser producing a bounded TextNode tree.
 *
 * @responsibility
 * Turns author text into the typed tree and nothing else: no HTML in, no
 * HTML out — raw HTML in the source stays literal text. Supports paragraphs,
 * headings 1-3, bold, italic, inline code, policy-checked links, ordered and
 * unordered lists, and hard line breaks. A malformed construct is left as
 * literal text, never an error; node count, nesting depth and list size are
 * capped so a hostile file cannot exhaust memory (past a cap the parser
 * truncates). No dependency, pure function of its input.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 2
 */
import type { TextFormat } from '@vthere/project'
import { DEFAULT_TEXT_LIMITS, type InlineNode, type TextLimits, type TextNode } from './nodes'
import { UrlPolicy } from '../UrlPolicy'

/** Shared budget: every created node spends one; at zero the tree truncates. */
interface ParseBudget { remaining: number }

const HEADING = /^(#{1,3})\s+(.*)$/
const UNORDERED_ITEM = /^[-*]\s+(.*)$/
const ORDERED_ITEM = /^\d{1,9}\.\s+(.*)$/

export class RichTextParser {
  constructor(
    private readonly urlPolicy: UrlPolicy = new UrlPolicy(),
    private readonly limits: TextLimits = DEFAULT_TEXT_LIMITS,
  ) {}

  parse(format: TextFormat, source: string): TextNode[] {
    const budget: ParseBudget = { remaining: this.limits.maxNodes }
    return format === 'plain' ? this.parsePlain(source, budget) : this.parseMarkdownLite(source, budget)
  }

  private parsePlain(source: string, budget: ParseBudget): TextNode[] {
    const blocks: TextNode[] = []
    for (const block of source.split(/\n{2,}/)) {
      if (!block.trim() || budget.remaining <= 0) continue
      budget.remaining -= 1
      blocks.push({ type: 'paragraph', children: this.linesAsInline(block.split('\n'), budget) })
    }
    return blocks
  }

  private parseMarkdownLite(source: string, budget: ParseBudget): TextNode[] {
    const blocks: TextNode[] = []
    for (const block of source.split(/\n{2,}/)) {
      const lines = block.split('\n').filter((line) => line.trim().length > 0)
      let paragraphRun: string[] = []
      const flushParagraph = () => {
        if (paragraphRun.length === 0 || budget.remaining <= 0) { paragraphRun = []; return }
        budget.remaining -= 1
        blocks.push({ type: 'paragraph', children: this.linesAsInline(paragraphRun, budget) })
        paragraphRun = []
      }
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        const heading = HEADING.exec(line)
        if (heading) {
          flushParagraph()
          if (budget.remaining <= 0) continue
          budget.remaining -= 1
          blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, children: this.parseInline(heading[2], 0, budget) })
          continue
        }
        const itemPattern = UNORDERED_ITEM.test(line) ? UNORDERED_ITEM : ORDERED_ITEM.test(line) ? ORDERED_ITEM : undefined
        if (itemPattern) {
          flushParagraph()
          const items: InlineNode[][] = []
          while (index < lines.length && itemPattern.test(lines[index]) && items.length < this.limits.maxListItems) {
            const item = itemPattern.exec(lines[index]) as RegExpExecArray
            items.push(this.parseInline(item[1], 0, budget))
            index += 1
          }
          // skip any items dropped by the cap so they don't reparse as paragraphs
          while (index < lines.length && itemPattern.test(lines[index])) index += 1
          index -= 1
          if (budget.remaining <= 0) continue
          budget.remaining -= 1
          blocks.push({ type: 'list', ordered: itemPattern === ORDERED_ITEM, items })
          continue
        }
        paragraphRun.push(line)
      }
      flushParagraph()
    }
    return blocks
  }

  /** Joins a paragraph's lines with hard break nodes. */
  private linesAsInline(lines: string[], budget: ParseBudget): InlineNode[] {
    const children: InlineNode[] = []
    lines.forEach((line, index) => {
      if (index > 0 && budget.remaining > 0) {
        budget.remaining -= 1
        children.push({ type: 'break' })
      }
      children.push(...this.parseInline(line, 0, budget))
    })
    return children
  }

  private parseInline(text: string, depth: number, budget: ParseBudget): InlineNode[] {
    // past the depth cap the content is kept, just without further styling
    if (depth >= this.limits.maxDepth) return this.textNode(text, budget)
    const nodes: InlineNode[] = []
    let literal = ''
    const flushLiteral = () => {
      if (literal) nodes.push(...this.textNode(literal, budget))
      literal = ''
    }
    let i = 0
    while (i < text.length) {
      if (budget.remaining <= 0) { literal = ''; return nodes }
      if (text[i] === '`') {
        const close = text.indexOf('`', i + 1)
        if (close > i) {
          flushLiteral()
          budget.remaining -= 1
          nodes.push({ type: 'code', value: text.slice(i + 1, close) })
          i = close + 1
          continue
        }
      }
      if (text.startsWith('**', i)) {
        const close = text.indexOf('**', i + 2)
        if (close > i + 2) {
          flushLiteral()
          budget.remaining -= 1
          nodes.push({ type: 'strong', children: this.parseInline(text.slice(i + 2, close), depth + 1, budget) })
          i = close + 2
          continue
        }
      }
      if (text[i] === '*') {
        const close = text.indexOf('*', i + 1)
        if (close > i + 1) {
          flushLiteral()
          budget.remaining -= 1
          nodes.push({ type: 'emphasis', children: this.parseInline(text.slice(i + 1, close), depth + 1, budget) })
          i = close + 1
          continue
        }
      }
      if (text[i] === '[') {
        const labelEnd = text.indexOf(']', i + 1)
        if (labelEnd > 0 && text[labelEnd + 1] === '(') {
          const hrefEnd = text.indexOf(')', labelEnd + 2)
          if (hrefEnd > 0) {
            const label = text.slice(i + 1, labelEnd)
            const href = this.urlPolicy.check(text.slice(labelEnd + 2, hrefEnd))
            flushLiteral()
            if (href === null) {
              // a rejected URL renders as the visible label, as plain content
              nodes.push(...this.parseInline(label, depth + 1, budget))
            } else {
              budget.remaining -= 1
              nodes.push({ type: 'link', href, children: this.parseInline(label, depth + 1, budget) })
            }
            i = hrefEnd + 1
            continue
          }
        }
      }
      // any unmatched marker falls through to here and stays literal text
      literal += text[i]
      i += 1
    }
    flushLiteral()
    return nodes
  }

  private textNode(value: string, budget: ParseBudget): InlineNode[] {
    if (!value || budget.remaining <= 0) return []
    budget.remaining -= 1
    return [{ type: 'text', value }]
  }
}
