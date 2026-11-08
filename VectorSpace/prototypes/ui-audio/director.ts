/**
 * @file        director.ts
 * @brief       Listens to the mockup and plays the cue each interaction is bound to.
 *
 * @responsibility
 * The throwaway half of the sound layer: it knows the mockup's DOM and render
 * loop, and nothing about audio beyond `CueBank.play`. Everything it decides
 * comes from bindings.json.
 *
 * Three kinds of trigger, because the mockup gives three kinds of signal:
 * - Pointer and key events, caught once on `document`. The mockup rebuilds its
 *   whole DOM on every state change, so per-element listeners would be lost
 *   immediately; a delegated listener plus `closest()` is the only thing that
 *   survives.
 * - State edges (a popup opening, a to-do ticking off), read by wrapping the
 *   mockup's own `renderVals()`; see conditions.ts for why.
 * - `while` loops (room music): started when their conditions become true,
 *   faded out when they stop, re-levelled when Quiet/Normal/Loud changes.
 *
 * One gesture should make one sound. A click is held for a tick; if the render
 * it causes fires an outcome cue (the drop thud, the error bonk), that outcome
 * replaces the button's click rather than stacking on it. Bindings that want
 * both say `layer: true`.
 */
import type { AudioSystem, CueBank } from '../../packages/audio/src/index'
import { allHold, edgeFired, readPath, volumeGain, type Binding, type BindingKind, type RenderContext } from './conditions'
import { INTERACTIVE, labelOf } from './surfaces'

interface Match {
  binding: Binding
  element: Element
}

interface Gesture {
  match: Match
  replaced: boolean
}

interface Patterns {
  text?: RegExp
  aria?: RegExp
  keys?: RegExp
}

/** A re-render replaces the element under a still pointer, which the browser reports as a fresh hover. */
const HOVER_QUIET_AFTER_RENDER_MS = 150

/** What caused a sound (or the lack of one), for the board's "just played" list and the probe frame. */
export interface TraceEvent {
  /** Null when a click landed on something that makes no sound. */
  cueId: string | null
  trigger: BindingKind | 'preview'
  /** The control's label, the key pressed, or the state value that changed. */
  detail: string
}

export class UiSoundDirector {
  enabled = true
  hoverEnabled = true
  /** Works out what would play and reports it, but makes no sound. The probe frame runs like this. */
  dryRun = false
  /** Elements the mockup gave a click handler (see trackHandlers), so non-button click areas count as controls. */
  tracked: Set<Element> | null = null

  private readonly clickBindings: Binding[]
  private readonly hoverBindings: Binding[]
  private readonly changeBindings: Binding[]
  private readonly keyBindings: Binding[]
  private readonly stateBindings: Binding[]
  private readonly loopBindings: Binding[]
  private readonly patterns = new Map<Binding, Patterns>()
  private readonly loops = new Map<Binding, number>()
  private current: RenderContext | null = null
  private gesture: Gesture | null = null
  private hoverElement: Element | null = null
  private lastRenderAt = Number.NEGATIVE_INFINITY
  private instance: { state: Record<string, unknown> } | null = null
  private readonly traceListeners = new Set<(event: TraceEvent) => void>()
  private readonly renderListeners = new Set<(context: RenderContext) => void>()

  constructor(
    private readonly bank: CueBank,
    private readonly system: AudioSystem,
    readonly bindings: Binding[],
    private readonly root: HTMLElement,
  ) {
    const of = (kind: Binding['on']) => bindings.filter((binding) => binding.on === kind)
    this.clickBindings = of('click')
    this.hoverBindings = of('hover')
    this.changeBindings = of('change')
    this.keyBindings = of('key')
    this.stateBindings = of('state')
    this.loopBindings = of('while')
    for (const binding of bindings) {
      this.patterns.set(binding, {
        text: binding.text ? new RegExp(binding.text) : undefined,
        aria: binding.aria ? new RegExp(binding.aria) : undefined,
        keys: binding.keys ? new RegExp(binding.keys, 'i') : undefined,
      })
    }
  }

  /** Attaches the listeners. Call after the mockup's own script has run, since it patches that script's Component. */
  start(component: { prototype: { renderVals(): Record<string, unknown> } }): void {
    if (!this.dryRun) {
      const unlock = () => void this.system.unlock()
      // Browsers keep the AudioContext suspended until a gesture; the same trick Viewport.tsx uses.
      document.addEventListener('pointerdown', unlock, true)
      document.addEventListener('keydown', unlock, true)
      document.addEventListener('click', unlock, true)
    }
    document.addEventListener('click', (event) => this.onClick(event), true)
    document.addEventListener('mouseover', (event) => this.onHover(event), true)
    document.addEventListener('change', (event) => this.onChange(event), true)
    document.addEventListener('keydown', (event) => this.onKey(event), true)

    const onRender = (context: RenderContext) => this.onRender(context)
    const original = component.prototype.renderVals
    // The patched method needs both `this`es: the director's, and the component instance it runs on.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const director = this
    component.prototype.renderVals = function (this: { state: Record<string, unknown> }) {
      director.instance = this
      const vals = original.call(this)
      onRender({ state: this.state, vals })
      return vals
    }
    // The mockup has already rendered once, unseen. Ask it to render again (same state, so nothing changes on
    // screen) so the first render we do see is a baseline, not mistaken for the user's first change.
    ;(window as unknown as { schedule?: () => void }).schedule?.()
  }

  /** Plays a cue by name, as the board's preview buttons and the console do. */
  preview(cueId: string): void {
    const binding = this.bindings.find((candidate) => candidate.cue === cueId && candidate.on === 'while')
    const gain = binding && this.current ? volumeGain(binding, this.current) : 1
    this.emit({ cueId, trigger: 'preview', detail: 'board' })
    void this.system.unlock().then(() => this.bank.play(cueId, { gain }))
  }

  onTrace(listener: (event: TraceEvent) => void): () => void {
    this.traceListeners.add(listener)
    return () => this.traceListeners.delete(listener)
  }

  /** Called after every render of the mockup, with the state it rendered. */
  watchRenders(listener: (context: RenderContext) => void): () => void {
    this.renderListeners.add(listener)
    return () => this.renderListeners.delete(listener)
  }

  /** The state the mockup last rendered, or null before the first render. */
  get state(): Record<string, unknown> | null {
    return this.current?.state ?? null
  }

  /** Puts the mockup in a state and re-renders it. The probe frame uses this to stand in the same place as the live page. */
  loadState(state: Record<string, unknown>): void {
    if (!this.instance) return
    this.instance.state = structuredClone(state)
    ;(window as unknown as { schedule?: () => void }).schedule?.()
  }

  private emit(event: TraceEvent): void {
    for (const listener of [...this.traceListeners]) listener(event)
  }

  /** The cue every unclaimed button falls through to (the last click binding), so the overlay can mute it and show only what is specific. */
  get fallbackCue(): string | null {
    return this.clickBindings.at(-1)?.cue ?? null
  }

  /** Every selector a click binding names, joined, so the survey also counts elements only a binding knows about. */
  get clickSelector(): string {
    return [...new Set(this.clickBindings.flatMap((binding) => (binding.selector ? [binding.selector] : [])))].join(', ')
  }

  bindingsFor(cueId: string): Binding[] {
    return this.bindings.filter((binding) => binding.cue === cueId)
  }

  /** What a click or menu change on this element, and a hover over it, would play according to the binding table alone. */
  predict(element: Element): { click: Match | null; hover: Match | null } {
    return {
      click: this.match(this.clickBindings, element) ?? this.match(this.changeBindings, element),
      hover: this.match(this.hoverBindings, element),
    }
  }

  private match(candidates: Binding[], target: Element): Match | null {
    for (const binding of candidates) {
      if (!binding.selector) continue
      const element = target.closest(binding.selector)
      if (!element || !this.passes(binding, element)) continue
      return { binding, element }
    }
    return null
  }

  private passes(binding: Binding, element: Element): boolean {
    const patterns = this.patterns.get(binding)
    if (patterns?.text && !patterns.text.test((element.textContent ?? '').replace(/\s+/g, ' ').trim())) return false
    if (patterns?.aria && !patterns.aria.test(element.getAttribute('aria-label') ?? '')) return false
    if (binding.has && !element.matches(binding.has) && !element.querySelector(binding.has)) return false
    return !this.current || allHold(binding.if, this.current, null)
  }

  /** Pointer events on the sound board are not the product's: auditioning a cue must not also play a button click. */
  private inApp(target: EventTarget | null): target is Element {
    return target instanceof Element && this.root.contains(target)
  }

  private onClick(event: MouseEvent): void {
    if (!this.enabled || !this.inApp(event.target)) return
    const match = this.match(this.clickBindings, event.target)
    if (!match) {
      // A control that was clicked and plays nothing is worth a line in the debug list; a click on bare page is not.
      const control = event.target.closest(INTERACTIVE) ?? (this.tracked?.has(event.target) ? event.target : null)
      if (control && !control.matches('input, textarea')) this.emit({ cueId: null, trigger: 'click', detail: labelOf(control) })
      return
    }
    const gesture: Gesture = { match, replaced: false }
    const detail = labelOf(match.element)
    this.gesture = gesture
    // The render this click causes runs as a microtask, before this timeout, and flags the gesture if an outcome cue took over.
    setTimeout(() => {
      if (!gesture.replaced) this.fire(match.binding, detail)
      if (this.gesture === gesture) this.gesture = null
    }, 0)
  }

  /** A menu (<select>) fires `change`, not a click that means anything, so it has its own trigger. */
  private onChange(event: Event): void {
    if (!this.enabled || !this.inApp(event.target)) return
    const match = this.match(this.changeBindings, event.target)
    if (match) this.fire(match.binding, labelOf(match.element))
  }

  private onHover(event: MouseEvent): void {
    if (!this.enabled || !this.hoverEnabled || !this.inApp(event.target)) return
    const match = this.match(this.hoverBindings, event.target)
    const element = match?.element ?? null
    if (element === this.hoverElement) return
    this.hoverElement = element
    if (match && performance.now() - this.lastRenderAt > HOVER_QUIET_AFTER_RENDER_MS) this.fire(match.binding, labelOf(match.element))
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.enabled) return
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select')) return
    for (const binding of this.keyBindings) {
      if (!this.patterns.get(binding)?.keys?.test(event.key)) continue
      if (this.current && !allHold(binding.if, this.current, null)) continue
      this.fire(binding, event.key)
    }
  }

  private onRender(now: RenderContext): void {
    const before = this.current
    this.current = now
    this.lastRenderAt = performance.now()
    if (before && this.enabled) {
      const fired = this.stateBindings.filter((binding) => edgeFired(binding, now, before) && allHold(binding.if, now, before))
      // One render, one outcome: when several fire (a step change that also opens a tip), the most important
      // (lowest tier, then listed first) wins. Layered cues, such as a screen whoosh, sit on top rather than compete.
      fired.sort((a, b) => this.tierOf(a) - this.tierOf(b))
      const winner = fired.find((binding) => !binding.layer)
      for (const binding of fired.filter((candidate) => candidate.layer || candidate === winner)) {
        if (this.gesture && !binding.layer) this.gesture.replaced = true
        this.fire(binding, this.changedValues(binding, now, before))
      }
    }
    this.syncLoops(now, before)
    for (const listener of [...this.renderListeners]) listener(now)
  }

  /** Which of a state binding's watched values actually moved, e.g. `state.view = play`, for the trace. */
  private changedValues(binding: Binding, now: RenderContext, before: RenderContext): string {
    const paths = Array.isArray(binding.watch) ? binding.watch : binding.watch ? [binding.watch] : []
    return paths
      .filter((path) => edgeFired({ ...binding, watch: path }, now, before))
      .map((path) => {
        const value = readPath(now, path)
        return value === null || ['string', 'number', 'boolean'].includes(typeof value) ? `${path} = ${String(value)}` : path
      })
      .join(', ')
  }

  private syncLoops(now: RenderContext, before: RenderContext | null): void {
    for (const binding of this.loopBindings) {
      const shouldRun = this.enabled && allHold(binding.if, now, before)
      const gain = volumeGain(binding, now)
      const lastGain = this.loops.get(binding)
      if (shouldRun && lastGain === undefined) {
        this.emit({ cueId: binding.cue, trigger: 'while', detail: 'starts' })
        if (!this.dryRun) this.bank.play(binding.cue, { gain })
        this.loops.set(binding, gain)
      } else if (!shouldRun && lastGain !== undefined) {
        if (!this.dryRun) this.bank.stopCue(binding.cue, binding.fadeOutMs)
        this.loops.delete(binding)
      } else if (shouldRun && lastGain !== gain) {
        if (!this.dryRun) this.bank.retune(binding.cue, gain)
        this.loops.set(binding, gain)
      }
    }
  }

  private fire(binding: Binding, detail: string): void {
    if (!this.enabled) return
    this.emit({ cueId: binding.cue, trigger: binding.on, detail })
    if (!this.dryRun) this.bank.play(binding.cue, { gain: this.current ? volumeGain(binding, this.current) : 1 })
  }

  private tierOf(binding: Binding): number {
    return this.bank.getCue(binding.cue)?.tier ?? 3
  }
}
