import { describe, expect, it } from 'vitest'
import { AudioSystem } from './AudioSystem'
import { FakeAudioBackend } from './backend/FakeAudioBackend'
import type { AudioResolver } from './AudioResolver'
import { AudioAssetLibrary } from './AudioAssetLibrary'

const resolverFor = (urls: Record<string, string>): AudioResolver => ({
  async resolve(assetId) {
    const url = urls[assetId]
    return url ? { kind: 'url', url } : null
  },
})

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('AudioSystem', () => {
  it('queues a play before unlock and starts it on unlock()', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ sfx1: 'sfx1.mp3' }) })

    const voice = audio.play({ assetId: 'sfx1' })
    expect(voice.status).toBe('loading')
    await flush()
    expect(voice.status).toBe('loading')
    expect(backend.decodeCalls).toEqual([])

    await audio.unlock()
    await flush()
    expect(voice.status).toBe('playing')
    expect(backend.decodeCalls).toEqual(['sfx1.mp3'])
  })

  it('starts immediately when already unlocked', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ sfx1: 'sfx1.mp3' }) })
    await audio.unlock()

    const voice = audio.play({ assetId: 'sfx1' })
    await flush()
    expect(voice.status).toBe('playing')
  })

  it('applies resolution order: per-play override beats meta beats built-in default', async () => {
    const backend = new FakeAudioBackend()
    const assets = new AudioAssetLibrary([{ assetId: 'music', name: 'Music', channel: 'bgm', volume: 0.5, loop: true }])
    const audio = new AudioSystem({ backend, resolver: resolverFor({ music: 'music.mp3' }), assets })
    await audio.unlock()

    const voice = audio.play({ assetId: 'music' })
    await flush()
    const state = voice.toState()
    expect(state.channel).toBe('bgm')
    expect(state.volume).toBe(0.5)
    expect(state.loop).toBe(true)

    const overridden = audio.play({ assetId: 'music', channel: 'sfx', volume: 0.2, loop: false })
    await flush()
    const overriddenState = overridden.toState()
    expect(overriddenState.channel).toBe('sfx')
    expect(overriddenState.volume).toBe(0.2)
    expect(overriddenState.loop).toBe(false)
  })

  it('falls back to built-in defaults when there is no meta and no override', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ beep: 'beep.mp3' }) })
    await audio.unlock()

    const voice = audio.play({ assetId: 'beep' })
    await flush()
    const state = voice.toState()
    expect(state.channel).toBe('sfx')
    expect(state.volume).toBe(1)
    expect(state.loop).toBe(false)
  })

  it('transport: pause, resume, stop', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ a: 'a.mp3' }) })
    await audio.unlock()
    const voice = audio.play({ assetId: 'a' })
    await flush()
    expect(voice.status).toBe('playing')

    audio.pause({ voiceId: voice.id })
    expect(voice.status).toBe('paused')

    audio.resume({ voiceId: voice.id })
    expect(voice.status).toBe('playing')

    audio.stop({ voiceId: voice.id })
    expect(voice.status).toBe('stopped')
    expect(audio.store.getVoice(voice.id)).toBeUndefined()
  })

  it('marks a voice ended when the fake clock crosses the buffer duration', async () => {
    const backend = new FakeAudioBackend({ defaultDurationSeconds: 2 })
    const audio = new AudioSystem({ backend, resolver: resolverFor({ a: 'a.mp3' }) })
    await audio.unlock()
    const voice = audio.play({ assetId: 'a' })
    await flush()

    backend.advanceAll(1)
    expect(voice.status).toBe('playing')
    backend.advanceAll(1.5)
    expect(voice.status).toBe('ended')
  })

  it('decodes buffer-kind resolutions via decodeBytes instead of fetching a URL', async () => {
    const backend = new FakeAudioBackend()
    const bytes = new ArrayBuffer(8)
    const resolver: AudioResolver = { async resolve() { return { kind: 'buffer', data: bytes } } }
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()

    const voice = audio.play({ assetId: 'cached-clip' })
    await flush()
    expect(voice.status).toBe('playing')
    expect(backend.decodeCalls).toEqual([])
    expect(backend.decodeBytesCallCount).toBe(1)
  })

  it('surfaces a decodeBytes failure as a voice in error, never throwing', async () => {
    const backend = new FakeAudioBackend({ failDecodeBytes: true })
    const resolver: AudioResolver = { async resolve() { return { kind: 'buffer', data: new ArrayBuffer(8) } } }
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()

    const voice = audio.play({ assetId: 'cached-clip' })
    await flush()
    expect(voice.status).toBe('error')
  })

  it('reports a failed resolve as a voice in error, never throwing', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({}) })
    await audio.unlock()
    const voice = audio.play({ assetId: 'missing' })
    await flush()
    expect(voice.status).toBe('error')
    expect(voice.errorMessage).toBeDefined()
  })

  it('master and channel volume are independent and both apply', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({}) })
    audio.setMaster(0.5)
    audio.setChannelVolume('bgm', 0.25)
    const snapshot = audio.store.getSnapshot()
    expect(snapshot.master.volume).toBe(0.5)
    expect(snapshot.channels.find((c) => c.id === 'bgm')?.volume).toBe(0.25)
  })

  it('stopAll clears every voice and the unlock queue', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ a: 'a.mp3' }) })
    audio.play({ assetId: 'a' }) // queued, never unlocked
    await audio.unlock().then(() => {}) // unlock flushes the queue and starts it
    const second = audio.play({ assetId: 'a' })
    await flush()

    audio.stopAll()
    const snapshot = audio.store.getSnapshot()
    expect(snapshot.voices).toHaveLength(0)
    expect(second.status).toBe('stopped')
  })

  it('selecting by channel stops every voice on that channel', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver: resolverFor({ a: 'a.mp3', b: 'b.mp3' }) })
    await audio.unlock()
    const v1 = audio.play({ assetId: 'a', channel: 'sfx' })
    const v2 = audio.play({ assetId: 'b', channel: 'sfx' })
    await flush()

    audio.stop({ channel: 'sfx' })
    expect(v1.status).toBe('stopped')
    expect(v2.status).toBe('stopped')
  })

  it('reaps a voice that ends on its own from the store', async () => {
    const backend = new FakeAudioBackend({ defaultDurationSeconds: 2 })
    const audio = new AudioSystem({ backend, resolver: resolverFor({ a: 'a.mp3' }) })
    await audio.unlock()
    const voice = audio.play({ assetId: 'a' })
    await flush()

    backend.advanceAll(3)
    expect(voice.status).toBe('ended')
    expect(audio.store.getVoice(voice.id)).toBeUndefined()
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('evicts least-recently-used decoded buffers once over the cap, skipping in-use assets', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({
      backend,
      resolver: resolverFor({ a: 'a.mp3', b: 'b.mp3', c: 'c.mp3' }),
      maxCachedBuffers: 2,
    })
    await audio.unlock()

    const a = audio.play({ assetId: 'a' })
    await flush()
    audio.stop({ voiceId: a.id }) // 'a' has no live voice anymore, so it's evictable
    audio.play({ assetId: 'b' })
    await flush()

    // Cache is now [a, b] (2, at cap). Playing 'c' should evict 'a' (LRU, unused) not 'b' (in use).
    audio.play({ assetId: 'c' })
    await flush()
    expect(backend.decodeCalls).toEqual(['a.mp3', 'b.mp3', 'c.mp3'])

    // Replaying 'a' must decode again since its buffer was evicted.
    audio.play({ assetId: 'a' })
    await flush()
    expect(backend.decodeCalls).toEqual(['a.mp3', 'b.mp3', 'c.mp3', 'a.mp3'])
  })

  it('does not evict a buffer while a live voice still plays it', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({
      backend,
      resolver: resolverFor({ a: 'a.mp3', b: 'b.mp3', c: 'c.mp3' }),
      maxCachedBuffers: 1,
    })
    await audio.unlock()

    audio.play({ assetId: 'a' }) // stays playing; must survive every later eviction pass
    await flush()
    audio.play({ assetId: 'b' })
    await flush()
    audio.play({ assetId: 'c' })
    await flush()

    // 'a' is still in use, so re-playing it must not re-decode even though the cap is 1.
    audio.play({ assetId: 'a' })
    await flush()
    expect(backend.decodeCalls).toEqual(['a.mp3', 'b.mp3', 'c.mp3'])
  })
})
