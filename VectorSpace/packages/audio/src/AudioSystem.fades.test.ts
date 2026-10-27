import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioSystem } from './AudioSystem'
import { FakeAudioBackend } from './backend/FakeAudioBackend'
import type { BackendGain } from './backend/AudioBackend'
import type { AudioResolver } from './AudioResolver'

type RecordingGain = BackendGain & { lastRamp: { value: number; durationSeconds: number } | null }

/** Keeps every gain the system creates, so a test can look at a voice's fade. */
class RecordingBackend extends FakeAudioBackend {
  readonly gains: RecordingGain[] = []
  createGain(): BackendGain {
    const gain = super.createGain() as RecordingGain
    this.gains.push(gain)
    return gain
  }
}

const resolver: AudioResolver = { async resolve(assetId) { return { kind: 'url', url: `${assetId}.mp3` } } }
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('AudioSystem fades', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fades a voice in from silence once its buffer is attached', async () => {
    const backend = new RecordingBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()
    const before = backend.gains.length

    const voice = audio.play({ assetId: 'bed', volume: 0.6, fadeIn: 1.5 })
    const voiceGain = backend.gains[before]
    expect(voiceGain.getValue()).toBe(0)
    await flush()

    expect(voice.status).toBe('playing')
    expect(voiceGain.lastRamp).toEqual({ value: 0.6, durationSeconds: 1.5 })
  })

  it('does not fade a voice that asked for no fade', async () => {
    const backend = new RecordingBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()
    const before = backend.gains.length
    audio.play({ assetId: 'sfx', volume: 0.6 })
    await flush()
    expect(backend.gains[before].lastRamp).toBeNull()
    expect(backend.gains[before].getValue()).toBe(0.6)
  })

  it('fades out, keeps the voice until the fade ends, then removes it', async () => {
    const backend = new RecordingBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()
    const before = backend.gains.length
    const voice = audio.play({ assetId: 'bed' })
    await flush()

    audio.stop({ assetId: 'bed' }, { fadeOutSeconds: 2 })
    expect(backend.gains[before].lastRamp).toEqual({ value: 0, durationSeconds: 2 })
    expect(voice.status).toBe('playing')
    expect(audio.store.getSnapshot().voices).toHaveLength(1)

    vi.advanceTimersByTime(1999)
    expect(voice.status).toBe('playing')
    vi.advanceTimersByTime(1)
    expect(voice.status).toBe('stopped')
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('a second fading stop does not restart the fade', async () => {
    const backend = new RecordingBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()
    const before = backend.gains.length
    audio.play({ assetId: 'bed' })
    await flush()

    audio.stop({ assetId: 'bed' }, { fadeOutSeconds: 2 })
    vi.advanceTimersByTime(1000)
    audio.stop({ assetId: 'bed' }, { fadeOutSeconds: 2 })
    expect(backend.gains[before].lastRamp).toEqual({ value: 0, durationSeconds: 2 })
    vi.advanceTimersByTime(1000)
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('an immediate stop cuts a fading voice short', async () => {
    const audio = new AudioSystem({ backend: new RecordingBackend(), resolver })
    await audio.unlock()
    const voice = audio.play({ assetId: 'bed' })
    await flush()

    audio.stop({ assetId: 'bed' }, { fadeOutSeconds: 5 })
    audio.stop({ voiceId: voice.id })
    expect(voice.status).toBe('stopped')
    vi.advanceTimersByTime(5000)
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('stops a voice that is still loading at once, fade or not', async () => {
    const audio = new AudioSystem({ backend: new RecordingBackend(), resolver })
    await audio.unlock()
    const voice = audio.play({ assetId: 'bed' })
    audio.stop({ voiceId: voice.id }, { fadeOutSeconds: 2 })
    expect(voice.status).toBe('stopped')
  })

  it('stopAll cancels pending fade timers', async () => {
    const audio = new AudioSystem({ backend: new RecordingBackend(), resolver })
    await audio.unlock()
    audio.play({ assetId: 'bed' })
    await flush()
    audio.stop({ assetId: 'bed' }, { fadeOutSeconds: 2 })
    audio.stopAll()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('AudioSystem.setHidden', () => {
  it('suspends the context when hidden and resumes it when shown', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.unlock()
    expect(backend.state).toBe('running')

    await audio.setHidden(true)
    expect(backend.state).toBe('suspended')
    expect(audio.store.getSnapshot().contextState).toBe('suspended')

    await audio.setHidden(false)
    expect(backend.state).toBe('running')
  })

  it('does nothing before the first unlock, so it cannot start audio by itself', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.setHidden(false)
    expect(backend.state).toBe('suspended')
    expect(audio.isUnlocked).toBe(false)
  })

  it('keeps the context suspended when unlock resolves while the tab is hidden', async () => {
    const backend = new FakeAudioBackend()
    const audio = new AudioSystem({ backend, resolver })
    await audio.setHidden(true)
    await audio.unlock()
    expect(backend.state).toBe('suspended')
    await audio.setHidden(false)
    expect(backend.state).toBe('running')
  })
})
