/**
 * @file        DispatchResult.ts
 * @brief       What dispatch() reports should happen — never what it did.
 *
 * @responsibility
 * Carries the matched rules, the actions to run in firing order, and the next
 * runtime state, so the caller can apply side effects while dispatch() itself
 * stays pure.
 *
 * @ownership
 * Owns the result shape. It does not own execution: `actions` is a list to run,
 * and nothing in the dispatcher has run any of it.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */
import type { ActionSpec } from './actions/types'
import type { InteractionRule } from './InteractionRule'
import type { RuntimeState } from './RuntimeState'

export interface DispatchResult {
  /** Rules that matched, in the order they fire. */
  rulesMatched: InteractionRule[]
  /**
   * Actions to execute, flattened across matched rules in firing order.
   * Named for what the caller does with it — dispatch() executes nothing.
   */
  actions: ActionSpec[]
  /** A new value; the state passed to dispatch() is never mutated. */
  nextState: RuntimeState
}
