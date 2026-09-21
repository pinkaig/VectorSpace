/**
 * @file        resetRuntime.ts
 * @brief       The one teardown shared by "exit play mode" and "restart scene".
 *
 * @responsibility
 * Stops all sequencing, discards runtime state, disposes registered non-scene
 * side effects, and — on a restart — arms a fresh run. Both exit paths use this
 * single function so neither can drift into a partial reset.
 *
 * @inputs
 * The live session handles (sequencer, effect registry, zone tracker) and
 * whether this reset is a restart or a return to edit mode.
 *
 * @outputs
 * A fresh RuntimeState when restarting, or null when exiting to edit mode.
 *
 * @ownership
 * Owns teardown order. It does not own the visual reset: ProjectData is never
 * mutated during a run, so syncObjects() reconciliation redraws the scene from
 * the untouched snapshot for free. That is why DO actions must mutate Three.js
 * imperatively and never commit through the CommandTimeline.
 *
 * @testing
 * Covered by resetRuntime.test.ts for sequencer stop, effect disposal, zone
 * re-arming, and state discard vs. recreation.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */
import type { ActionSequencer } from './ActionSequencer'
import type { EffectRegistry } from './actions/registry'
import { createRuntimeState, type RuntimeState } from './RuntimeState'
import type { ZoneTracker } from './zoneTracker'

export interface RuntimeSession {
  sequencer: ActionSequencer
  effects: EffectRegistry
  /** Optional: a scene with no zones needs no tracker. */
  zones?: ZoneTracker
}

export interface ResetRuntimeOptions {
  /**
   * True to immediately arm a fresh run ("restart scene"), false to tear down
   * and return to edit mode ("exit play mode").
   */
  restart: boolean
  /** Required when restarting, to seed the new state. */
  sceneId?: string
}

/**
 * Steps follow the design doc exactly:
 *   1. stop all Tier-3 sequencing
 *   2. dispose registered non-scene side effects
 *   3. re-arm zone occupancy so a restart re-fires enters
 *   4. discard RuntimeState — never merged or carried across a reset
 *   5. on restart only, create a fresh state
 *
 * The caller is responsible for the two things that live outside this package:
 * forcing a syncObjects() rebuild (bump syncToken) and re-firing sceneStart
 * through dispatch() with the returned state.
 */
export const resetRuntime = (
  session: RuntimeSession,
  options: ResetRuntimeOptions,
): RuntimeState | null => {
  session.sequencer.stopAll()

  // Anything outside the Three.js scene graph — an open panel, a playing audio
  // element — is invisible to syncObjects() reconciliation and leaks unless it
  // was registered here. This is the subsystem's known bug class.
  session.effects.disposeAll()

  // Without this, a visitor standing inside a zone at restart would never get a
  // fresh zoneEnter, because the tracker would still believe they were inside.
  session.zones?.reset()

  if (!options.restart) return null

  if (options.sceneId === undefined) {
    throw new Error('resetRuntime({ restart: true }) requires a sceneId to seed the new state')
  }
  return createRuntimeState(options.sceneId)
}
