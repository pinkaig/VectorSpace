/**
 * @file        WebAudioBackend.ts
 * @brief       Real Web Audio API implementation of AudioBackend.
 *
 * @responsibility
 * Wraps a single `AudioContext`: buffer decode via `fetch` + `decodeAudioData`,
 * gain nodes with ramped changes, and `AudioBufferSourceNode` playback. Not
 * unit-tested directly (jsdom has no `AudioContext`); verified manually.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md
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

const RAMP_SECONDS = 0.02

class WebGain implements BackendGain {
  readonly node: GainNode

  constructor(context: AudioContext) {
    this.node = context.createGain()
  }

  setValue(value: number, rampSeconds: number = RAMP_SECONDS): void {
    const context = this.node.context
    const param = this.node.gain
    param.cancelScheduledValues(context.currentTime)
    if (rampSeconds <= 0) {
      param.setValueAtTime(value, context.currentTime)
    } else {
      param.setTargetAtTime(value, context.currentTime, rampSeconds)
    }
  }

  getValue(): number {
    return this.node.gain.value
  }

  connect(target: BackendGain): void {
    if (target instanceof WebGain) this.node.connect(target.node)
  }

  disconnect(): void {
    this.node.disconnect()
  }
}

class WebBuffer implements BackendBuffer {
  constructor(readonly raw: AudioBuffer) {}

  get durationSeconds(): number {
    return this.raw.duration
  }
}

class WebSource implements BackendSource {
  state: BackendSourceState = 'playing'
  private node: AudioBufferSourceNode
  private readonly context: AudioContext
  private readonly buffer: AudioBuffer
  private readonly destination: GainNode
  private startedAtContextTime: number
  private offsetSeconds: number
  private loop: boolean
  private rate: number
  private endedHandlers: Array<() => void> = []
  private pausedAtSeconds = 0

  constructor(context: AudioContext, buffer: AudioBuffer, destination: GainNode, startAtSeconds: number, loop: boolean, rate: number) {
    this.context = context
    this.buffer = buffer
    this.destination = destination
    this.offsetSeconds = startAtSeconds
    this.loop = loop
    this.rate = rate
    this.node = this.createNode(startAtSeconds)
    this.startedAtContextTime = context.currentTime
  }

  private createNode(offsetSeconds: number): AudioBufferSourceNode {
    const node = this.context.createBufferSource()
    node.buffer = this.buffer
    node.loop = this.loop
    node.playbackRate.value = this.rate
    node.connect(this.destination)
    node.onended = () => {
      if (this.state !== 'stopped') {
        this.state = 'ended'
        for (const handler of [...this.endedHandlers]) handler()
      }
    }
    node.start(0, offsetSeconds)
    return node
  }

  currentTimeSeconds(): number {
    if (this.state === 'paused') return this.pausedAtSeconds
    const elapsed = (this.context.currentTime - this.startedAtContextTime) * this.rate
    return this.offsetSeconds + elapsed
  }

  pause(): void {
    if (this.state !== 'playing') return
    this.pausedAtSeconds = this.currentTimeSeconds()
    this.node.onended = null
    this.node.stop()
    this.state = 'paused'
  }

  resume(): void {
    if (this.state !== 'paused') return
    this.offsetSeconds = this.pausedAtSeconds
    this.node = this.createNode(this.offsetSeconds)
    this.startedAtContextTime = this.context.currentTime
    this.state = 'playing'
  }

  stop(): void {
    if (this.state === 'stopped' || this.state === 'ended') return
    this.node.onended = null
    try {
      this.node.stop()
    } catch {
      // Already stopped by the browser; nothing to clean up.
    }
    this.state = 'stopped'
  }

  seek(timeSeconds: number): void {
    // AudioBufferSourceNode cannot seek in place; recreate at the new offset.
    const wasPlaying = this.state === 'playing'
    this.node.onended = null
    try {
      this.node.stop()
    } catch {
      // Already stopped.
    }
    this.offsetSeconds = Math.max(0, Math.min(timeSeconds, this.buffer.duration))
    if (wasPlaying) {
      this.node = this.createNode(this.offsetSeconds)
      this.startedAtContextTime = this.context.currentTime
      this.state = 'playing'
    } else {
      this.pausedAtSeconds = this.offsetSeconds
      this.state = 'paused'
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop
    this.node.loop = loop
  }

  setRate(rate: number): void {
    this.rate = rate
    this.node.playbackRate.value = rate
  }

  onEnded(handler: () => void): void {
    this.endedHandlers.push(handler)
  }
}

export class WebAudioBackend implements AudioBackend {
  private context: AudioContext

  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.context = new Ctor()
  }

  get state(): AudioContextState {
    return this.context.state as AudioContextState
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume()
  }

  createGain(): BackendGain {
    return new WebGain(this.context)
  }

  connectToDestination(gain: BackendGain): void {
    if (gain instanceof WebGain) gain.node.connect(this.context.destination)
  }

  async decode(url: string): Promise<BackendBuffer> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch audio "${url}": ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    return this.decodeBytes(arrayBuffer)
  }

  async decodeBytes(data: ArrayBuffer): Promise<BackendBuffer> {
    const audioBuffer = await this.context.decodeAudioData(data)
    return new WebBuffer(audioBuffer)
  }

  createSource(options: CreateSourceOptions): BackendSource {
    if (!(options.buffer instanceof WebBuffer)) throw new Error('WebAudioBackend received a buffer it did not decode')
    if (!(options.destination instanceof WebGain)) throw new Error('WebAudioBackend received a gain it did not create')
    return new WebSource(this.context, options.buffer.raw, options.destination.node, options.startAtSeconds ?? 0, options.loop ?? false, options.rate ?? 1)
  }

  dispose(): void {
    void this.context.close()
  }
}
