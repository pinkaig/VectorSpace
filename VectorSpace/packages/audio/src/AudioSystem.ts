/**
 * @file        AudioSystem.ts
 * @brief       The only audio object other code holds: buses, voices, resolution, state store.
 *
 * @responsibility
 * Core playback slice of the design in https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System:
 * master + four channels, play/pause/resume/stop/setVolume, autoplay unlock
 * with a queue, and a queryable state store. Deliberately does not implement
 * spatial audio, captions, LRU/budget cache eviction, ducking, retrigger
 * gating, mixer snapshots, or the rule-engine event bridge — see that doc's
 * "Feature tiers" table for what is deferred and why.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type { AudioSettings, ChannelId } from '@vectorspace/project'
import type { AudioBackend, BackendBuffer } from './backend/AudioBackend'
import type { AudioResolver } from './AudioResolver'
import { AudioAssetLibrary, type PlayOverrides } from './AudioAssetLibrary'
import { MasterBus } from './mix/MasterBus'
import { ChannelBus } from './mix/ChannelBus'
import { AudioVoice } from './AudioVoice'
import { AudioStateStore, type AudioSnapshot, type ChannelState } from './AudioStateStore'

const DEFAULT_CHANNELS: ChannelId[] = ['bgm', 'sfx', 'narration', 'ambient']

/** Decoded buffers beyond this count are evicted, least-recently-used first, once nothing plays them. */
const DEFAULT_MAX_CACHED_BUFFERS = 32

export interface PlayRequest {
  assetId: string
  channel?: ChannelId
  volume?: number
  loop?: boolean
  rate?: number
  startAt?: number
}

export interface VoiceSelector {
  voiceId?: string
  assetId?: string
  channel?: ChannelId
}

export interface AudioSystemOptions {
  backend: AudioBackend
  resolver: AudioResolver
  assets?: AudioAssetLibrary
  settings?: AudioSettings
  /** Cap on decoded buffers held in the cache; default DEFAULT_MAX_CACHED_BUFFERS. */
  maxCachedBuffers?: number
}

/** A `play()` before unlock is queued and flushed, in order, on `unlock()`. */
interface QueuedPlay {
  request: PlayRequest
  voice: AudioVoice
}

export class AudioSystem {
  readonly store: AudioStateStore
  private readonly backend: AudioBackend
  private readonly resolver: AudioResolver
  private readonly assets: AudioAssetLibrary
  private readonly master: MasterBus
  private readonly channels = new Map<ChannelId, ChannelBus>()
  private readonly voices = new Map<string, AudioVoice>()
  // Insertion order doubles as LRU order: loadBuffer() re-inserts an entry on cache hit
  // to bump it to most-recently-used, so eviction can just delete the Map's first key.
  private readonly bufferCache = new Map<string, Promise<BackendBuffer>>()
  private readonly maxCachedBuffers: number
  private unlocked = false
  private readonly unlockQueue: QueuedPlay[] = []

  constructor(opts: AudioSystemOptions) {
    this.backend = opts.backend
    this.resolver = opts.resolver
    this.assets = opts.assets ?? new AudioAssetLibrary()
    this.maxCachedBuffers = opts.maxCachedBuffers ?? DEFAULT_MAX_CACHED_BUFFERS
    this.master = new MasterBus(this.backend)

    const channelIds = opts.settings ? (Object.keys(opts.settings.channels) as ChannelId[]) : DEFAULT_CHANNELS
    for (const id of new Set([...DEFAULT_CHANNELS, ...channelIds])) {
      const bus = new ChannelBus(id, this.backend, this.master.gain)
      const setting = opts.settings?.channels[id]
      if (setting) {
        bus.setVolume(setting.volume, 0)
        bus.setMuted(setting.muted, 0)
      }
      this.channels.set(id, bus)
    }
    if (opts.settings) this.master.setVolume(opts.settings.master, 0)

    this.store = new AudioStateStore(this.buildSnapshot())
  }

  /** Resumes the (possibly suspended) audio context and flushes any queued plays. Call from a user gesture. */
  async unlock(): Promise<void> {
    if (this.unlocked) return
    await this.backend.resume()
    this.unlocked = true
    const queued = this.unlockQueue.splice(0, this.unlockQueue.length)
    for (const { request, voice } of queued) this.startVoice(voice, request)
    this.notify()
  }

  get isUnlocked(): boolean {
    return this.unlocked
  }

  private getOrCreateChannel(id: ChannelId): ChannelBus {
    const existing = this.channels.get(id)
    if (existing) return existing
    const bus = new ChannelBus(id, this.backend, this.master.gain)
    this.channels.set(id, bus)
    return bus
  }

  play(req: PlayRequest): AudioVoice {
    const overrides: PlayOverrides = { channel: req.channel, volume: req.volume, loop: req.loop, rate: req.rate }
    const resolved = this.assets.resolve(req.assetId, overrides)
    const channelBus = this.getOrCreateChannel(resolved.channel)

    const voice = new AudioVoice(
      this.backend,
      channelBus.gain,
      { assetId: req.assetId, channel: resolved.channel, volume: resolved.volume, loop: resolved.loop, rate: resolved.rate, startAtSeconds: req.startAt ?? 0 },
      () => this.notify(),
    )
    this.voices.set(voice.id, voice)
    this.notify()

    if (this.unlocked) {
      this.startVoice(voice, req)
    } else {
      this.unlockQueue.push({ request: req, voice })
    }
    return voice
  }

  private startVoice(voice: AudioVoice, req: PlayRequest): void {
    void this.loadBuffer(req.assetId)
      .then((buffer) => {
        if (!this.voices.has(voice.id)) return
        voice.attachBuffer(buffer)
        this.notify()
      })
      .catch((error: unknown) => {
        if (!this.voices.has(voice.id)) return
        voice.fail(error instanceof Error ? error.message : String(error))
        this.notify()
      })
  }

  private async loadBuffer(assetId: string): Promise<BackendBuffer> {
    const cached = this.bufferCache.get(assetId)
    if (cached) {
      // Bump to most-recently-used: delete + re-set moves the key to the end of insertion order.
      this.bufferCache.delete(assetId)
      this.bufferCache.set(assetId, cached)
      return cached
    }

    const promise = (async () => {
      const resolved = await this.resolver.resolve(assetId)
      if (!resolved) throw new Error(`No audio resolves for asset "${assetId}"`)
      return resolved.kind === 'buffer' ? this.backend.decodeBytes(resolved.data) : this.backend.decode(resolved.url)
    })()

    this.bufferCache.set(assetId, promise)
    promise.catch(() => this.bufferCache.delete(assetId))
    this.evictUnusedBuffers()
    return promise
  }

  /** Drops least-recently-used decoded buffers over the cap, skipping any asset a live voice still plays. */
  private evictUnusedBuffers(): void {
    if (this.bufferCache.size <= this.maxCachedBuffers) return
    const assetIdsInUse = new Set([...this.voices.values()].map((voice) => voice.assetId))
    for (const assetId of this.bufferCache.keys()) {
      if (this.bufferCache.size <= this.maxCachedBuffers) break
      if (assetIdsInUse.has(assetId)) continue
      this.bufferCache.delete(assetId)
    }
  }

  private selectVoices(sel: VoiceSelector): AudioVoice[] {
    return [...this.voices.values()].filter((voice) => {
      if (sel.voiceId !== undefined) return voice.id === sel.voiceId
      if (sel.assetId !== undefined && voice.assetId !== sel.assetId) return false
      if (sel.channel !== undefined && voice.channel !== sel.channel) return false
      return sel.assetId !== undefined || sel.channel !== undefined
    })
  }

  stop(sel: VoiceSelector): void {
    for (const voice of this.selectVoices(sel)) {
      voice.stop()
      this.voices.delete(voice.id)
      this.removeFromUnlockQueue(voice.id)
    }
    this.notify()
  }

  pause(sel: VoiceSelector): void {
    for (const voice of this.selectVoices(sel)) voice.pause()
    this.notify()
  }

  resume(sel: VoiceSelector): void {
    for (const voice of this.selectVoices(sel)) voice.resume()
    this.notify()
  }

  seek(sel: VoiceSelector, timeSeconds: number): void {
    for (const voice of this.selectVoices(sel)) voice.seek(timeSeconds)
    this.notify()
  }

  setVoiceVolume(sel: VoiceSelector, value: number): void {
    for (const voice of this.selectVoices(sel)) voice.setVolume(value)
    this.notify()
  }

  private removeFromUnlockQueue(voiceId: string): void {
    const index = this.unlockQueue.findIndex((entry) => entry.voice.id === voiceId)
    if (index >= 0) this.unlockQueue.splice(index, 1)
  }

  setMaster(value: number, rampSeconds?: number): void {
    this.master.setVolume(value, rampSeconds)
    this.notify()
  }

  muteMaster(muted: boolean): void {
    this.master.setMuted(muted)
    this.notify()
  }

  setChannelVolume(channel: ChannelId, value: number, rampSeconds?: number): void {
    this.getOrCreateChannel(channel).setVolume(value, rampSeconds)
    this.notify()
  }

  muteChannel(channel: ChannelId, muted: boolean): void {
    this.getOrCreateChannel(channel).setMuted(muted)
    this.notify()
  }

  setProjectAudioAssets(metas: Parameters<AudioAssetLibrary['setMetas']>[0]): void {
    this.assets.setMetas(metas)
  }

  /** Stops and releases every voice. Used by resetRuntime()/scene restart. */
  stopAll(): void {
    for (const voice of this.voices.values()) voice.stop()
    this.voices.clear()
    this.unlockQueue.length = 0
    this.notify()
  }

  /** Stops everything and closes the backend context. Safe to call twice. */
  dispose(): void {
    this.stopAll()
    for (const channel of this.channels.values()) channel.dispose()
    this.master.dispose()
    this.backend.dispose()
  }

  private buildSnapshot(): AudioSnapshot {
    const channelStates: ChannelState[] = [...this.channels.entries()].map(([id, bus]) => ({
      id,
      volume: bus.getVolume(),
      muted: bus.isMuted(),
      voiceCount: [...this.voices.values()].filter((voice) => voice.channel === id).length,
    }))
    return {
      contextState: this.backend.state,
      unlocked: this.unlocked,
      master: { volume: this.master.getVolume(), muted: this.master.isMuted() },
      channels: channelStates,
      voices: [...this.voices.values()].map((voice) => voice.toState()),
    }
  }

  private notify(): void {
    this.reapEndedVoices()
    this.store.update(this.buildSnapshot())
  }

  /** A voice that finished on its own (never explicitly stopped) is otherwise never removed. */
  private reapEndedVoices(): void {
    for (const [id, voice] of this.voices) {
      if (voice.status === 'ended') this.voices.delete(id)
    }
  }
}
