import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLibraryApi, kindForFile, sha256Hex, slugify, titleFromFilename } from './library'

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1', content_sha256: 'f'.repeat(64), kind: 'model', content_type: 'model/gltf-binary', size_bytes: 3,
  filename: 'Mammoth.glb', title: 'Mammoth', attribution: null, status: 'uploaded', url: 'https://cdn/x', created_at: '2026-11-06T00:00:00Z',
  ...overrides,
})

describe('library helpers', () => {
  it('hashes a file to 64 hex characters', async () => {
    // sha256("abc"), the standard test vector
    expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('takes .glb as a model or a room, and refuses .gltf', () => {
    expect(kindForFile('Mammoth.GLB')).toEqual({ kind: 'model', contentType: 'model/gltf-binary' })
    expect(kindForFile('hall.glb', true)?.kind).toBe('environment')
    expect(kindForFile('scene.gltf')).toBeNull()
    expect(kindForFile('photo.jpg')?.contentType).toBe('image/jpeg')
  })

  it('makes a title and a slug a person would expect', () => {
    expect(titleFromFilename('Dinosaur_Footprint.glb')).toBe('Dinosaur Footprint')
    expect(slugify('Ancient Egypt!')).toBe('ancient-egypt')
    expect(slugify('  ')).toBe('')
  })
})

describe('library upload', () => {
  it('hashes, gets a ticket, PUTs to the bucket with the signed headers, then confirms', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ asset: row({ status: 'pending', url: null }), upload_url: 'https://bucket/put', upload_headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'immutable' } }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(row()))
    vi.stubGlobal('fetch', fetchMock)
    const outcome = await createLibraryApi(async () => 'token', 'http://api').upload(new File(['abc'], 'Mammoth.glb'))

    expect(outcome.uploaded).toBe(true)
    expect(outcome.asset.url).toBe('https://cdn/x')
    const ticket = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(ticket).toMatchObject({ kind: 'model', content_type: 'model/gltf-binary', size_bytes: 3, title: 'Mammoth' })
    expect(ticket.content_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(fetchMock.mock.calls[1][0]).toBe('https://bucket/put')
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'immutable' })
    expect(fetchMock.mock.calls[2][0]).toBe('http://api/api/v1/library/a1/confirm')
  })

  it('sends nothing to the bucket for a file the library already holds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ asset: row(), upload_url: null, upload_headers: null }))
    vi.stubGlobal('fetch', fetchMock)
    const outcome = await createLibraryApi(async () => 'token', 'http://api').upload(new File(['abc'], 'Mammoth.glb'))
    expect(outcome.uploaded).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses a file type before calling anything', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createLibraryApi(async () => 't', 'http://api').upload(new File(['x'], 'scene.gltf'))).rejects.toThrow(/\.glb/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
