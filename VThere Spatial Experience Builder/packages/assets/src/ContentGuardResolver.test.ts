import { describe, expect, it } from 'vitest'
import { ContentGuardResolver } from './ContentGuardResolver'
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

const fixed = (descriptor: AssetDescriptor): AssetResolver => ({ resolve: async () => descriptor })
const audioRef: AssetRef = { assetId: 'song-1', kind: 'audio' }

describe('ContentGuardResolver', () => {
  it('passes an allowed media descriptor through unchanged', async () => {
    const descriptor = readyAssetDescriptor(audioRef, { contentType: 'audio/ogg', url: '/song.ogg', sizeBytes: 1_000 })
    expect(await new ContentGuardResolver(fixed(descriptor)).resolve(audioRef)).toEqual(descriptor)
  })

  it('turns a disallowed content type into an error descriptor, never trusting the extension', async () => {
    const descriptor = readyAssetDescriptor(audioRef, { contentType: 'application/javascript', url: '/song.ogg' })
    const guarded = await new ContentGuardResolver(fixed(descriptor)).resolve(audioRef)
    expect(guarded.status).toBe('error')
    expect(guarded.errorMessage).toMatch(/not allowed/)
  })

  it('rejects a descriptor whose known size is over the kind cap', async () => {
    const descriptor = readyAssetDescriptor(audioRef, { contentType: 'audio/ogg', url: '/song.ogg', sizeBytes: 20_000_001 })
    const guarded = await new ContentGuardResolver(fixed(descriptor)).resolve(audioRef)
    expect(guarded.status).toBe('error')
    expect(guarded.errorMessage).toMatch(/limit/)
  })

  it('leaves non-media kinds and non-ready descriptors untouched', async () => {
    const modelRef: AssetRef = { assetId: 'lamp-01', kind: 'model' }
    const model = readyAssetDescriptor(modelRef, { contentType: 'model/gltf-binary', url: '/lamp.glb' })
    expect(await new ContentGuardResolver(fixed(model)).resolve(modelRef)).toEqual(model)

    const failed = errorAssetDescriptor(audioRef, 'origin failed')
    expect(await new ContentGuardResolver(fixed(failed)).resolve(audioRef)).toEqual(failed)
  })
})
