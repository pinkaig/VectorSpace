/**
 * @file        RuntimeState.ts
 * @brief       Per-run state for a play session, never persisted.
 *
 * @responsibility
 * Holds what a running session has accumulated — zones already visited, the
 * scene currently showing, and open per-run scratch data — so rules can depend
 * on run history without any of it reaching ProjectData.
 *
 * @ownership
 * Owns session-lifetime state only. It is created when a play session starts and
 * discarded by resetRuntime(); it is never written back into ProjectData, never
 * serialized, and never enters the sync queue. A visitor session therefore leaves
 * no trace through this path. See the persistence/security boundary section of
 * the subsystem guide.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */

export interface RuntimeState {
  /** Zone ids entered at least once this run; survives zone exit. */
  visitedZones: Set<string>
  currentSceneId: string
  /** Open scratch space for action executors; shape is the executor's business. */
  runtimeData?: Record<string, unknown>
}

/** A fresh state for the start of a run. Callers must not reuse one across a reset. */
export const createRuntimeState = (currentSceneId: string): RuntimeState => ({
  visitedZones: new Set<string>(),
  currentSceneId,
})

/**
 * A value-copy used by dispatch() to build `nextState` without mutating its
 * input. The Set is rebuilt rather than shared so a caller holding the previous
 * state never observes a later dispatch's writes.
 */
export const cloneRuntimeState = (state: RuntimeState): RuntimeState => ({
  visitedZones: new Set(state.visitedZones),
  currentSceneId: state.currentSceneId,
  ...(state.runtimeData === undefined ? {} : { runtimeData: { ...state.runtimeData } }),
})
