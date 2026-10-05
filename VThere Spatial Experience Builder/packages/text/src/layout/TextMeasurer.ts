/**
 * @file        TextMeasurer.ts
 * @brief       The measuring seam between layout maths and the browser.
 *
 * @responsibility
 * Real text measuring needs canvas measureText, which needs a browser, so
 * TextLayout depends on this interface instead: the app supplies a
 * canvas-backed implementation (step 4/5 of the build sequence), and every
 * unit test uses FakeTextMeasurer's fixed glyph width so wrapping and paging
 * are deterministic under vitest with no DOM.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 6
 */
export interface FontSpec {
  /** A resolved font family — the app maps roles (body/heading/mono) to this. */
  family: string
  sizePx: number
  lineHeightPx: number
}

export interface TextMeasurer {
  /** Width of one run of text in px, and the line height for this font. */
  measure(text: string, font: FontSpec): { width: number; height: number }
}

/** Every glyph one fixed width: wrapping maths become exactly predictable. */
export class FakeTextMeasurer implements TextMeasurer {
  constructor(private readonly glyphWidth = 10) {}

  measure(text: string, font: FontSpec): { width: number; height: number } {
    // count graphemes, not UTF-16 units, so surrogate pairs measure as one
    return { width: [...text].length * this.glyphWidth, height: font.lineHeightPx }
  }
}
