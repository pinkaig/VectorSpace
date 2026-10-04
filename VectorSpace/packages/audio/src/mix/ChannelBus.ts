/**
 * @file        ChannelBus.ts
 * @brief       One mix channel: a gain node plus volume, mute, and voices routed through it.
 *
 * @responsibility
 * Owns a channel's effective gain (channel volume * mute), and its connection
 * to the master bus. Voice-level gain (volume, fades) is layered on top by
 * AudioVoice; this class knows nothing about individual voices.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type { AudioBackend, BackendGain } from '../backend/AudioBackend'
import type { ChannelId } from '@vectorspace/project'

export class ChannelBus {
  readonly gain: BackendGain
  private volume = 1
  private muted = false

  constructor(readonly id: ChannelId, backend: AudioBackend, destination: BackendGain) {
    this.gain = backend.createGain()
    this.gain.connect(destination)
    this.apply()
  }

  setVolume(value: number, rampSeconds?: number): void {
    this.volume = Math.max(0, Math.min(1, value))
    this.apply(rampSeconds)
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean, rampSeconds?: number): void {
    this.muted = muted
    this.apply(rampSeconds)
  }

  isMuted(): boolean {
    return this.muted
  }

  private apply(rampSeconds?: number): void {
    this.gain.setValue(this.muted ? 0 : this.volume, rampSeconds)
  }

  dispose(): void {
    this.gain.disconnect()
  }
}
