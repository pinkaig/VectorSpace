import { describe, expect, it, vi } from 'vitest'
import { createActionRegistry, createEffectRegistry, createRuntimeState } from '@vectorspace/interaction'
import type { ActionContext } from '@vectorspace/interaction'
import { AudioSystem } from '../AudioSystem'
import { FakeAudioBackend } from '../backend/FakeAudioBackend'
import { registerAudioActions } from './registerAudioActions'
import type { AudioResolver } from '../AudioResolver'

const resolver: AudioResolver = { async resolve(assetId) { return { kind: 'url', url: `${assetId}.mp3` } } }

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

  describe('cooldown and fades', () => {
    const setupWithClock = () => {
      const backend = new FakeAudioBackend()
      const audio = new AudioSystem({ backend, resolver })
      const registry = createActionRegistry()
      let clock = 1000
      registerAudioActions(registry, audio, { now: () => clock })
      const effects = createEffectRegistry()
      const ctx: ActionContext = { state: createRuntimeState('scene-1'), effects }
      return { audio, registry, ctx, advance: (ms: number) => { clock += ms } }
    }

    it('drops a repeat playAudio inside cooldownMs, then allows it after', async () => {
      const { audio, registry, ctx, advance } = setupWithClock()
      await audio.unlock()
      const action = { kind: 'playAudio', params: { assetId: 'sfx1', cooldownMs: 400 } }

      await registry.execute(action, ctx)
      advance(399)
      await registry.execute(action, ctx)
      expect(audio.store.getSnapshot().voices).toHaveLength(1)

      advance(1)
      await registry.execute(action, ctx)
      expect(audio.store.getSnapshot().voices).toHaveLength(2)
    })

    it('tracks cooldown per asset', async () => {
      const { audio, registry, ctx } = setupWithClock()
      await audio.unlock()
      await registry.execute({ kind: 'playAudio', params: { assetId: 'a', cooldownMs: 400 } }, ctx)
      await registry.execute({ kind: 'playAudio', params: { assetId: 'b', cooldownMs: 400 } }, ctx)
      expect(audio.store.getSnapshot().voices).toHaveLength(2)
    })

    it('has no cooldown unless cooldownMs is given', async () => {
      const { audio, registry, ctx } = setupWithClock()
      await audio.unlock()
      const action = { kind: 'playAudio', params: { assetId: 'sfx1' } }
      await registry.execute(action, ctx)
      await registry.execute(action, ctx)
      expect(audio.store.getSnapshot().voices).toHaveLength(2)
    })

    it('stopAudio with fadeOut keeps the voice until the fade ends', async () => {
      vi.useFakeTimers()
      try {
        const { audio, registry, ctx } = setupWithClock()
        await audio.unlock()
        await registry.execute({ kind: 'playAudio', params: { assetId: 'bed' } }, ctx)
        // Decode takes several microtask turns; a voice still loading is stopped at once, not faded.
        for (let i = 0; i < 5; i++) await Promise.resolve()
        await registry.execute({ kind: 'stopAudio', params: { assetId: 'bed', fadeOut: 1.5 } }, ctx)
        expect(audio.store.getSnapshot().voices).toHaveLength(1)
        vi.advanceTimersByTime(1500)
        expect(audio.store.getSnapshot().voices).toHaveLength(0)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
