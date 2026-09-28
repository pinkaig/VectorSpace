import { describe, expect, it } from 'vitest'
import { RichTextParser } from './RichTextParser'
import { UrlPolicy } from '../UrlPolicy'

const parser = new RichTextParser()

describe('RichTextParser: well-formed input', () => {
  it('splits plain text into paragraphs on blank lines with breaks inside', () => {
    const nodes = parser.parse('plain', 'line one\nline two\n\nsecond paragraph')
    expect(nodes).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'line one' }, { type: 'break' }, { type: 'text', value: 'line two' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'second paragraph' }] },
    ])
  })

  it('parses headings, emphasis, code, and policy-passing links', () => {
    const nodes = parser.parse('markdown-lite', '## Title\n\nSome **bold** and *soft* and `mono` text with a [link](https://example.org).')
    expect(nodes[0]).toEqual({ type: 'heading', level: 2, children: [{ type: 'text', value: 'Title' }] })
    expect(nodes[1].type).toBe('paragraph')
    const children = nodes[1].type === 'paragraph' ? nodes[1].children : []
    expect(children).toContainEqual({ type: 'strong', children: [{ type: 'text', value: 'bold' }] })
    expect(children).toContainEqual({ type: 'emphasis', children: [{ type: 'text', value: 'soft' }] })
    expect(children).toContainEqual({ type: 'code', value: 'mono' })
    expect(children).toContainEqual({ type: 'link', href: 'https://example.org', children: [{ type: 'text', value: 'link' }] })
  })

  it('parses unordered and ordered lists', () => {
    const nodes = parser.parse('markdown-lite', '- first\n- second\n\n1. one\n2. two')
    expect(nodes[0]).toMatchObject({ type: 'list', ordered: false })
    expect(nodes[1]).toMatchObject({ type: 'list', ordered: true })
    expect(nodes[0].type === 'list' && nodes[0].items).toHaveLength(2)
  })

  it('does not treat four hashes as a heading', () => {
    const nodes = parser.parse('markdown-lite', '#### not a heading')
    expect(nodes[0].type).toBe('paragraph')
  })
})

describe('RichTextParser: malformed input stays literal, never an error', () => {
  it('keeps unclosed markers as literal text', () => {
    const nodes = parser.parse('markdown-lite', 'an **unclosed marker and a `dangling tick')
    expect(nodes).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: 'an **unclosed marker and a `dangling tick' }] },
    ])
  })

  it('keeps a link with a missing closing paren literal', () => {
    const nodes = parser.parse('markdown-lite', 'see [label](https://example.org')
    expect(nodes[0].type === 'paragraph' && nodes[0].children).toEqual([
      { type: 'text', value: 'see [label](https://example.org' },
    ])
  })
})

describe('RichTextParser: hostile input', () => {
  it('leaves raw HTML as inert literal text', () => {
    const nodes = parser.parse('markdown-lite', '<script>alert(1)</script> and <img src=x onerror=alert(1)>')
    expect(nodes).toEqual([
      { type: 'paragraph', children: [{ type: 'text', value: '<script>alert(1)</script> and <img src=x onerror=alert(1)>' }] },
    ])
  })

  it('drops a javascript: link to plain text, keeping only the visible label', () => {
    // the URL scan ends at the first ')', so the trailing ') now' stays text —
    // what matters is that the javascript: URL never survives into the tree
    const nodes = parser.parse('markdown-lite', 'click [here](javascript:alert(1)) now')
    const children = nodes[0].type === 'paragraph' ? nodes[0].children : []
    expect(children).toEqual([
      { type: 'text', value: 'click ' },
      { type: 'text', value: 'here' },
      { type: 'text', value: ') now' },
    ])
    expect(JSON.stringify(nodes)).not.toContain('javascript')
  })

  it('caps nesting depth instead of recursing without bound', () => {
    const deep = new RichTextParser(new UrlPolicy(), { maxNodes: 10_000, maxDepth: 3, maxListItems: 10 })
    const nodes = deep.parse('markdown-lite', '*'.repeat(40) + 'core' + '*'.repeat(40))
    const depthOf = (node: unknown): number => {
      const children = (node as { children?: unknown[] }).children
      if (!children) return 0
      return 1 + Math.max(0, ...children.map(depthOf))
    }
    expect(Math.max(...nodes.map(depthOf))).toBeLessThanOrEqual(4)
  })

  it('caps an oversized list at maxListItems', () => {
    const small = new RichTextParser(new UrlPolicy(), { maxNodes: 10_000, maxDepth: 8, maxListItems: 5 })
    const source = Array.from({ length: 50 }, (_, index) => `- item ${index}`).join('\n')
    const nodes = small.parse('markdown-lite', source)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type === 'list' && nodes[0].items).toHaveLength(5)
  })

  it('truncates instead of exhausting memory when the node budget runs out', () => {
    const tiny = new RichTextParser(new UrlPolicy(), { maxNodes: 8, maxDepth: 8, maxListItems: 10 })
    const nodes = tiny.parse('markdown-lite', Array.from({ length: 100 }, (_, index) => `paragraph ${index}`).join('\n\n'))
    const count = JSON.stringify(nodes).match(/"type"/g)?.length ?? 0
    expect(count).toBeLessThanOrEqual(8)
  })
})
