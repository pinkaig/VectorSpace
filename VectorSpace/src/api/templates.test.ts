import { afterEach, describe, expect, it, vi } from 'vitest'
import { listTemplates } from './templates'

afterEach(() => vi.unstubAllGlobals())

describe('listTemplates', () => {
  it('asks for kind=template and returns the rows', async () => {
    const rows = [{ id: 't1', name: 'Blank stage', status: 'published' }]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listTemplates(async () => 'dev|teacher', {}, 'http://api')).toEqual(rows)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/projects?kind=template')
  })

  it('adds only the filters that were given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await listTemplates(async () => 't', { status: 'published', q: 'rock band' }, 'http://api')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/projects?kind=template&status=published&q=rock+band')
  })
})
