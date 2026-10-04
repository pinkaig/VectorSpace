/**
 * @file        registry.ts
 * @brief       Pluggable action-kind → executor map, and the effect registry
 *              resetRuntime() walks to dispose non-scene side effects.
 *
 * @responsibility
 * Two small registries that together keep the dispatcher vocabulary-free and
 * keep a run tearable-down: one resolves an action kind to its executor, the
 * other tracks every side effect that reconciliation cannot undo.
 *
 * @ownership
 * Owns registration and lookup. It owns no executor implementations, and it
 * never decides when a reset happens — resetRuntime() does.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { ActionContext, ActionExecutor, ActionSpec } from './types'
import type { RuntimeState } from '../RuntimeState'

/**
 * Registering a new action kind is the *only* step needed to support it — no
 * dispatcher change, which is this subsystem's stated acceptance test.
 */
export interface ActionRegistry {
  register(kind: string, executor: ActionExecutor): void
  has(kind: string): boolean
  /**
   * Runs one action. An unregistered kind is a no-op returning the state
   * unchanged: rules outlive the app version that can execute them (a project
   * saved with a newer vocabulary must still open), so an unknown kind is a
   * skip, not a crash.
   */
  execute(action: ActionSpec, context: ActionContext): Promise<RuntimeState>
}

export const createActionRegistry = (): ActionRegistry => {
  const executors = new Map<string, ActionExecutor>()

  return {
    register(kind, executor) {
      executors.set(kind, executor)
    },
    has(kind) {
      return executors.has(kind)
    },
    async execute(action, context) {
      const executor = executors.get(action.kind)
      if (!executor) return context.state
      return executor(action, context)
    },
  }
}

/** Undoes one side effect: close the panel, stop and release the audio element. */
export type EffectDisposer = () => void

export interface EffectHandle {
  readonly id: number
}

/**
 * Tracks side effects living outside the Three.js scene graph. Scene mutations
 * need no entry here — ProjectData is never touched during a run, so
 * syncObjects() reconciliation restores the visuals for free. Anything else
 * (an open panel, a playing sound) is invisible to that reconciliation and
 * leaks across a reset unless it is registered here.
 */
export interface EffectRegistry {
  /** Registers a disposer and returns its handle. The only way to create an effect. */
  add(dispose: EffectDisposer): EffectHandle
  /** Disposes one effect early — when a panel closes itself, say. */
  dispose(handle: EffectHandle): void
  /** Disposes everything, newest first. Called by resetRuntime(). */
  disposeAll(): void
  readonly size: number
}

export const createEffectRegistry = (): EffectRegistry => {
  const disposers = new Map<number, EffectDisposer>()
  let nextId = 0

  const disposeOne = (id: number) => {
    const dispose = disposers.get(id)
    if (!dispose) return
    disposers.delete(id)
    // One panel that throws on close must not strand every other effect.
    try {
      dispose()
    } catch (error) {
      console.error('[interaction] effect disposer threw', error)
    }
  }

  return {
    add(dispose) {
      const id = nextId++
      disposers.set(id, dispose)
      return { id }
    },
    dispose(handle) {
      disposeOne(handle.id)
    },
    disposeAll() {
      // Newest first, so an effect layered over another tears down in the
      // reverse of the order it was built up.
      for (const id of [...disposers.keys()].reverse()) disposeOne(id)
    },
    get size() {
      return disposers.size
    },
  }
}
