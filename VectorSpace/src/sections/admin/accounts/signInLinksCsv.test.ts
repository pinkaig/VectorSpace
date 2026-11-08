import { describe, expect, it } from 'vitest'
import type { ImportRow } from '../../../api/admin'
import { signInLinksCsv } from './signInLinksCsv'

const row = (changes: Partial<ImportRow>): ImportRow => ({
  line: 2, email: 'a@x.test', name: 'A', role: 'student', classNames: [], outcome: 'created',
  accountId: 'id', inviteLink: 'https://tenant.test/a', error: null, ...changes,
})

describe('signInLinksCsv', () => {
  it('lists only created rows that have a link', () => {
    const text = signInLinksCsv([
      row({ classNames: ['3C', '3D'] }),
      row({ email: 'skip@x.test', outcome: 'skipped_exists', inviteLink: null }),
      row({ email: 'dev@x.test', inviteLink: null }),
    ])
    expect(text).toBe('email,name,role,classes,sign_in_link\r\na@x.test,A,student,3C;3D,https://tenant.test/a\r\n')
  })

  it('quotes commas and quotes, and defuses spreadsheet formulas', () => {
    const text = signInLinksCsv([row({ name: 'Tan, "Ben"' }), row({ name: '=HYPERLINK("x")' })])
    const [, first, second] = text.split('\r\n')
    expect(first).toBe('a@x.test,"Tan, ""Ben""",student,,https://tenant.test/a')
    expect(second).toBe('a@x.test,"\'=HYPERLINK(""x"")",student,,https://tenant.test/a')
  })
})
