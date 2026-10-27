/**
 * @file        CueBank.ts
 * @brief       Named sound moments ("cues") mapped to swappable sounds, played through AudioSystem.
 *
 * @responsibility
 * The seam between "something happened in the UI" and "which file plays".
 * Callers say `bank.play('editor.place.drop')`; the bank decides which variant,
 * how loud, which channel, and whether a retrigger is too soon. Pointing a cue
 * at a different sound, or replacing a sound's audio, is data (a CueMap), not
 * code. That is the reason this layer exists: a sound designer's new file
 * should never need a rebuild.
 *
 * Adds no playback ability of its own. Every sound goes through
 * AudioSystem.play(), so buses, voices, unlock queueing and the decoded-buffer
 * cache are the ones the rest of the app already uses. The bank is also the
 * AudioResolver for the sounds it owns, which is how a file dropped onto a cue
 * (bytes, no URL) takes the same Tier B path as a cached clip.
 *
 * It does not know what triggers a cue. Triggers (a click on a selector, a
 * rule firing) belong to whoever calls play(); see prototypes/ui-audio for one.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type { AudioAssetMeta, ChannelId } from '@vectorspace/project'
import type { AudioResolver, ResolvedAudio } from '../AudioResolver'
import type { AudioSystem } from '../AudioSystem'
import type { AudioVoice } from '../AudioVoice'

export type CuePick = 'first' | 'cycle' | 'random'

/** One audio file in the library. Its id doubles as the AudioSystem assetId. */
export interface CueSound {
  /** Fetched on first play. Absent only for audio supplied as bytes via replaceSound(). */
  url?: string
  channel: ChannelId
  /** 0-1, before the cue's own gain. Level-matches the library so cues need no hand-tuning. */
  volume: number
  loop?: boolean
  /** A stand-in so the app sounds complete; the board and the brief list these as still needing real audio. */
  placeholder?: boolean
  note?: string
}

/** One moment in the product that can make a sound. Not one file: a cue can rotate several. */
export interface CueDef {
  id: string
  /** Plain-language name of the moment, for the board and the consultation brief. */
  label: string
  group: string
  /** 1 = the app feels broken without it, 2 = polish, 3 = nice to have. */
  tier: 1 | 2 | 3
  /** Variants in order. Empty means silent on purpose, which is a decision, not a bug. */
  sounds: string[]
  pick?: CuePick
  /** Multiplies the sound's own volume. */
  gain?: number
  /** Random +/- fraction applied to playback rate on every trigger, so repeats do not sound mechanical. */
  rateJitter?: number
  /** Retriggers inside this window are dropped. */
  cooldownMs?: number
  /** Overrides the sound's channel, to route one file to different buses per cue. */
  channel?: ChannelId
  loop?: boolean
  note?: string
}

export interface CueMap {
  sounds: Record<string, CueSound>
  cues: CueDef[]
}

/** Where a replacement sound comes from: a URL to fetch, or bytes already in hand. */
export type CueSoundSource = { url: string } | { bytes: ArrayBuffer; name?: string }

export interface CuePlayOptions {
  /** Multiplied on top of the sound and cue gain, for state-driven loudness such as Quiet/Normal/Loud. */
  gain?: number
  loop?: boolean
}

export interface CuePlayEvent {
  cueId: string
  /** Null when the cue is silent on purpose. */
  soundId: string | null
  voice: AudioVoice | null
  at: number
}

export interface CueBankOptions {
  now?: () => number
  random?: () => number
  /** Applied to a sound's url when it is fetched (not when it is stored), so exports keep the url as written. */
  resolveUrl?: (url: string) => string
}

/** Problems a hand-edited map can have, in words a sound designer can act on. Empty means usable. */
export function validateCueMap(map: CueMap): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const cue of map.cues) {
    if (seen.has(cue.id)) problems.push(`Cue "${cue.id}" is listed twice`)
    seen.add(cue.id)
    for (const soundId of cue.sounds) {
      if (!Object.hasOwn(map.sounds, soundId)) problems.push(`Cue "${cue.id}" uses sound "${soundId}", which is not in the sounds list`)
    }
  }
  for (const [soundId, sound] of Object.entries(map.sounds)) {
    if (!sound.url) problems.push(`Sound "${soundId}" has no url`)
  }
  return problems
}

interface SoundEntry {
  def: CueSound
  /** Changes whenever the audio changes: AudioSystem caches decoded buffers per assetId, so reusing one would replay the old file. */
  assetId: string
}

interface AssetSource {
  url?: string
  bytes?: ArrayBuffer
  name?: string
}

interface CueRuntime {
  cycle: number
  lastAt: number
  lastSound?: string
  voices: Set<AudioVoice>
}

const FADE_STEPS = 8

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export class CueBank implements AudioResolver {
  private readonly sounds = new Map<string, SoundEntry>()
  /** Every revision stays resolvable, so a voice still loading when its sound is replaced does not fail. */
  private readonly assets = new Map<string, AssetSource>()
  private readonly cues = new Map<string, CueDef>()
  private readonly runtime = new Map<string, CueRuntime>()
  private readonly playListeners = new Set<(event: CuePlayEvent) => void>()
  private readonly changeListeners = new Set<() => void>()
  private readonly now: () => number
  private readonly random: () => number
  private readonly resolveUrl: (url: string) => string
  private system: AudioSystem | null = null
  private revision = 0

  constructor(map: CueMap, options: CueBankOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.random = options.random ?? Math.random
    this.resolveUrl = options.resolveUrl ?? ((url) => url)
    // Copy so later edits through the bank never write back into the object the caller loaded.
    for (const [soundId, def] of Object.entries(map.sounds)) {
      this.sounds.set(soundId, { def: { ...def }, assetId: soundId })
      this.assets.set(soundId, { url: def.url })
    }
    for (const cue of map.cues) this.cues.set(cue.id, { ...cue, sounds: [...cue.sounds] })
  }

  /** Attaches the system the sounds play through and registers their presets with it. */
  bind(system: AudioSystem): void {
    this.system = system
    this.syncAssets()
  }

  async resolve(assetId: string): Promise<ResolvedAudio | null> {
    const source = this.assets.get(assetId)
    if (!source) return null
    // decodeAudioData takes ownership of the buffer it is given, so every decode needs its own copy.
    if (source.bytes) return { kind: 'buffer', data: source.bytes.slice(0) }
    return source.url ? { kind: 'url', url: this.resolveUrl(source.url) } : null
  }

  cueList(): CueDef[] {
    return [...this.cues.values()]
  }

  getCue(cueId: string): CueDef | undefined {
    return this.cues.get(cueId)
  }

  soundList(): Array<{ id: string; def: CueSound }> {
    return [...this.sounds.entries()].map(([id, entry]) => ({ id, def: entry.def }))
  }

  play(cueId: string, options: CuePlayOptions = {}): AudioVoice | null {
    const cue = this.cues.get(cueId)
    if (!cue || !this.system) return null
    const state = this.runtimeFor(cueId)
    const at = this.now()
    if (cue.cooldownMs && at - state.lastAt < cue.cooldownMs) return null

    const soundId = this.pickSound(cue)
    if (soundId === undefined) {
      this.emit({ cueId, soundId: null, voice: null, at })
      return null
    }
    const entry = this.sounds.get(soundId)
    if (!entry) return null
    const loop = options.loop ?? cue.loop ?? entry.def.loop ?? false
    // AudioSystem queues a play made before the first user gesture and flushes it later. That suits a music bed,
    // but a click that could not be heard when it happened must not burst out seconds later, so one-shots are dropped.
    if (!loop && !this.system.isUnlocked) return null

    state.lastAt = at
    state.lastSound = soundId
    const jitter = cue.rateJitter ? 1 + (this.random() * 2 - 1) * cue.rateJitter : 1
    const voice = this.system.play({
      assetId: entry.assetId,
      channel: cue.channel ?? entry.def.channel,
      volume: clamp01(entry.def.volume * (cue.gain ?? 1) * (options.gain ?? 1)),
      loop,
      rate: jitter,
    })
    // One-shots end on their own and nothing else removes them, so drop finished voices as new ones arrive.
    for (const old of state.voices) if (old.status === 'ended' || old.status === 'stopped' || old.status === 'error') state.voices.delete(old)
    state.voices.add(voice)
    this.emit({ cueId, soundId, voice, at })
    return voice
  }

  /** Stops every voice this cue started that is still going. Used to end a loop when its condition goes away. */
  stopCue(cueId: string, fadeMs = 0): void {
    const state = this.runtime.get(cueId)
    const system = this.system
    if (!state || !system) return
    const voices = [...state.voices]
    state.voices.clear()
    if (fadeMs <= 0) {
      for (const voice of voices) system.stop({ voiceId: voice.id })
      return
    }
    // AudioSystem ramps gain over ~20ms, which is a click on a bed, so a fade is stepped down by hand.
    for (const voice of voices) {
      const from = voice.toState().volume
      for (let step = 1; step <= FADE_STEPS; step++) {
        setTimeout(() => {
          if (step === FADE_STEPS) system.stop({ voiceId: voice.id })
          else voice.setVolume(from * (1 - step / FADE_STEPS))
        }, (fadeMs * step) / FADE_STEPS)
      }
    }
  }

  /** Re-levels the voices a cue is still playing, for loudness that follows state such as a Quiet/Normal/Loud choice. */
  retune(cueId: string, gain: number): void {
    const cue = this.cues.get(cueId)
    const state = this.runtime.get(cueId)
    if (!cue || !state) return
    for (const voice of state.voices) {
      const entry = [...this.sounds.values()].find((candidate) => candidate.assetId === voice.assetId)
      if (entry) voice.setVolume(clamp01(entry.def.volume * (cue.gain ?? 1) * gain))
    }
  }

  /** Re-points a cue at other sounds. An empty list silences it. */
  assign(cueId: string, soundIds: string[]): void {
    const cue = this.cues.get(cueId)
    if (!cue) return
    cue.sounds = [...soundIds]
    this.runtimeFor(cueId).cycle = 0
    this.changed()
  }

  updateCue(cueId: string, patch: Partial<Omit<CueDef, 'id'>>): void {
    const cue = this.cues.get(cueId)
    if (!cue) return
    Object.assign(cue, patch)
    this.changed()
  }

  updateSound(soundId: string, patch: Partial<CueSound>): void {
    const entry = this.sounds.get(soundId)
    if (!entry) return
    Object.assign(entry.def, patch)
    this.syncAssets()
    this.changed()
  }

  /** Swaps the audio behind an existing sound, so every cue that uses it changes at once. */
  replaceSound(soundId: string, source: CueSoundSource): void {
    const entry = this.sounds.get(soundId)
    if (!entry) return
    entry.assetId = this.nextAssetId(soundId)
    this.assets.set(entry.assetId, 'bytes' in source ? { bytes: source.bytes, name: source.name } : { url: source.url })
    if ('url' in source) entry.def.url = source.url
    else entry.def.url = undefined
    this.syncAssets()
    this.changed()
  }

  /** Adds a new library entry, for audio that is not any existing sound. */
  addSound(soundId: string, def: CueSound, source: CueSoundSource): void {
    if (this.sounds.has(soundId)) return
    this.sounds.set(soundId, { def: { ...def }, assetId: soundId })
    this.assets.set(soundId, 'bytes' in source ? { bytes: source.bytes, name: source.name } : { url: source.url })
    this.syncAssets()
    this.changed()
  }

  /** The current map, ready to save back over cue-map.json. Audio held only as bytes is flagged, since a file cannot be exported from memory. */
  toJSON(): CueMap {
    const sounds: Record<string, CueSound> = {}
    for (const [soundId, entry] of this.sounds) {
      const sound: CueSound = { ...entry.def }
      const source = this.assets.get(entry.assetId)
      if (source?.bytes) sound.note = `Session-only audio "${source.name ?? 'dropped file'}": copy the file next to the other sounds and set url.`
      sounds[soundId] = sound
    }
    return { sounds, cues: this.cueList().map((cue) => ({ ...cue, sounds: [...cue.sounds] })) }
  }

  problems(): string[] {
    return validateCueMap(this.toJSON())
  }

  /** Fires for every play, including silent cues, so a coverage view can tell "silent by choice" from "never triggered". */
  onPlay(listener: (event: CuePlayEvent) => void): () => void {
    this.playListeners.add(listener)
    return () => this.playListeners.delete(listener)
  }

  /** Fires when the map is edited (assign, replace, update), so the board can redraw. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  private pickSound(cue: CueDef): string | undefined {
    const ids = cue.sounds
    if (ids.length === 0) return undefined
    const state = this.runtimeFor(cue.id)
    if (cue.pick === 'cycle') {
      const picked = ids[state.cycle % ids.length]
      state.cycle += 1
      return picked
    }
    if (cue.pick === 'random' && ids.length > 1) {
      let index = Math.floor(this.random() * ids.length)
      // Never the same variant twice running: that is what makes random sound like a stuck sample.
      if (ids[index] === state.lastSound) index = (index + 1) % ids.length
      return ids[index]
    }
    return ids[0]
  }

  private runtimeFor(cueId: string): CueRuntime {
    let state = this.runtime.get(cueId)
    if (!state) {
      state = { cycle: 0, lastAt: Number.NEGATIVE_INFINITY, voices: new Set() }
      this.runtime.set(cueId, state)
    }
    return state
  }

  private nextAssetId(soundId: string): string {
    this.revision += 1
    return `${soundId}#${this.revision}`
  }

  private syncAssets(): void {
    if (!this.system) return
    const metas: AudioAssetMeta[] = [...this.sounds.entries()].map(([soundId, entry]) => ({
      assetId: entry.assetId,
      name: soundId,
      channel: entry.def.channel,
      volume: entry.def.volume,
      loop: entry.def.loop ?? false,
    }))
    this.system.setProjectAudioAssets(metas)
  }

  private emit(event: CuePlayEvent): void {
    for (const listener of [...this.playListeners]) listener(event)
  }

  private changed(): void {
    for (const listener of [...this.changeListeners]) listener()
  }
}
