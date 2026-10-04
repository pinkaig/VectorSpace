/**
 * @file        FakeAudioBackend.ts
 * @brief       Deterministic AudioBackend with a manual clock, for tests.
 *
 * @responsibility
 * Implements the AudioBackend contract without any browser API, so voice
 * state machine, mix maths and resolution-order tests run under vitest.
 * Every gain and source records its state for assertions; nothing plays.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type {
  AudioBackend,
  AudioContextState,
  BackendBuffer,
  BackendGain,
  BackendSource,
  BackendSourceState,
  CreateSourceOptions,
} from './AudioBackend'

class FakeGain implements BackendGain {
  private value = 1
  private target: BackendGain | null = null

  setValue(value: number): void {
    this.value = value
  }

  getValue(): number {
    return this.value
  }

  connect(target: BackendGain): void {
    this.target = target
  }

  disconnect(): void {
    this.target = null
  }
}

class FakeSource implements BackendSource {
  state: BackendSourceState = 'playing'
  private time: number
  private loop: boolean
  private rate: number
  private endedHandlers: Array<() => void> = []

  constructor(private readonly buffer: BackendBuffer, startAtSeconds: number, loop: boolean, rate: number) {
    this.time = startAtSeconds
    this.loop = loop
    this.rate = rate
  }

  currentTimeSeconds(): number {
    return this.time
  }

  pause(): void {
    if (this.state === 'playing') this.state = 'paused'
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'playing'
  }

  stop(): void {
    if (this.state === 'stopped' || this.state === 'ended') return
    this.state = 'stopped'
  }

  seek(timeSeconds: number): void {
    this.time = Math.max(0, timeSeconds)
  }

  setLoop(loop: boolean): void {
    this.loop = loop
  }

  setRate(rate: number): void {
    this.rate = rate
  }

  onEnded(handler: () => void): void {
    this.endedHandlers.push(handler)
  }

  /** Test-only: advances the manual clock and fires end/loop as real playback would. */
  advance(deltaSeconds: number): void {
    if (this.state !== 'playing') return
    this.time += deltaSeconds * this.rate
    if (this.time < this.buffer.durationSeconds) return
    if (this.loop) {
      this.time = this.time % this.buffer.durationSeconds
      return
    }
    this.time = this.buffer.durationSeconds
    this.state = 'ended'
    for (const handler of [...this.endedHandlers]) handler()
  }
}

export interface FakeAudioBackendOptions {
  /** Duration returned by `decode()`/`decodeBytes()` when nothing more specific matches. Default 1s. */
  defaultDurationSeconds?: number
  /** Per-URL durations, for tests that care about a specific length. */
  durations?: Record<string, number>
  /** Make `decode()` reject for these URLs, to test the error path. */
  failUrls?: string[]
  /** Make `decodeBytes()` reject, to test the tier-B decode error path. */
  failDecodeBytes?: boolean
}

/**
 * Every unit test uses this. `advanceAll(dt)` steps every live source's clock
 * so tests can assert on `ended`, loop wraparound and caption/marker timing
 * without real time passing.
 */
export class FakeAudioBackend implements AudioBackend {
  state: AudioContextState = 'suspended'
  readonly decodeCalls: string[] = []
  decodeBytesCallCount = 0
  private readonly sources = new Set<FakeSource>()

  constructor(private readonly options: FakeAudioBackendOptions = {}) {}

  async resume(): Promise<void> {
    this.state = 'running'
  }

  createGain(): BackendGain {
    return new FakeGain()
  }

  connectToDestination(): void {
    // No graph to build; FakeGain already terminates the chain.
  }

  async decode(url: string): Promise<BackendBuffer> {
    this.decodeCalls.push(url)
    if (this.options.failUrls?.includes(url)) {
      throw new Error(`FakeAudioBackend: decode failed for "${url}"`)
    }
    const durationSeconds = this.options.durations?.[url] ?? this.options.defaultDurationSeconds ?? 1
    return { durationSeconds }
  }

  async decodeBytes(_data: ArrayBuffer): Promise<BackendBuffer> {
    this.decodeBytesCallCount += 1
    if (this.options.failDecodeBytes) {
      throw new Error('FakeAudioBackend: decodeBytes failed')
    }
    return { durationSeconds: this.options.defaultDurationSeconds ?? 1 }
  }

  createSource(options: CreateSourceOptions): BackendSource {
    const source = new FakeSource(options.buffer, options.startAtSeconds ?? 0, options.loop ?? false, options.rate ?? 1)
    this.sources.add(source)
    return source
  }

  /** Test-only: steps every currently playing source's clock by `deltaSeconds`. */
  advanceAll(deltaSeconds: number): void {
    for (const source of this.sources) source.advance(deltaSeconds)
  }

  dispose(): void {
    this.state = 'closed'
    this.sources.clear()
  }
}
