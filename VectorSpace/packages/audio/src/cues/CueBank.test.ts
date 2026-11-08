import { describe, expect, it, vi } from 'vitest'
import { AudioSystem } from '../AudioSystem'
import { FakeAudioBackend } from '../backend/FakeAudioBackend'
import { CueBank, validateCueMap, type CueMap } from './CueBank'

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

const baseMap = (): CueMap => ({
  sounds: {
    'click-a': { url: 'sfx/click-a.wav', channel: 'ui', volume: 0.8 },
    'click-b': { url: 'sfx/click-b.wav', channel: 'ui', volume: 0.5 },
    hum: { url: 'sfx/hum.wav', channel: 'bgm', volume: 0.4, loop: true },
  },
  cues: [
    { id: 'ui.click', label: 'Any button', group: 'Interface', tier: 1, sounds: ['click-a', 'click-b'], pick: 'cycle' },
    { id: 'ui.pop', label: 'Pop', group: 'Interface', tier: 2, sounds: ['click-a'], cooldownMs: 100 },
    { id: 'ui.quiet', label: 'Silent on purpose', group: 'Interface', tier: 3, sounds: [] },
    { id: 'world.bed', label: 'Room music', group: 'World', tier: 1, sounds: ['hum'] },
  ],
})

const setup = async (map: CueMap = baseMap(), options: ConstructorParameters<typeof CueBank>[1] = {}) => {
  const backend = new FakeAudioBackend()
  const bank = new CueBank(map, options)
  const system = new AudioSystem({ backend, resolver: bank })
  bank.bind(system)
  await system.unlock()
  return { backend, bank, system }
}

describe('CueBank', () => {
  it('plays a cue on the sound\'s channel at the sound\'s volume times the cue gain', async () => {
    const map = baseMap()
    map.cues[0].gain = 0.5
    const { bank } = await setup(map)

    const voice = bank.play('ui.click')
    await flush()

    expect(voice?.toState()).toMatchObject({ assetId: 'click-a', channel: 'ui', status: 'playing' })
    expect(voice?.toState().volume).toBeCloseTo(0.4)
  })

  it('drops a one-shot made before the first gesture but queues a loop, so nothing bursts out late', async () => {
    const backend = new FakeAudioBackend()
    const bank = new CueBank(baseMap())
    const system = new AudioSystem({ backend, resolver: bank })
    bank.bind(system)

    expect(bank.play('ui.pop')).toBeNull()
    const bed = bank.play('world.bed')
    expect(bed?.status).toBe('loading')

    await system.unlock()
    await flush()
    expect(bed?.status).toBe('playing')
    expect(backend.decodeCalls).toEqual(['sfx/hum.wav'])
  })

  it('cycles through variants in order and wraps', async () => {
    const { bank } = await setup()
    const played = [bank.play('ui.click'), bank.play('ui.click'), bank.play('ui.click')].map((voice) => voice?.assetId)
    expect(played).toEqual(['click-a', 'click-b', 'click-a'])
  })

  it('random never repeats the previous variant when there is a choice', async () => {
    const map = baseMap()
    map.cues[0].pick = 'random'
    // A source that always lands on index 0 would repeat click-a; the bank must step past it.
    const { bank } = await setup(map, { random: () => 0 })
    const played = [bank.play('ui.click'), bank.play('ui.click'), bank.play('ui.click')].map((voice) => voice?.assetId)
    expect(played).toEqual(['click-a', 'click-b', 'click-a'])
  })

  it('drops a retrigger inside the cooldown window and allows it after', async () => {
    let clock = 1000
    const { bank } = await setup(baseMap(), { now: () => clock })

    expect(bank.play('ui.pop')).not.toBeNull()
    clock += 50
    expect(bank.play('ui.pop')).toBeNull()
    clock += 60
    expect(bank.play('ui.pop')).not.toBeNull()
  })

  it('returns null for an unknown cue and for a cue that is silent on purpose, and still reports the silent one', async () => {
    const { bank } = await setup()
    const events: Array<string | null> = []
    bank.onPlay((event) => events.push(event.soundId))

    expect(bank.play('no.such.cue')).toBeNull()
    expect(bank.play('ui.quiet')).toBeNull()
    expect(events).toEqual([null])
  })

  it('applies rate jitter within the configured fraction', async () => {
    const map = baseMap()
    map.cues[1].rateJitter = 0.1
    const { bank } = await setup(map, { random: () => 1 })
    const voice = bank.play('ui.pop')
    expect(voice?.rate).toBeCloseTo(1.1)
  })

  it('assign re-points a cue and an empty list silences it', async () => {
    const { bank } = await setup()
    bank.assign('ui.pop', ['click-b'])
    expect(bank.play('ui.pop')?.assetId).toBe('click-b')
    bank.assign('ui.pop', [])
    expect(bank.play('ui.pop')).toBeNull()
  })

  it('options.gain scales volume and options.loop overrides the sound', async () => {
    const { bank } = await setup()
    const voice = bank.play('world.bed', { gain: 0.5, loop: false })
    expect(voice?.toState().volume).toBeCloseTo(0.2)
    expect(voice?.loop).toBe(false)
    expect(bank.play('world.bed')?.loop).toBe(true)
  })

  it('stopCue ends the loops it started', async () => {
    const { bank, system } = await setup()
    bank.play('world.bed')
    await flush()
    expect(system.store.getSnapshot().voices.filter((voice) => voice.status === 'playing')).toHaveLength(1)

    bank.stopCue('world.bed')
    expect(system.store.getSnapshot().voices).toHaveLength(0)
  })

  it('stopCue with a fade steps the volume down and stops the voice at the end', async () => {
    vi.useFakeTimers()
    try {
      const { bank, system } = await setup()
      const voice = bank.play('world.bed')
      await vi.advanceTimersByTimeAsync(0)
      expect(voice?.toState().volume).toBeCloseTo(0.4)

      bank.stopCue('world.bed', 400)
      await vi.advanceTimersByTimeAsync(200)
      expect(voice?.toState().volume).toBeLessThan(0.4)
      expect(voice?.status).toBe('playing')

      await vi.advanceTimersByTimeAsync(250)
      expect(system.store.getSnapshot().voices).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retune re-levels a running cue from the new gain', async () => {
    const { bank } = await setup()
    const voice = bank.play('world.bed', { gain: 0.35 })
    expect(voice?.toState().volume).toBeCloseTo(0.14)
    bank.retune('world.bed', 0.9)
    expect(voice?.toState().volume).toBeCloseTo(0.36)
  })

  it('replaceSound with bytes plays the new audio under a new assetId, decoded from bytes, and leaves the old file alone', async () => {
    const { backend, bank } = await setup()
    const before = bank.play('ui.pop')
    await flush()
    expect(backend.decodeCalls).toEqual(['sfx/click-a.wav'])

    bank.replaceSound('click-a', { bytes: new ArrayBuffer(8), name: 'new-pop.wav' })
    const after = bank.play('ui.click')
    await flush()

    expect(before?.assetId).toBe('click-a')
    expect(after?.assetId).not.toBe('click-a')
    expect(backend.decodeBytesCallCount).toBe(1)
  })

  it('replaceSound with a url fetches that url on the next play', async () => {
    const { backend, bank } = await setup()
    bank.replaceSound('click-a', { url: 'sfx/better.wav' })
    bank.play('ui.pop')
    await flush()
    expect(backend.decodeCalls).toEqual(['sfx/better.wav'])
  })

  it('resolveUrl is applied when fetching but not when exporting', async () => {
    const { backend, bank } = await setup(baseMap(), { resolveUrl: (url) => `/ui-audio/${url}` })
    bank.play('ui.pop')
    await flush()
    expect(backend.decodeCalls).toEqual(['/ui-audio/sfx/click-a.wav'])
    expect(bank.toJSON().sounds['click-a'].url).toBe('sfx/click-a.wav')
  })

  it('toJSON reflects edits, does not alias the loaded map, and flags audio that only exists in memory', async () => {
    const map = baseMap()
    const { bank } = await setup(map)
    bank.assign('ui.pop', ['click-b'])
    bank.replaceSound('click-b', { bytes: new ArrayBuffer(4), name: 'mine.wav' })

    const exported = bank.toJSON()
    expect(exported.cues.find((cue) => cue.id === 'ui.pop')?.sounds).toEqual(['click-b'])
    expect(exported.sounds['click-b'].url).toBeUndefined()
    expect(exported.sounds['click-b'].note).toContain('mine.wav')
    expect(map.cues[1].sounds).toEqual(['click-a'])
  })

  it('addSound makes a new library entry a cue can use', async () => {
    const { bank } = await setup()
    bank.addSound('mine', { channel: 'ui', volume: 1 }, { bytes: new ArrayBuffer(4), name: 'mine.wav' })
    bank.assign('ui.pop', ['mine'])
    expect(bank.play('ui.pop')?.assetId).toMatch(/^mine/)
  })

  it('notifies change listeners on edits so a board can redraw', async () => {
    const { bank } = await setup()
    let changes = 0
    bank.onChange(() => (changes += 1))
    bank.assign('ui.pop', ['click-b'])
    bank.updateCue('ui.pop', { gain: 0.3 })
    bank.updateSound('click-b', { volume: 0.2 })
    expect(changes).toBe(3)
  })
})

describe('validateCueMap', () => {
  it('accepts a consistent map', () => {
    expect(validateCueMap(baseMap())).toEqual([])
  })

  it('names a dangling sound, a duplicate cue and a sound without a url', () => {
    const map = baseMap()
    map.cues[1].sounds = ['click-zzz']
    map.cues.push({ ...map.cues[0] })
    map.sounds.hum = { channel: 'bgm', volume: 1 }
    expect(validateCueMap(map)).toEqual([
      'Cue "ui.pop" uses sound "click-zzz", which is not in the sounds list',
      'Cue "ui.click" is listed twice',
      'Sound "hum" has no url',
    ])
  })
})
