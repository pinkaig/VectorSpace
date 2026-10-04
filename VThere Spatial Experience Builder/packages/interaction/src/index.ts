/**
 * @file        index.ts
 * @brief       Public entry point for the WHEN→DO interaction package.
 *
 * @responsibility
 * Re-exports the event/state/rule/result types, the pure dispatcher, the action
 * registries, the zone tracker, the action sequencer, and resetRuntime(). This
 * file is the package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports such as
 * `@vthere/interaction/dispatcher` do not resolve. Anything consumers need must
 * be re-exported here.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
export type { RuntimeEvent } from './RuntimeEvent'

export type { RuntimeState } from './RuntimeState'
export { createRuntimeState, cloneRuntimeState } from './RuntimeState'

export type { InteractionRule } from './InteractionRule'
export type { DispatchResult } from './DispatchResult'

export { dispatch } from './dispatcher'

export type { ActionSpec, ActionContext, ActionExecutor } from './actions/types'
export type {
  ActionRegistry,
  EffectRegistry,
  EffectHandle,
  EffectDisposer,
} from './actions/registry'
export { createActionRegistry, createEffectRegistry } from './actions/registry'

export type { ZoneTracker, ZoneOccupant, Vector3Tuple } from './zoneTracker'
export { createZoneTracker } from './zoneTracker'

export type {
  ActionSequencer,
  ActionGenerator,
  SequenceHandle,
  WaitSeconds,
  Yieldable,
} from './ActionSequencer'
export { createActionSequencer, waitSeconds } from './ActionSequencer'

export type { RuntimeSession, ResetRuntimeOptions } from './resetRuntime'
export { resetRuntime } from './resetRuntime'
