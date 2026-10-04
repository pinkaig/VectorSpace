/**
 * @file        UrlPolicy.ts
 * @brief       The one gate deciding which link URLs survive parsing.
 *
 * @responsibility
 * Links are the only way author text can reach outside the experience, so
 * every href passes here inside the parser: https: and mailto: pass through,
 * everything else (javascript:, data:, http:, blob:, file:, scheme-relative
 * or malformed input) is rejected and the construct renders as plain text.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Text-System section 3
 * Links point at the project wiki; migration is still in progress.
 */
const ALLOWED_PROTOCOLS = new Set(['https:', 'mailto:'])

export class UrlPolicy {
  /** Returns the href to store, or null when the URL must become plain text. */
  check(href: string): string | null {
    let parsed: URL
    try {
      // no base URL on purpose: a relative or scheme-relative href fails
      // here rather than silently resolving against wherever the app runs
      parsed = new URL(href)
    } catch {
      return null
    }
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? href : null
  }
}
