import { describe, expect, it } from 'vitest'
import { UrlPolicy } from './UrlPolicy'

describe('UrlPolicy', () => {
  const policy = new UrlPolicy()

  it('allows https: and mailto: only', () => {
    expect(policy.check('https://example.org/page')).toBe('https://example.org/page')
    expect(policy.check('mailto:hello@example.org')).toBe('mailto:hello@example.org')
  })

  it('rejects every other scheme, including the dangerous ones', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://example.org',
      'blob:https://example.org/uuid',
      'file:///etc/passwd',
      'vbscript:evil',
    ]) {
      expect(policy.check(href)).toBeNull()
    }
  })

  it('rejects relative, scheme-relative, and malformed URLs', () => {
    expect(policy.check('/local/path')).toBeNull()
    expect(policy.check('//example.org/page')).toBeNull()
    expect(policy.check('not a url')).toBeNull()
    expect(policy.check('')).toBeNull()
  })
})
