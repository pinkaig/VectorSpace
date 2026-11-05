import { describe, expect, it } from 'vitest'
import { AssetCache } from './AssetCache'
import { CachingAssetResolver } from './CachingAssetResolver'
import { readyAssetDescriptor, type AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

const ref: AssetRef = { assetId: 'a1', kind: 'cube' }

class CountingResolver implements AssetResolver {
  calls = 0
  constructor(private readonly descriptor: AssetDescriptor) {}
  async resolve(): Promise<AssetDescriptor> {
    this.calls += 1
    return this.descriptor
  }
}

describe('CachingAssetResolver', () => {
  it('only calls the delegate once for repeated resolves of a ready asset', async () => {
    const delegate = new CountingResolver(readyAssetDescriptor(ref, { contentType: 'x' }))
    const resolver = new CachingAssetResolver(delegate)

    await resolver.resolve(ref)
    await resolver.resolve(ref)

    expect(delegate.calls).toBe(1)
  })

  it('re-invokes the delegate after invalidate()', async () => {
    const delegate = new CountingResolver(readyAssetDescriptor(ref, { contentType: 'x' }))
    const resolver = new CachingAssetResolver(delegate)

    await resolver.resolve(ref)
    resolver.invalidate(ref)
    await resolver.resolve(ref)

    expect(delegate.calls).toBe(2)
  })

  it('re-invokes the delegate once a TTL-bound entry expires', async () => {
    let now = 0
    const cache = new AssetCache(() => now)
    const delegate = new CountingResolver(readyAssetDescriptor(ref, { contentType: 'x', expiresAt: 100 }))
    const resolver = new CachingAssetResolver(delegate, cache)

    await resolver.resolve(ref)
    now = 200
    await resolver.resolve(ref)

    expect(delegate.calls).toBe(2)
  })

  it('shares one in-flight delegate call between concurrent resolves of the same asset', async () => {
    let release: (descriptor: AssetDescriptor) => void = () => {}
    let calls = 0
    const delegate: AssetResolver = {
      resolve: () => {
        calls += 1
        return new Promise<AssetDescriptor>((resolve) => { release = resolve })
      },
    }
    const resolver = new CachingAssetResolver(delegate)

    const first = resolver.resolve(ref)
    const second = resolver.resolve(ref)
    release(readyAssetDescriptor(ref, { contentType: 'x' }))

    expect(await first).toEqual(await second)
    expect(calls).toBe(1)
    // after settling, the in-flight entry is gone and the cache serves repeats
    await resolver.resolve(ref)
    expect(calls).toBe(1)
  })
})
