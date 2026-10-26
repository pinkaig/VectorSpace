/**
 * @file        conditions.ts
 * @brief       The vocabulary bindings.json is written in: what to watch, and when a cue should fire.
 *
 * @responsibility
 * Reads values out of the mockup's render (its `state`, and the `vals` it
 * derives from state) and answers two questions: did a watched value just
 * change in the way a binding describes (an edge), and do a binding's extra
 * conditions hold. Pure functions over plain objects, so nothing here touches
 * the DOM or the audio system.
 *
 * Why state rather than DOM events for outcomes: the mockup rebuilds its whole
 * DOM on every change, so an element-level listener would be thrown away
 * moments after it was attached. Watching the state that drives the render is
 * the one signal that survives that, and it also fires for outcomes that have
 * no single element behind them (a popup opening, a brief to-do ticking off).
 */

export interface RenderContext {
  state: Record<string, unknown>
  /** Values the mockup computes from state for its template, such as `briefDone` or `playCardOpen`. */
  vals: Record<string, unknown>
}

/** An extra requirement on a binding. All the constraints present must hold together. */
export interface Cond {
  /** `state.x` or `vals.x`, with dots for nesting: `state.opt.vol`. */
  watch: string
  equals?: unknown
  in?: unknown[]
  notIn?: unknown[]
  /** Used when the value is undefined, because the mockup leaves some choices unset until first touched. */
  default?: unknown
  /** Test the previous render's value instead of the current one. */
  prev?: boolean
  /** Holds only if this value did not change in this render. */
  unchanged?: boolean
}

/** Maps a state choice to a loudness multiplier, e.g. Quiet / Normal / Loud. */
export interface VolumeBy {
  watch: string
  default: string
  map: Record<string, number>
}

export type BindingKind = 'click' | 'hover' | 'change' | 'key' | 'state' | 'while' | 'manual'

/** One row of "UI component -> cue": what the user does or what changes, and which cue it plays. */
export interface Binding {
  cue: string
  /** The component, in words, for the board and the brief. */
  component: string
  on: BindingKind
  /** click / hover / change: a CSS selector for the element (or an ancestor of what was touched). */
  selector?: string
  /** click / hover / change: regex the element's visible text must match. */
  text?: string
  /** click / hover / change: regex the element's aria-label must match. */
  aria?: string
  /** click / hover / change: a CSS selector the element, or something inside it, must match. */
  has?: string
  /** key: regex tested against KeyboardEvent.key. */
  keys?: string
  /** state: one path or several; the binding fires if any of them has the edge below. */
  watch?: string | string[]
  becomes?: unknown
  leaves?: unknown
  changes?: boolean
  increases?: boolean
  /** All must hold. For `while` bindings this is the whole definition of when the loop runs. */
  if?: Cond[]
  /** A state outcome normally replaces the click sound of the gesture that caused it; `layer` plays both. */
  layer?: boolean
  volumeBy?: VolumeBy
  /** while: fade the loop out over this long when its conditions stop holding. */
  fadeOutMs?: number
}

export function readPath(context: RenderContext | null, path: string): unknown {
  if (!context) return undefined
  const [root, ...keys] = path.split('.')
  let value: unknown = root === 'state' ? context.state : root === 'vals' ? context.vals : undefined
  for (const key of keys) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

// A boolean target means "truthy / falsy", so `becomes: true` fires for 'error' or 1 as well as for true.
const matches = (value: unknown, target: unknown): boolean => (typeof target === 'boolean' ? Boolean(value) === target : value === target)

export function condHolds(cond: Cond, now: RenderContext, before: RenderContext | null): boolean {
  if (cond.unchanged) return !before || Object.is(readPath(now, cond.watch), readPath(before, cond.watch))
  const context = cond.prev ? before : now
  if (!context) return false
  const raw = readPath(context, cond.watch)
  const value = raw === undefined ? cond.default : raw
  if ('equals' in cond && value !== cond.equals) return false
  if (cond.in && !cond.in.includes(value)) return false
  if (cond.notIn && cond.notIn.includes(value)) return false
  return true
}

export function allHold(conds: Cond[] | undefined, now: RenderContext, before: RenderContext | null): boolean {
  return (conds ?? []).every((cond) => condHolds(cond, now, before))
}

/** Did a `state` binding's watched value change in the way it describes between two renders? */
export function edgeFired(binding: Binding, now: RenderContext, before: RenderContext): boolean {
  const paths = Array.isArray(binding.watch) ? binding.watch : binding.watch ? [binding.watch] : []
  return paths.some((path) => {
    const current = readPath(now, path)
    const previous = readPath(before, path)
    if (binding.changes) return !Object.is(current, previous)
    // briefDone arrives as a string ('2'), so compare as numbers. NaN compares false, which is right for "was unset".
    if (binding.increases) return Number(current) > Number(previous)
    if (binding.becomes !== undefined) return matches(current, binding.becomes) && !matches(previous, binding.becomes)
    if (binding.leaves !== undefined) return matches(previous, binding.leaves) && !matches(current, binding.leaves)
    return false
  })
}

/** The multiplier a `volumeBy` picks from the current state; 1 when the binding has none. */
export function volumeGain(binding: Binding, context: RenderContext): number {
  const by = binding.volumeBy
  if (!by) return 1
  const raw = readPath(context, by.watch)
  return by.map[String(raw === undefined ? by.default : raw)] ?? 1
}
