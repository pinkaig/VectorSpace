/**
 * @file        audioActionBuilders.ts
 * @brief       Typed constructors for the ActionSpec/InteractionRule shapes registerAudioActions understands.
 *
 * @responsibility
 * A WHEN->DO rule's `actions` field is just `ActionSpec[]` — `{kind, params}`
 * object literals with no compile-time link to what registerAudioActions.ts
 * actually reads out of `params`. These builders are that link: one function
 * per registered audio action kind, typed against the exact params each
 * executor parses, plus a couple of rule-assembly helpers. No new action
 * kinds are introduced here and nothing is registered — this only makes it
 * harder to hand-roll a spec the executor would silently no-op on (e.g. a
 * typo'd param name, or an assetId of the wrong type).
 *
 * There is deliberately no UI built on top of this yet; see the "When-Do
 * authoring" plan in audio-system.md for how these builders are meant to be
 * consumed once a rule-authoring surface exists.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System,
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { ActionSpec, ChannelId, InteractionRule } from '@vthere/project'

export interface PlayAudioOptions {
  channel?: ChannelId
  volume?: number
  loop?: boolean
  rate?: number
  startAt?: number
}

/** Builds a `playAudio` ActionSpec. `assetId` must resolve via the app's AudioResolver at run time. */
export const playAudioAction = (assetId: string, options: PlayAudioOptions = {}): ActionSpec => ({
  kind: 'playAudio',
  params: {
    assetId,
    ...(options.channel !== undefined ? { channel: options.channel } : {}),
    ...(options.volume !== undefined ? { volume: options.volume } : {}),
    ...(options.loop !== undefined ? { loop: options.loop } : {}),
    ...(options.rate !== undefined ? { rate: options.rate } : {}),
    ...(options.startAt !== undefined ? { startAt: options.startAt } : {}),
  },
})

/** A selector narrowing which voice(s) stop/pause/resume affect. At least one field is required. */
export type AudioVoiceSelector =
  | { voiceId: string; assetId?: never; channel?: never }
  | { assetId: string; voiceId?: never; channel?: never }
  | { channel: ChannelId; voiceId?: never; assetId?: never }

const selectorParams = (sel: AudioVoiceSelector): Record<string, unknown> =>
  'voiceId' in sel && sel.voiceId !== undefined
    ? { voiceId: sel.voiceId }
    : 'assetId' in sel && sel.assetId !== undefined
      ? { assetId: sel.assetId }
      : { channel: sel.channel }

/** Builds a `stopAudio` ActionSpec targeting one voice, every voice for an asset, or a whole channel. */
export const stopAudioAction = (selector: AudioVoiceSelector): ActionSpec => ({
  kind: 'stopAudio',
  params: selectorParams(selector),
})

/** Builds a `pauseAudio` ActionSpec. Same selector rules as stopAudioAction. */
export const pauseAudioAction = (selector: AudioVoiceSelector): ActionSpec => ({
  kind: 'pauseAudio',
  params: selectorParams(selector),
})

/** Builds a `resumeAudio` ActionSpec. Same selector rules as stopAudioAction. */
export const resumeAudioAction = (selector: AudioVoiceSelector): ActionSpec => ({
  kind: 'resumeAudio',
  params: selectorParams(selector),
})

/** Builds a `setChannelVolume` ActionSpec. `volume` is not clamped here; AudioSystem clamps at the voice/bus level. */
export const setChannelVolumeAction = (channel: ChannelId, volume: number): ActionSpec => ({
  kind: 'setChannelVolume',
  params: { channel, volume },
})

/** Builds a `setMasterVolume` ActionSpec. */
export const setMasterVolumeAction = (volume: number): ActionSpec => ({
  kind: 'setMasterVolume',
  params: { volume },
})

export interface AudioRuleOptions {
  id: string
  triggers: string[]
  objectId?: string
  zoneId?: string
  priority?: number
}

/**
 * Assembles a full InteractionRule from one or more audio ActionSpecs (typically
 * built with the functions above). A thin wrapper — its only job is to keep
 * callers from having to remember InteractionRule's field names — but it
 * exists as the seam a future rule-authoring UI would call into instead of
 * constructing the record by hand.
 */
export const audioRule = (options: AudioRuleOptions, actions: ActionSpec[]): InteractionRule => ({
  id: options.id,
  objectId: options.objectId,
  zoneId: options.zoneId,
  triggers: options.triggers,
  actions,
  priority: options.priority,
})
