import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from './client'

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  it('sends the token as a bearer header and a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { id: 'p1' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await apiFetch<{ id: string }>(async () => 'dev|teacher', '/projects', { method: 'POST', body: { name: 'x' } }, 'http://api')
    expect(result).toEqual({ id: 'p1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/projects')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer dev|teacher')
    expect(init.body).toBe('{"name":"x"}')
  })

  it('sends no Authorization header when signed out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, []))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch(async () => null, '/projects', {}, 'http://api')
    expect((fetchMock.mock.calls[0][1].headers as Headers).has('Authorization')).toBe(false)
  })

  it('turns a failed reply into an ApiError with the status and detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(404, { detail: 'Project not found' })))
    await expect(apiFetch(async () => 't', '/projects/x', {}, 'http://api')).rejects.toMatchObject({
      status: 404,
      message: 'Project not found',
    })
  })

  it('keeps the status when the failure is not JSON, e.g. a proxy error page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(apiFetch(async () => 't', '/me', {}, 'http://api')).rejects.toBeInstanceOf(ApiError)
  })

  it('returns undefined for an empty success reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(204)))
    expect(await apiFetch(async () => 't', '/projects/x', { method: 'DELETE' }, 'http://api')).toBeUndefined()
  })

  it('refuses to run with no API address', async () => {
    await expect(apiFetch(async () => 't', '/me', {}, undefined)).rejects.toThrow('VITE_API_URL')
  })
})
