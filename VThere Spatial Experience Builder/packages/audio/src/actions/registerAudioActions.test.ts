import { describe, expect, it } from 'vitest'
import { createActionRegistry, createEffectRegistry, createRuntimeState } from '@vthere/interaction'
import type { ActionContext } from '@vthere/interaction'
import { AudioSystem } from '../AudioSystem'
import { FakeAudioBackend } from '../backend/FakeAudioBackend'
import { registerAudioActions } from './registerAudioActions'
import type { AudioResolver } from '../AudioResolver'

const resolver: AudioResolver = { async resolve(assetId) { return { url: `${assetId}.mp3` } } }

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const setup = () => {
  const backend = new FakeAudioBackend()
  const audio = new AudioSystem({ backend, resolver })
  const registry = createActionRegistry()
  registerAudioActions(registry, audio)
  const effects = createEffectRegistry()
  const ctx: ActionContext = { state: createRuntimeState('scene-1'), effects }
  return { audio, registry, ctx, effects }
}

describe('registerAudioActions', () => {
  it('playAudio starts a voice and registers a disposer that stops it', async () => {
    const { audio, registry, ctx, effects } = setup()
    await audio.unlock()
    await registry.execute({ kind: 'playAudio', params: { assetId: 'sfx1' } }, ctx)
    await flush()
    expect(audio.store.getSnapshot().voices).toHaveLength(1)
    expect(effects.size).toBe(1)

    effects.disposeAll()
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('playAudio warns and no-ops without a string assetId', async () => {
    const { registry, ctx, effects } = setup()
    await registry.execute({ kind: 'playAudio', params: {} }, ctx)
    expect(effects.size).toBe(0)
  })

  it('stopAudio stops by channel', async () => {
    const { audio, registry, ctx } = setup()
    await audio.unlock()
    await registry.execute({ kind: 'playAudio', params: { assetId: 'a', channel: 'sfx' } }, ctx)
    await flush()
    await registry.execute({ kind: 'stopAudio', params: { channel: 'sfx' } }, ctx)
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('pauseAudio and resumeAudio transport by assetId', async () => {
    const { audio, registry, ctx } = setup()
    await audio.unlock()
    await registry.execute({ kind: 'playAudio', params: { assetId: 'a' } }, ctx)
    await flush()

    await registry.execute({ kind: 'pauseAudio', params: { assetId: 'a' } }, ctx)
    expect(audio.store.getSnapshot().voices[0].status).toBe('paused')

    await registry.execute({ kind: 'resumeAudio', params: { assetId: 'a' } }, ctx)
    expect(audio.store.getSnapshot().voices[0].status).toBe('playing')
  })

  it('setChannelVolume and setMasterVolume ramp the mix', async () => {
    const { audio, registry, ctx } = setup()
    await registry.execute({ kind: 'setChannelVolume', params: { channel: 'bgm', volume: 0.3 } }, ctx)
    await registry.execute({ kind: 'setMasterVolume', params: { volume: 0.6 } }, ctx)
    const snapshot = audio.store.getSnapshot()
    expect(snapshot.channels.find((c) => c.id === 'bgm')?.volume).toBe(0.3)
    expect(snapshot.master.volume).toBe(0.6)
  })
})
