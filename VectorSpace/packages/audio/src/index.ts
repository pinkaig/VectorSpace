/**
 * @file        index.ts
 * @brief       Public entry point for the audio subsystem.
 *
 * @responsibility
 * Re-exports the facade, backend implementations, and action wiring. This
 * file is the package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports do
 * not resolve. Anything consumers need must be re-exported here.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System
 * Links point at the project wiki; migration is still in progress.
 */
export { AudioSystem, type PlayRequest, type VoiceSelector, type AudioSystemOptions } from './AudioSystem'
export { AudioAssetLibrary, type ResolvedPlaySettings, type PlayOverrides } from './AudioAssetLibrary'
export type { AudioResolver, ResolvedAudio } from './AudioResolver'
export { AudioVoice, type VoiceState, type VoiceStatus } from './AudioVoice'
export { AudioStateStore, type AudioSnapshot, type ChannelState, type AudioStateListener } from './AudioStateStore'

export type {
  AudioBackend,
  AudioContextState,
  BackendBuffer,
  BackendGain,
  BackendSource,
  BackendSourceState,
  CreateSourceOptions,
} from './backend/AudioBackend'
export { FakeAudioBackend, type FakeAudioBackendOptions } from './backend/FakeAudioBackend'
export { WebAudioBackend } from './backend/WebAudioBackend'

export {
  CueBank,
  validateCueMap,
  type CueMap,
  type CueDef,
  type CueSound,
  type CuePick,
  type CuePlayEvent,
  type CuePlayOptions,
  type CueSoundSource,
  type CueBankOptions,
} from './cues/CueBank'

export { registerAudioActions } from './actions/registerAudioActions'
export {
  playAudioAction,
  stopAudioAction,
  pauseAudioAction,
  resumeAudioAction,
  setChannelVolumeAction,
  setMasterVolumeAction,
  audioRule,
  type PlayAudioOptions,
  type AudioVoiceSelector,
  type AudioRuleOptions,
} from './actions/audioActionBuilders'
