import { describe, expect, it } from 'vitest'
import { AssetCache } from './AssetCache'
import { errorAssetDescriptor, readyAssetDescriptor } from './AssetDescriptor'

const ref = { assetId: 'a1', kind: 'cube' as const }

describe('AssetCache', () => {
  it('stores and returns a ready descriptor', () => {
    const cache = new AssetCache()
    const descriptor = readyAssetDescriptor(ref, { contentType: 'model/primitive+cube' })
    cache.set(ref, descriptor)
    expect(cache.get(ref)).toBe(descriptor)
  })

  it('does not cache error descriptors', () => {
    const cache = new AssetCache()
    cache.set(ref, errorAssetDescriptor(ref, 'boom'))
    expect(cache.get(ref)).toBeUndefined()
  })

  it('evicts an entry once its expiresAt passes', () => {
    let now = 1_000
    const cache = new AssetCache(() => now)
    cache.set(ref, readyAssetDescriptor(ref, { contentType: 'x', expiresAt: 1_500 }))
    expect(cache.get(ref)).toBeDefined()
    now = 1_600
    expect(cache.get(ref)).toBeUndefined()
  })

  it('keeps an entry with no expiresAt indefinitely', () => {
    let now = 1_000
    const cache = new AssetCache(() => now)
    cache.set(ref, readyAssetDescriptor(ref, { contentType: 'x' }))
    now = 1_000_000
    expect(cache.get(ref)).toBeDefined()
  })

  it('invalidate() forces the next get() to miss', () => {
    const cache = new AssetCache()
    cache.set(ref, readyAssetDescriptor(ref, { contentType: 'x' }))
    cache.invalidate(ref)
    expect(cache.get(ref)).toBeUndefined()
  })

  it('keys by both assetId and kind so different kinds do not collide', () => {
    const cache = new AssetCache()
    cache.set({ assetId: 'a1', kind: 'cube' }, readyAssetDescriptor({ assetId: 'a1', kind: 'cube' }, { contentType: 'cube' }))
    expect(cache.get({ assetId: 'a1', kind: 'sphere' })).toBeUndefined()
  })
})

describe('AssetCache.list', () => {
  it('lists live entries and drops expired ones on the way out', () => {
    let now = 1_000
    const cache = new AssetCache(() => now)
    const keep = { assetId: 'keep', kind: 'cube' as const }
    const expire = { assetId: 'expire', kind: 'cube' as const }
    cache.set(keep, readyAssetDescriptor(keep, { contentType: 'x' }))
    cache.set(expire, readyAssetDescriptor(expire, { contentType: 'x', expiresAt: 1_500 }))
    expect(cache.list()).toHaveLength(2)

    now = 1_600

    expect(cache.list().map((entry) => entry.ref.assetId)).toEqual(['keep'])
  })
})
