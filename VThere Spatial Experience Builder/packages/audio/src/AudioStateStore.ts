/**
 * @file        AudioStateStore.ts
 * @brief       Read/subscribe surface other systems use instead of touching voices directly.
 *
 * @responsibility
 * Holds a stable snapshot other code (UI, debug tools) can read via
 * `getSnapshot()` (stable object identity between changes, safe for
 * `useSyncExternalStore`) and `subscribe()`. `AudioSystem` calls `notify()`
 * after every state-affecting operation.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
import type { ChannelId } from '@vthere/project'
import type { AudioContextState } from './backend/AudioBackend'
import type { VoiceState } from './AudioVoice'

export interface ChannelState {
  id: ChannelId
  volume: number
  muted: boolean
  voiceCount: number
}

export interface AudioSnapshot {
  contextState: AudioContextState
  unlocked: boolean
  master: { volume: number; muted: boolean }
  channels: ChannelState[]
  voices: VoiceState[]
}

export type AudioStateListener = (snapshot: AudioSnapshot) => void

export class AudioStateStore {
  private snapshot: AudioSnapshot
  private readonly listeners = new Set<AudioStateListener>()

  constructor(initial: AudioSnapshot) {
    this.snapshot = initial
  }

  getSnapshot(): AudioSnapshot {
    return this.snapshot
  }

  subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Replaces the snapshot with a new object (new identity) and notifies subscribers. */
  update(next: AudioSnapshot): void {
    this.snapshot = next
    for (const listener of [...this.listeners]) listener(next)
  }

  isPlaying(assetId: string): boolean {
    return this.snapshot.voices.some((voice) => voice.assetId === assetId && voice.status === 'playing')
  }

  getVoice(id: string): VoiceState | undefined {
    return this.snapshot.voices.find((voice) => voice.id === id)
  }

  getVoicesByChannel(channel: ChannelId): VoiceState[] {
    return this.snapshot.voices.filter((voice) => voice.channel === channel)
  }

  getVoicesByAsset(assetId: string): VoiceState[] {
    return this.snapshot.voices.filter((voice) => voice.assetId === assetId)
  }
}
