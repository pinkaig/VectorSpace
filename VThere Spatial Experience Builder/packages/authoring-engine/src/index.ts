/**
 * @file        index.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Renderer-independent command timeline for editor history.
 *
 * @responsibility
 * Stores immutable past and future snapshots and provides commit, undo, and
 * redo operations without depending on React, Three.js, or persistence.
 *
 * @inputs
 * Generic state values, a clone function, labels, and a history limit.
 *
 * @outputs
 * CommandTimeline snapshots with current state and undo/redo capabilities.
 *
 * @members
 * HistoryEntry, CommandTimeline, createCommandTimeline, commit, undo, and redo.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/authoring-engine.md
 */
export interface HistoryEntry<T> {
  label: string
  state: T
}

export interface CommandTimeline<T> {
  readonly current: T
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly past: readonly HistoryEntry<T>[]
  readonly future: readonly HistoryEntry<T>[]
  commit(label: string, state: T): CommandTimeline<T>
  undo(): CommandTimeline<T>
  redo(): CommandTimeline<T>
}

export const createCommandTimeline = <T>(
  initialState: T,
  clone: (state: T) => T,
  limit = 40,
): CommandTimeline<T> => {
  const past: HistoryEntry<T>[] = []
  const future: HistoryEntry<T>[] = []
  let current = clone(initialState)

  const timeline: CommandTimeline<T> = {
    get current() { return clone(current) },
    get canUndo() { return past.length > 0 },
    get canRedo() { return future.length > 0 },
    get past() { return past.map((entry) => ({ ...entry, state: clone(entry.state) })) },
    get future() { return future.map((entry) => ({ ...entry, state: clone(entry.state) })) },
    commit(label, state) {
      past.push({ label, state: clone(current) })
      if (past.length > limit) past.shift()
      future.length = 0
      current = clone(state)
      return timeline
    },
    undo() {
      const entry = past.pop()
      if (!entry) return timeline
      future.push({ label: entry.label, state: clone(current) })
      current = clone(entry.state)
      return timeline
    },
    redo() {
      const entry = future.pop()
      if (!entry) return timeline
      past.push({ label: entry.label, state: clone(current) })
      current = clone(entry.state)
      return timeline
    },
  }

  return timeline
}