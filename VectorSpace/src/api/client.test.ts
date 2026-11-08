import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError, apiFetch, describeError } from './client'

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  it('sends the token as a bearer header and a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { id: 'p1' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await apiFetch<{ id: string }>(async () => 'dev|teacher', '/projects', { method: 'POST', body: { name: 'x' } }, 'http://api')
    expect(result).toEqual({ id: 'p1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/api/v1/projects')
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
    // '' rather than undefined: an undefined argument takes the default (apiUrl), which is set
    // whenever VITE_API_URL is (e.g. in .env.local), and the test would then call that server
    await expect(apiFetch(async () => 't', '/me', {}, '')).rejects.toThrow('VITE_API_URL')
  })
})

const envelope = { code: 'invalid_request', apiVersion: 'v1', source: 'vectorspace-api', timestamp: '2026-11-08T00:00:00+00:00', requestId: 'req-1' }

describe('the API error shape', () => {
  it('carries the code, request id and fields the server sent', async () => {
    const fields = [{ field: 'name', message: 'must be at most 200 characters' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(422, { ...envelope, detail: 'Name must be at most 200 characters', fields })))
    const error = await apiFetch(async () => 't', '/projects', {}, 'http://api').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'invalid_request', requestId: 'req-1', fields })
    expect(describeError(error)).toBe('Name must be at most 200 characters')
  })

  it('still hands the editor a save conflict as an object', async () => {
    const detail = { message: 'Saved elsewhere since you loaded it', current_revision: 3 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(409, { ...envelope, code: 'conflict', detail })))
    const error = await apiFetch(async () => 't', '/projects/x/versions', {}, 'http://api').catch((e) => e)
    expect((error as ApiError).detail).toEqual(detail)
    expect(describeError(error)).toBe('Saved elsewhere since you loaded it')
  })

  it('says the network is down, as a NetworkError that is not an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await apiFetch(async () => 't', '/me', {}, 'http://api').catch((e) => e)
    expect(error).toBeInstanceOf(NetworkError)
    expect(error).not.toBeInstanceOf(ApiError) // callers that retry on "not an ApiError" keep working
    expect(describeError(error)).toMatch(/internet connection/i)
  })

  it('gives a plain sentence when a proxy answers with a page instead of JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })))
    const error = await apiFetch(async () => 't', '/me', {}, 'http://api').catch((e) => e)
    expect(describeError(error)).toMatch(/not responding/i)
  })

  it('has a sentence for each status that arrives with no detail', () => {
    expect(describeError(new ApiError(401, undefined))).toMatch(/sign in/i)
    expect(describeError(new ApiError(403, undefined))).toMatch(/not allowed/i)
    expect(describeError(new ApiError(404, undefined))).toMatch(/not found/i)
    expect(describeError(new ApiError(413, undefined))).toMatch(/too large/i)
    expect(describeError(new ApiError(429, undefined))).toMatch(/too many/i)
    expect(describeError(new ApiError(500, undefined))).toMatch(/our side/i)
  })

  it('quotes the request id on a server fault, so a person can report it', () => {
    const error = new ApiError(500, 'Something went wrong on our side.', { code: 'server_error', requestId: 'req-9' })
    expect(describeError(error)).toContain('req-9')
  })

  it('describes an unknown thrown value without leaking an object dump', () => {
    expect(describeError('boom')).toBe('boom')
    expect(describeError(new Error('plain'))).toBe('plain')
    expect(describeError({})).toMatch(/something went wrong/i)
  })
})

