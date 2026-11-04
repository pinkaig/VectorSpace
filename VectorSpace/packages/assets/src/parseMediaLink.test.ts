import { describe, expect, it } from 'vitest'
import cases from './mediaLinkCases.json'
import { parseMediaLink } from './parseMediaLink'

// the same list the server's parser is tested against (apps/api/tests/test_media_policy.py)
describe('parseMediaLink', () => {
  it.each(cases.accept)('accepts %j as YouTube video dQw4w9WgXcQ', (url) => {
    expect(parseMediaLink(url)).toEqual({ provider: 'youtube', providerId: 'dQw4w9WgXcQ' })
  })

  it.each(cases.reject)('refuses %j', (url) => {
    expect(parseMediaLink(url)).toHaveProperty('error')
  })
})
