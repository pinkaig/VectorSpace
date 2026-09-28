/**
 * @file        nodes.ts
 * @brief       The typed node tree author text parses into, and its size limits.
 *
 * @responsibility
 * Defines the only shape text ever takes after parsing. The whole security
 * design rests on this being a bounded, typed tree and never a string of
 * HTML: React or a canvas draws the tree, so there is nothing to sanitise
 * and a parser bug can produce wrong formatting but not script.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 2
 */
export type TextNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'emphasis'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] }   // href already passed UrlPolicy
  | { type: 'break' }

/**
 * Caps a hostile or accidental huge document cannot exceed: past a cap the
 * parser truncates to what it has (a malformed or oversized input is never
 * an error, per the "left as literal text" rule).
 */
export interface TextLimits {
  /** Total nodes across the whole tree, block and inline. */
  maxNodes: number
  /** Inline nesting depth; deeper content is kept as plain text. */
  maxDepth: number
  /** Items in one list; further items are dropped. */
  maxListItems: number
}

export const DEFAULT_TEXT_LIMITS: TextLimits = {
  maxNodes: 10_000,
  maxDepth: 8,
  maxListItems: 1_000,
}
