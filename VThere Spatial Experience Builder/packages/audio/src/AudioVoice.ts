/**
 * @file        AudioVoice.ts
 * @brief       One playing (or paused, or loading) instance of an asset on a channel.
 *
 * @responsibility
 * Owns the voice's state machine (`idle -> loading -> playing <-> paused ->
 * stopped | ended | error`), its own gain node (volume, mute), and the
 * backend source once loaded. Illegal transitions are ignored, not thrown,
 * per the design doc's transport table.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
 */
import type { ChannelId } from '@vthere/project'
import type { AudioBackend, BackendBuffer, BackendGain, BackendSource } from './backend/AudioBackend'

export type VoiceStatus = 'loading' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error'

export interface VoiceState {
  id: string
  assetId: string
  channel: ChannelId
  status: VoiceStatus
  currentTime: number
  duration: number | null
  volume: number
  muted: boolean
  loop: boolean
  rate: number
  errorMessage?: string
}

export type VoiceEventType = 'started' | 'paused' | 'resumed' | 'ended' | 'stopped' | 'error'
export type VoiceEventHandler = (voice: AudioVoice, type: VoiceEventType) => void

let nextVoiceId = 0

export class AudioVoice {
  readonly id: string
  readonly assetId: string
  readonly channel: ChannelId
  status: VoiceStatus = 'loading'
  loop: boolean
  rate: number
  errorMessage?: string

  private readonly gain: BackendGain
  private source: BackendSource | null = null
  private volume: number
  private muted = false
  private readonly startAtSeconds: number
  private duration: number | null = null
  private pendingSeekSeconds: number | null = null
  private pendingPause = false

  constructor(
    private readonly backend: AudioBackend,
    private readonly channelGain: BackendGain,
    opts: { assetId: string; channel: ChannelId; volume: number; loop: boolean; rate: number; startAtSeconds: number },
    private readonly onEvent: VoiceEventHandler,
  ) {
    this.id = `voice-${nextVoiceId++}`
    this.assetId = opts.assetId
    this.channel = opts.channel
    this.volume = opts.volume
    this.loop = opts.loop
    this.rate = opts.rate
    this.startAtSeconds = opts.startAtSeconds
    this.gain = backend.createGain()
    this.gain.connect(channelGain)
    this.applyGain()
  }

  /** Called once decode resolves. A voice stopped or errored while loading ignores this. */
  attachBuffer(buffer: BackendBuffer): void {
    if (this.status === 'stopped' || this.status === 'error') return
    this.duration = buffer.durationSeconds
    this.source = this.backend.createSource({
      buffer,
      destination: this.gain,
      startAtSeconds: this.pendingSeekSeconds ?? this.startAtSeconds,
      loop: this.loop,
      rate: this.rate,
    })
    this.source.onEnded(() => {
      if (this.status === 'playing' || this.status === 'paused') {
        this.status = 'ended'
        this.onEvent(this, 'ended')
      }
    })
    if (this.pendingPause) {
      this.source.pause()
      this.status = 'paused'
      this.pendingPause = false
    } else {
      this.status = 'playing'
      this.onEvent(this, 'started')
    }
  }

  fail(errorMessage: string): void {
    this.status = 'error'
    this.errorMessage = errorMessage
    this.onEvent(this, 'error')
  }

  pause(): void {
    if (this.status === 'loading') {
      this.pendingPause = true
      return
    }
    if (this.status !== 'playing') return
    this.source?.pause()
    this.status = 'paused'
    this.onEvent(this, 'paused')
  }

  resume(): void {
    if (this.status === 'loading') {
      this.pendingPause = false
      return
    }
    if (this.status !== 'paused') return
    this.source?.resume()
    this.status = 'playing'
    this.onEvent(this, 'resumed')
  }

  stop(): void {
    if (this.status === 'stopped' || this.status === 'ended' || this.status === 'error') return
    this.source?.stop()
    this.status = 'stopped'
    this.gain.disconnect()
    this.onEvent(this, 'stopped')
  }

  seek(timeSeconds: number): void {
    if (this.status === 'loading') {
      this.pendingSeekSeconds = timeSeconds
      return
    }
    this.source?.seek(timeSeconds)
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value))
    this.applyGain()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyGain()
  }

  setLoop(loop: boolean): void {
    this.loop = loop
    this.source?.setLoop(loop)
  }

  setRate(rate: number): void {
    this.rate = rate
    this.source?.setRate(rate)
  }

  private applyGain(): void {
    this.gain.setValue(this.muted ? 0 : this.volume)
  }

  toState(): VoiceState {
    return {
      id: this.id,
      assetId: this.assetId,
      channel: this.channel,
      status: this.status,
      currentTime: this.source?.currentTimeSeconds() ?? 0,
      duration: this.duration,
      volume: this.volume,
      muted: this.muted,
      loop: this.loop,
      rate: this.rate,
      errorMessage: this.errorMessage,
    }
  }
}
