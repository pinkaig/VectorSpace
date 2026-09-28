/**
 * @file        dispatcher.ts
 * @brief       The pure WHEN→DO core: one event in, an ordered action list out.
 *
 * @responsibility
 * Matches an event against the authored rules, resolves firing order
 * deterministically, records what the event changed about the run, and returns
 * the actions the caller should execute.
 *
 * @inputs
 * One RuntimeEvent, the authored rules, the project snapshot, and current state.
 *
 * @outputs
 * A DispatchResult: matched rules, actions to run in firing order, and a new
 * RuntimeState value.
 *
 * @ownership
 * Owns matching and ordering, nothing else. It performs no I/O, touches no DOM,
 * no Three.js, and no audio, and it executes no action — which is what makes it
 * testable against fixtures alone and unable to leak anything.
 *
 * @testing
 * Covered by dispatcher.test.ts for trigger/object/zone matching, authoring and
 * priority order, state immutability, and vocabulary independence.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */
import type { ProjectData } from '@vthere/project'
import type { ActionSpec } from './actions/types'
import type { DispatchResult } from './DispatchResult'
import type { InteractionRule } from './InteractionRule'
import type { RuntimeEvent } from './RuntimeEvent'
import { cloneRuntimeState, type RuntimeState } from './RuntimeState'

/**
 * A rule matches when the event's kind is one of its triggers and neither of its
 * address fields contradicts the event. An absent objectId/zoneId on the rule is
 * a wildcard, which is what lets a lifecycle rule such as sceneStart — which
 * names no object — match at all.
 */
const matches = (rule: InteractionRule, event: RuntimeEvent): boolean => {
  if (!rule.triggers.includes(event.kind)) return false
  if (rule.objectId !== undefined && rule.objectId !== event.objectId) return false
  if (rule.zoneId !== undefined && rule.zoneId !== event.zoneId) return false
  return true
}

export const dispatch = (
  event: RuntimeEvent,
  rules: readonly InteractionRule[],
  project: ProjectData,
  state: RuntimeState,
): DispatchResult => {
  // Built up front so every exit path returns a new value and no caller can
  // observe a later dispatch writing through a state it already holds.
  const nextState = cloneRuntimeState(state)

  // Entering a zone is remembered even when no rule answers for it: a later rule
  // may ask whether a zone was ever visited, and that history must not depend on
  // whether a rule happened to match at the moment of entry.
  if (event.kind === 'zoneEnter' && event.zoneId !== undefined) {
    nextState.visitedZones.add(event.zoneId)
  }

  const matched = rules.filter((rule) => matches(rule, event))

  // Priority first, then authoring order. `sort` is stable in ES2019+, so
  // equal-priority rules keep their array order — the guarantee the design docs
  // name. Sorting a copy keeps the caller's rules array untouched.
  const ordered = [...matched].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const actions: ActionSpec[] = []
  for (const rule of ordered) actions.push(...rule.actions)

  // `project` is read-only context for matching. It is deliberately never
  // written: the whole "visual reset is free" property depends on ProjectData
  // being untouched for the life of a play session.
  void project

  return { rulesMatched: ordered, actions, nextState }
}
