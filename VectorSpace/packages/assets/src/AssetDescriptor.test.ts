import { describe, expect, it } from 'vitest'
import { readyAssetDescriptor } from './AssetDescriptor'

const ref = { assetId: 'a1', kind: 'audio' as const }

describe('AssetDescriptor', () => {
  it('round-trips the fields the byte tier and the cloud work need', () => {
    const descriptor = readyAssetDescriptor(ref, {
      contentType: 'audio/mpeg',
      url: 'https://store.test/a.mp3',
      tier: 'cache',
      version: 'sha256-abc',
      scope: 'catalog',
      moderationState: 'approved',
    })

    expect(descriptor.status).toBe('ready')
    expect(descriptor.tier).toBe('cache')
    expect(descriptor.version).toBe('sha256-abc')
    expect(descriptor.scope).toBe('catalog')
    expect(descriptor.moderationState).toBe('approved')
  })

  it('leaves all four absent when not given, so nothing starts reading a default', () => {
    const descriptor = readyAssetDescriptor(ref, { contentType: 'audio/mpeg' })

    expect(descriptor.tier).toBeUndefined()
    expect(descriptor.version).toBeUndefined()
    expect(descriptor.scope).toBeUndefined()
    expect(descriptor.moderationState).toBeUndefined()
  })
})
