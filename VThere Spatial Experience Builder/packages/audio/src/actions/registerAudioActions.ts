/**
 * @file        registerAudioActions.ts
 * @brief       Registers playAudio/stopAudio/pauseAudio/resumeAudio/setChannelVolume executors.
 *
 * @responsibility
 * The bridge between the WHEN->DO action vocabulary (packages/interaction)
 * and AudioSystem. Every executor that starts a voice registers a disposer
 * with context.effects.add, so resetRuntime()'s effects.disposeAll() stops
 * all audio, per the existing EffectRegistry contract. Unknown or invalid
 * params are ignored with a console warning, never thrown, matching the
 * registry's "unregistered kind is a no-op" policy for malformed params.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System,
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { ActionRegistry } from '@vthere/interaction'
import type { ChannelId } from '@vthere/project'
import type { AudioSystem } from '../AudioSystem'

const isChannelId = (value: unknown): value is ChannelId => typeof value === 'string' && value.length > 0

export const registerAudioActions = (registry: ActionRegistry, audio: AudioSystem): void => {
  registry.register('playAudio', (action, ctx) => {
    const params = action.params ?? {}
    const assetId = params.assetId
    if (typeof assetId !== 'string' || !assetId) {
      console.warn('[audio] playAudio requires a string assetId', action)
      return ctx.state
    }
    const voice = audio.play({
      assetId,
      channel: isChannelId(params.channel) ? params.channel : undefined,
      volume: typeof params.volume === 'number' ? params.volume : undefined,
      loop: typeof params.loop === 'boolean' ? params.loop : undefined,
      rate: typeof params.rate === 'number' ? params.rate : undefined,
      startAt: typeof params.startAt === 'number' ? params.startAt : undefined,
    })
    ctx.effects.add(() => audio.stop({ voiceId: voice.id }))
    return ctx.state
  })

  registry.register('stopAudio', (action, ctx) => {
    const params = action.params ?? {}
    const { voiceId, assetId, channel } = params
    if (typeof voiceId !== 'string' && typeof assetId !== 'string' && !isChannelId(channel)) {
      console.warn('[audio] stopAudio requires one of voiceId, assetId, channel', action)
      return ctx.state
    }
    audio.stop({
      voiceId: typeof voiceId === 'string' ? voiceId : undefined,
      assetId: typeof assetId === 'string' ? assetId : undefined,
      channel: isChannelId(channel) ? channel : undefined,
    })
    return ctx.state
  })

  registry.register('pauseAudio', (action, ctx) => {
    const params = action.params ?? {}
    audio.pause({
      voiceId: typeof params.voiceId === 'string' ? params.voiceId : undefined,
      assetId: typeof params.assetId === 'string' ? params.assetId : undefined,
      channel: isChannelId(params.channel) ? params.channel : undefined,
    })
    return ctx.state
  })

  registry.register('resumeAudio', (action, ctx) => {
    const params = action.params ?? {}
    audio.resume({
      voiceId: typeof params.voiceId === 'string' ? params.voiceId : undefined,
      assetId: typeof params.assetId === 'string' ? params.assetId : undefined,
      channel: isChannelId(params.channel) ? params.channel : undefined,
    })
    return ctx.state
  })

  registry.register('setChannelVolume', (action, ctx) => {
    const params = action.params ?? {}
    if (!isChannelId(params.channel) || typeof params.volume !== 'number') {
      console.warn('[audio] setChannelVolume requires channel and volume', action)
      return ctx.state
    }
    audio.setChannelVolume(params.channel, params.volume)
    return ctx.state
  })

  registry.register('setMasterVolume', (action, ctx) => {
    const params = action.params ?? {}
    if (typeof params.volume !== 'number') {
      console.warn('[audio] setMasterVolume requires a numeric volume', action)
      return ctx.state
    }
    audio.setMaster(params.volume)
    return ctx.state
  })
}
