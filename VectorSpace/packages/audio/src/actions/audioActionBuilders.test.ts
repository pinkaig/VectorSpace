import { describe, expect, it } from 'vitest'
import { createActionRegistry, createEffectRegistry, createRuntimeState } from '@vectorspace/interaction'
import type { ActionContext } from '@vectorspace/interaction'
import { AudioSystem } from '../AudioSystem'
import { FakeAudioBackend } from '../backend/FakeAudioBackend'
import { registerAudioActions } from './registerAudioActions'
import {
  audioRule,
  pauseAudioAction,
  playAudioAction,
  resumeAudioAction,
  setChannelVolumeAction,
  setMasterVolumeAction,
  stopAudioAction,
} from './audioActionBuilders'
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

describe('audio action builders', () => {
  it('playAudioAction round-trips through the registered playAudio executor, including options', async () => {
    const { audio, registry, ctx, effects } = setup()
    await audio.unlock()
    const spec = playAudioAction('sfx1', { channel: 'sfx', volume: 0.4, loop: true, rate: 1.5, startAt: 2 })
    expect(spec).toEqual({
      kind: 'playAudio',
      params: { assetId: 'sfx1', channel: 'sfx', volume: 0.4, loop: true, rate: 1.5, startAt: 2 },
    })

    await registry.execute(spec, ctx)
    await flush()
    const voice = audio.store.getSnapshot().voices[0]
    expect(voice.channel).toBe('sfx')
    expect(voice.volume).toBe(0.4)
    expect(voice.loop).toBe(true)
    expect(voice.rate).toBe(1.5)
    expect(effects.size).toBe(1)
  })

  it('playAudioAction omits unset options rather than sending them as undefined', () => {
    expect(playAudioAction('a')).toEqual({ kind: 'playAudio', params: { assetId: 'a' } })
  })

  it.each([
    ['stopAudioAction', stopAudioAction, 'stopAudio'] as const,
    ['pauseAudioAction', pauseAudioAction, 'pauseAudio'] as const,
    ['resumeAudioAction', resumeAudioAction, 'resumeAudio'] as const,
  ])('%s builds a spec keyed by whichever selector field is given', (_name, builder, kind) => {
    expect(builder({ voiceId: 'voice-1' })).toEqual({ kind, params: { voiceId: 'voice-1' } })
    expect(builder({ assetId: 'a' })).toEqual({ kind, params: { assetId: 'a' } })
    expect(builder({ channel: 'sfx' })).toEqual({ kind, params: { channel: 'sfx' } })
  })

  it('stopAudioAction executes against a live voice by channel', async () => {
    const { audio, registry, ctx } = setup()
    await audio.unlock()
    await registry.execute(playAudioAction('a', { channel: 'sfx' }), ctx)
    await flush()
    await registry.execute(stopAudioAction({ channel: 'sfx' }), ctx)
    expect(audio.store.getSnapshot().voices).toHaveLength(0)
  })

  it('pauseAudioAction/resumeAudioAction execute transport by assetId', async () => {
    const { audio, registry, ctx } = setup()
    await audio.unlock()
    await registry.execute(playAudioAction('a'), ctx)
    await flush()

    await registry.execute(pauseAudioAction({ assetId: 'a' }), ctx)
    expect(audio.store.getSnapshot().voices[0].status).toBe('paused')

    await registry.execute(resumeAudioAction({ assetId: 'a' }), ctx)
    expect(audio.store.getSnapshot().voices[0].status).toBe('playing')
  })

  it('setChannelVolumeAction and setMasterVolumeAction build and execute correctly', async () => {
    const { audio, registry, ctx } = setup()
    expect(setChannelVolumeAction('bgm', 0.3)).toEqual({ kind: 'setChannelVolume', params: { channel: 'bgm', volume: 0.3 } })
    expect(setMasterVolumeAction(0.6)).toEqual({ kind: 'setMasterVolume', params: { volume: 0.6 } })

    await registry.execute(setChannelVolumeAction('bgm', 0.3), ctx)
    await registry.execute(setMasterVolumeAction(0.6), ctx)
    const snapshot = audio.store.getSnapshot()
    expect(snapshot.channels.find((c) => c.id === 'bgm')?.volume).toBe(0.3)
    expect(snapshot.master.volume).toBe(0.6)
  })

  it('audioRule assembles an InteractionRule from one or more audio ActionSpecs', () => {
    const rule = audioRule(
      { id: 'rule-1', triggers: ['click'], objectId: 'obj-1', priority: 5 },
      [playAudioAction('chime'), setChannelVolumeAction('sfx', 0.8)],
    )
    expect(rule).toEqual({
      id: 'rule-1',
      objectId: 'obj-1',
      zoneId: undefined,
      triggers: ['click'],
      actions: [
        { kind: 'playAudio', params: { assetId: 'chime' } },
        { kind: 'setChannelVolume', params: { channel: 'sfx', volume: 0.8 } },
      ],
      priority: 5,
    })
  })

  it('carries fadeIn and cooldownMs on playAudio, and fadeOut on stopAudio, only when given', () => {
    expect(playAudioAction('a', { fadeIn: 1.5, cooldownMs: 400 }).params).toEqual({ assetId: 'a', fadeIn: 1.5, cooldownMs: 400 })
    expect(playAudioAction('a').params).toEqual({ assetId: 'a' })
    expect(stopAudioAction({ assetId: 'a' }, { fadeOut: 2 }).params).toEqual({ assetId: 'a', fadeOut: 2 })
    expect(stopAudioAction({ assetId: 'a' }).params).toEqual({ assetId: 'a' })
  })
})
