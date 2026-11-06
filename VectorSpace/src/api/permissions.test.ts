import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMyPermissions, may } from './permissions'

afterEach(() => vi.unstubAllGlobals())

describe('my permissions', () => {
  it('asks the API for the caller\'s own settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ 'from-templates': false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const mine = await getMyPermissions(async () => 'token', 'http://api')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/permissions/mine')
    expect(may(mine, 'from-templates')).toBe(false)
  })

  it('hides only what the API said no to', () => {
    expect(may({ 'from-templates': true }, 'from-templates')).toBe(true)
    expect(may({}, 'from-templates')).toBe(true)
  })
})
