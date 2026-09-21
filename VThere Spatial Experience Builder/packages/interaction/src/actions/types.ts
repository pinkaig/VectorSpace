/**
 * @file        types.ts
 * @brief       The DO half of the contract: what an action is, and how one runs.
 *
 * @responsibility
 * Defines the vocabulary-free action shape rules carry, and the executor
 * signature the registry dispatches to. Contains no action implementations —
 * showPanel/playAudio/navigateScene are a separate, pluggable concern.
 *
 * @ownership
 * Owns the action *shape* and the executor *signature*. It does not own which
 * action kinds exist, nor what any of them do.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */
import type { ActionSpec } from '@vthere/project'
import type { RuntimeState } from '../RuntimeState'
import type { EffectRegistry } from './registry'

/**
 * One action a rule asks for: `{ kind, params? }`. Defined in @vthere/project
 * because rules are persisted data, and re-exported here so executors import it
 * from the subsystem that runs them.
 */
export type { ActionSpec }

/**
 * What an executor is handed. Deliberately does not include ProjectData: an
 * action must never edit the project while a session is live, and withholding it
 * makes that boundary structural rather than a rule someone has to remember.
 */
export interface ActionContext {
  state: RuntimeState
  /**
   * Where a non-scene side effect (an open panel, a playing audio element) must
   * register its disposer. An effect created outside this registry leaks across
   * resetRuntime() — the known bug class for this subsystem.
   */
  effects: EffectRegistry
}

/**
 * Applies one action. Returns the next state; returning the same value unchanged
 * is fine for an action with no state consequence.
 */
export type ActionExecutor = (
  action: ActionSpec,
  context: ActionContext,
) => RuntimeState | Promise<RuntimeState>
