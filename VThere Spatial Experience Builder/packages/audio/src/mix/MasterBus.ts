/**
 * @file        MasterBus.ts
 * @brief       The single gain node every channel routes through before the destination.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
 */
import type { AudioBackend, BackendGain } from '../backend/AudioBackend'

export class MasterBus {
  readonly gain: BackendGain
  private volume = 1
  private muted = false

  constructor(backend: AudioBackend) {
    this.gain = backend.createGain()
    backend.connectToDestination(this.gain)
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
