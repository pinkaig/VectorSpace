import { describe, expect, it } from 'vitest'
import { isPlaceholderDescriptor, PlaceholderAssetResolver } from './PlaceholderAssetResolver'
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

const ref: AssetRef = { assetId: 'missing', kind: 'cube' }

class ThrowingResolver implements AssetResolver {
  async resolve(): Promise<AssetDescriptor> {
    throw new Error('network down')
  }
}

class ErrorDescriptorResolver implements AssetResolver {
  async resolve(r: AssetRef): Promise<AssetDescriptor> {
    return errorAssetDescriptor(r, 'not found')
  }
}

class ReadyResolver implements AssetResolver {
  async resolve(r: AssetRef): Promise<AssetDescriptor> {
    return readyAssetDescriptor(r, { contentType: 'x' })
  }
}

describe('PlaceholderAssetResolver', () => {
  it('never lets a delegate rejection escape — turns it into a visible placeholder descriptor', async () => {
    const resolver = new PlaceholderAssetResolver(new ThrowingResolver())
    const descriptor = await resolver.resolve(ref)
    expect(descriptor.status).toBe('error')
    expect(isPlaceholderDescriptor(descriptor)).toBe(true)
    expect(descriptor.errorMessage).toContain('network down')
  })

  it('marks a delegate error descriptor as a placeholder', async () => {
    const resolver = new PlaceholderAssetResolver(new ErrorDescriptorResolver())
    const descriptor = await resolver.resolve(ref)
    expect(isPlaceholderDescriptor(descriptor)).toBe(true)
  })

  it('passes ready descriptors through unchanged, no silent blank and no false placeholder flag', async () => {
    const resolver = new PlaceholderAssetResolver(new ReadyResolver())
    const descriptor = await resolver.resolve(ref)
    expect(descriptor.status).toBe('ready')
    expect(isPlaceholderDescriptor(descriptor)).toBe(false)
  })

  it('retry() re-invokes resolution', async () => {
    let attempts = 0
    const resolver = new PlaceholderAssetResolver({
      async resolve(r) {
        attempts += 1
        return attempts === 1 ? errorAssetDescriptor(r, 'first try fails') : readyAssetDescriptor(r, { contentType: 'x' })
      },
    })
    const first = await resolver.resolve(ref)
    expect(isPlaceholderDescriptor(first)).toBe(true)
    const second = await resolver.retry(ref)
    expect(second.status).toBe('ready')
  })
})
