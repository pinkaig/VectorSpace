/**
 * @file        AudioBackend.ts
 * @brief       The pluggable interface every audio engine implements.
 *
 * @responsibility
 * Isolates the audio graph primitives (gain nodes, decoded sources, the
 * clock) behind one contract, so `AudioSystem` and everything above it are
 * unit-testable without a real `AudioContext` — Web Audio is not available
 * under vitest/jsdom.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */

/** A gain node: one volume knob in the graph, with a ramped set for click-free changes. */
export interface BackendGain {
  setValue(value: number, rampSeconds?: number): void
  /** Linear fade from the current value to `value` over `durationSeconds`; used for fades, where a fixed end time matters. */
  rampTo(value: number, durationSeconds: number): void
  getValue(): number
  connect(target: BackendGain): void
  disconnect(): void
}

/** A decoded, playable buffer. Backend-opaque; callers never inspect its contents. */
export interface BackendBuffer {
  readonly durationSeconds: number
}

export type BackendSourceState = 'playing' | 'paused' | 'stopped' | 'ended'

/** One playing instance of a `BackendBuffer`, routed into a gain node. */
export interface BackendSource {
  readonly state: BackendSourceState
  currentTimeSeconds(): number
  pause(): void
  resume(): void
  stop(): void
  seek(timeSeconds: number): void
  setLoop(loop: boolean): void
  setRate(rate: number): void
  onEnded(handler: () => void): void
}

export interface CreateSourceOptions {
  buffer: BackendBuffer
  destination: BackendGain
  startAtSeconds?: number
  loop?: boolean
  rate?: number
}

export type AudioContextState = 'suspended' | 'running' | 'closed' | 'unavailable'

/**
 * Everything `AudioSystem` needs from an audio engine. `WebAudioBackend`
 * implements this for real playback; `FakeAudioBackend` implements it with a
 * manual clock for tests.
 */
export interface AudioBackend {
  readonly state: AudioContextState
  resume(): Promise<void>
  /** Freezes every sound in place (clocks included); `resume()` continues them. Used when the tab is hidden. */
  suspend(): Promise<void>
  createGain(): BackendGain
  connectToDestination(gain: BackendGain): void
  decode(url: string): Promise<BackendBuffer>
  /** Decodes bytes already in hand (e.g. from an IndexedDB cache) with no fetch. */
  decodeBytes(data: ArrayBuffer): Promise<BackendBuffer>
  createSource(options: CreateSourceOptions): BackendSource
  dispose(): void
}
