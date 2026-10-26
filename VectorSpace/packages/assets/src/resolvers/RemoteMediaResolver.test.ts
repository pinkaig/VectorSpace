import { describe, expect, it, vi } from 'vitest'
import { AssetCache } from '../AssetCache'
import { CachingAssetResolver } from '../CachingAssetResolver'
import { ContentGuardResolver } from '../ContentGuardResolver'
import type { AssetRef } from '../AssetRef'
import { RemoteMediaResolver } from './RemoteMediaResolver'

const imageRef: AssetRef = { assetId: 'media-1', kind: 'image' }
const videoRef: AssetRef = { assetId: 'media-2', kind: 'video' }

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const uploadedImage = (overrides: Record<string, unknown> = {}) => ({
  kind: 'image', source: 'file', status: 'uploaded', content_type: 'image/png', size_bytes: 2000,
  download_url: 'https://store.test/get/a.png?sig=1', download_expires_in: 900, ...overrides,
})

const build = (fetchImpl: typeof fetch, extra: { now?: () => number } = {}) =>
  new RemoteMediaResolver({ projectId: 'proj 1', baseUrl: 'https://api.test', getToken: async () => 'token-1', fetchImpl, ...extra })

describe('RemoteMediaResolver', () => {
  it('asks the API for the entry with the bearer token and returns the signed URL', async () => {
    const fetchImpl = reply(200, uploadedImage())
    const descriptor = await build(fetchImpl, { now: () => 1_000_000 }).resolve(imageRef)
    expect(descriptor).toMatchObject({ status: 'ready', url: 'https://store.test/get/a.png?sig=1', contentType: 'image/png', sizeBytes: 2000 })
    // expires a minute before the server's 900 s
    expect(descriptor.expiresAt).toBe(1_000_000 + 840_000)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/projects/proj%201/media/media-1')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-1')
  })

  it('turns an approved link into an embed descriptor with no URL', async () => {
    const descriptor = await build(reply(200, { kind: 'video', source: 'external', provider: 'youtube', provider_id: 'dQw4w9WgXcQ', approval: 'approved', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).resolve(videoRef)
    expect(descriptor).toMatchObject({ status: 'ready', embed: { provider: 'youtube', providerId: 'dQw4w9WgXcQ' } })
    expect(descriptor.url).toBeUndefined()
  })

  it('returns an error descriptor, never a throw, for every failure', async () => {
    const cases: Array<[typeof fetch, AssetRef, RegExp]> = [
      [reply(404, { detail: 'Media not found' }), imageRef, /not available/],
      [reply(500, {}), imageRef, /500/],
      [reply(200, uploadedImage({ status: 'pending' })), imageRef, /not finished uploading/],
      [reply(200, uploadedImage({ kind: 'video' })), imageRef, /Expected image/],
      [reply(200, { kind: 'video', source: 'external', provider: 'youtube', provider_id: 'dQw4w9WgXcQ', approval: 'pending' }), videoRef, /waiting for a teacher/],
      [vi.fn(async () => { throw new TypeError('Failed to fetch') }), imageRef, /Failed to fetch/],
    ]
    for (const [fetchImpl, ref, message] of cases) {
      const descriptor = await build(fetchImpl).resolve(ref)
      expect(descriptor.status).toBe('error')
      expect(descriptor.errorMessage).toMatch(message)
    }
  })

  it('does not call the network when offline or for a kind the library does not hold', async () => {
    const fetchImpl = reply(200, uploadedImage())
    expect((await new RemoteMediaResolver({ projectId: 'p', fetchImpl }).resolve(imageRef)).status).toBe('error')
    expect((await build(fetchImpl).resolve({ assetId: 'song', kind: 'audio' })).status).toBe('error')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('is asked again once its signed URL has expired in the cache', async () => {
    let now = 0
    const fetchImpl = reply(200, uploadedImage())
    const remote = build(fetchImpl, { now: () => now })
    const resolver = new CachingAssetResolver(new ContentGuardResolver(remote), new AssetCache(() => now))
    await resolver.resolve(imageRef)
    now = 839_000
    await resolver.resolve(imageRef)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    now = 840_000
    await resolver.resolve(imageRef)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('lets the content guard reject a file the server mislabels', async () => {
    const guarded = new ContentGuardResolver(build(reply(200, uploadedImage({ content_type: 'image/svg+xml' }))))
    expect((await guarded.resolve(imageRef)).status).toBe('error')
  })
})
