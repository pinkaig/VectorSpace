/**
 * @file        ActionSequencer.ts
 * @brief       Tier 3: generator-based sequencing for DO actions with duration.
 *
 * @responsibility
 * Runs actions that cannot finish in one call — fades, delays, typewriter
 * dialogue — as JS generators ticked once per RAF frame, so the pure dispatcher
 * stays free of timing and async concerns.
 *
 * @inputs
 * Generator functions started by an action executor, and a per-frame delta in
 * seconds supplied by the render loop.
 *
 * @outputs
 * Side effects performed by the generators themselves; the sequencer reports
 * only whether a sequence is still running.
 *
 * @ownership
 * Owns the running-sequence list and its ticking. It does not own the clock (the
 * caller's delta is authoritative), nor what any sequence does.
 *
 * @reference
 * Ported from docs/07-research-and-history/Scripting_Logic_Interactive System_
 * for when do/CoroutineManager.cs. Carried over: the staging list so a sequence
 * started during a tick joins on the next one rather than mutating the list being
 * iterated; reverse iteration when removing; and per-sequence try/catch so one
 * throwing sequence cannot kill the tick. Dropped: the singleton, and the custom
 * Time.time clock, which worked around a Mono limitation that has no equivalent
 * in JS — waitSeconds accumulates the loop's own delta instead.
 *
 * @testing
 * Covered by ActionSequencer.test.ts with plain generators, no real actions.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/when-do-dispatch-engine.md
 */

/** What a sequence may yield to suspend itself. */
export interface WaitSeconds {
  readonly kind: 'waitSeconds'
  /** Seconds still to elapse; decremented by each tick's delta. */
  remaining: number
}

/** Yielding anything else (or undefined) resumes on the next frame. */
export type Yieldable = WaitSeconds | undefined | void

export type ActionGenerator = Generator<Yieldable, void, unknown>

/** Opaque handle identifying one started sequence. */
export interface SequenceHandle {
  readonly id: number
}

/**
 * Suspends a sequence for a duration: `yield waitSeconds(0.5)`. Time comes from
 * the render loop's accumulated delta, so a sequence cannot drift away from the
 * frames it is ticked by, and a paused tab does not silently burn its wait.
 */
export const waitSeconds = (seconds: number): WaitSeconds => ({
  kind: 'waitSeconds',
  remaining: Math.max(0, seconds),
})

const isWaitSeconds = (value: Yieldable): value is WaitSeconds =>
  !!value && typeof value === 'object' && (value as WaitSeconds).kind === 'waitSeconds'

/**
 * Ceiling on how many already-satisfied waits one sequence may chain within a
 * single frame. A rule author can write `while (true) yield waitSeconds(0)`,
 * which would otherwise spin forever inside one tick and hang the tab. Hitting
 * this parks the sequence until the next frame rather than killing it: the
 * content is pathological, not necessarily broken.
 */
const MAX_STEPS_PER_FRAME = 1000

export interface ActionSequencer {
  /** Starts a sequence. It first advances on the next tick, never immediately. */
  start(build: () => ActionGenerator): SequenceHandle
  stop(handle: SequenceHandle): void
  isRunning(handle: SequenceHandle): boolean
  /** Stops everything — the CoroutineManager.ClearCoroutines() equivalent. */
  stopAll(): void
  /** Advances every running sequence once. Called from the RAF loop. */
  tick(delta: number): void
  readonly runningCount: number
}

interface Entry {
  id: number
  generator: ActionGenerator
  /** The wait a sequence yielded, still counting down; null when runnable. */
  pending: WaitSeconds | null
}

export const createActionSequencer = (): ActionSequencer => {
  let entries: Entry[] = []
  // Sequences started during a tick stage here and join on the next one, so the
  // list being iterated is never mutated mid-pass.
  let incoming: Entry[] = []
  let nextId = 0

  const findEntry = (id: number): Entry | undefined =>
    entries.find((entry) => entry.id === id) ?? incoming.find((entry) => entry.id === id)

  const remove = (id: number) => {
    entries = entries.filter((entry) => entry.id !== id)
    incoming = incoming.filter((entry) => entry.id !== id)
  }

  return {
    start(build) {
      const id = nextId++
      // The generator is built now but not advanced: a sequence's first body
      // statement runs on the first tick, so starting one during a tick cannot
      // reenter the loop that started it.
      incoming.push({ id, generator: build(), pending: null })
      return { id }
    },

    stop(handle) {
      const entry = findEntry(handle.id)
      if (!entry) return
      // Let the generator run its own finally blocks so a sequence holding a
      // side effect can release it on an early stop.
      try {
        entry.generator.return(undefined)
      } catch (error) {
        console.error('[interaction] sequence threw while stopping', error)
      }
      remove(handle.id)
    },

    isRunning(handle) {
      return findEntry(handle.id) !== undefined
    },

    stopAll() {
      for (const entry of [...entries, ...incoming]) {
        try {
          entry.generator.return(undefined)
        } catch (error) {
          console.error('[interaction] sequence threw while stopping', error)
        }
      }
      entries = []
      incoming = []
    },

    tick(delta) {
      if (incoming.length > 0) {
        entries = entries.concat(incoming)
        incoming = []
      }
      if (entries.length === 0) return

      // Reverse iteration so removing a finished sequence cannot skip the next.
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]

        if (entry.pending) {
          entry.pending.remaining -= delta
          if (entry.pending.remaining > 0) continue
          entry.pending = null
        }

        try {
          // Loop rather than step once: a wait is charged against this frame's
          // delta at the moment it is yielded, so waitSeconds(0) resumes in the
          // same frame and a wait shorter than the frame does not cost a whole
          // extra one. Without this, every yielded wait silently gained a frame.
          let advancing = true
          let steps = 0
          while (advancing) {
            advancing = false
            if (steps++ >= MAX_STEPS_PER_FRAME) {
              console.error(
                '[interaction] sequence exceeded %d steps in one frame; parked until next frame',
                MAX_STEPS_PER_FRAME,
              )
              entry.pending = null
              break
            }
            const step = entry.generator.next()
            if (step.done) {
              remove(entry.id)
              break
            }
            if (!isWaitSeconds(step.value)) {
              // A bare yield always parks until the next frame.
              entry.pending = null
              break
            }
            const wait = step.value
            wait.remaining -= delta
            if (wait.remaining > 0) {
              entry.pending = wait
              break
            }
            // Already satisfied within this frame — keep going.
            entry.pending = null
            advancing = true
          }
        } catch (error) {
          // One bad sequence is dropped; the rest of the frame continues.
          console.error('[interaction] sequence threw and was stopped', error)
          remove(entry.id)
        }
      }
    },

    get runningCount() {
      return entries.length + incoming.length
    },
  }
}
