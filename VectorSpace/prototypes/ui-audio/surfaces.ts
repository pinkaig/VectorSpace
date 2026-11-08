/**
 * @file        surfaces.ts
 * @brief       Finds every clickable control on the current screen and says what sound it makes.
 *
 * @responsibility
 * The "where can I click here" half of the debug view. A surface is one thing a
 * visitor can click, hover or pick from: a button, a tab, a menu, a text field,
 * or one of the mockup's click areas that is not a button (it attaches a click
 * handler to any element, so the walls and floor in the 3D view are clickable
 * too). `ScreenMap` keeps a live, numbered list of the ones that are actually
 * reachable right now, measured where they sit on the screen, and tells the
 * overlay and the board whenever that list changes.
 *
 * Two ways of finding controls, because neither alone is reliable:
 * - a selector for the usual suspects (`INTERACTIVE`), and
 * - a hook on `addEventListener`, which catches any element the mockup gave a
 *   click or input handler, whatever its tag. The mockup builds its DOM through
 *   `addEventListener`, so the hook sees every one, once it is installed.
 *
 * "Reachable" means something at the control's own position answers the pointer
 * as that control (or a part of it): a button hidden behind a dialog, scrolled
 * out of a list, or clipped away is left out, so the numbers on the page and in
 * the board list match what a person can actually press.
 */
import type { UiSoundDirector } from './director'

export type SurfaceKind = 'button' | 'tab' | 'menu' | 'field' | 'area'

/** What can be said about a control without measuring it. Plain data, so the probe frame can send it across. */
export interface SurfaceInfo {
  label: string
  kind: SurfaceKind
  /** What the binding table says a click (or a menu change) plays. */
  click: string | null
  /** The binding that said so, in words. */
  clickBy: string | null
  hover: string | null
}

export interface Surface extends SurfaceInfo {
  /** Position among every control in the DOM, which is the same in the probe frame; the key for `heard`. */
  index: number
  element: Element
  rect: DOMRect
  /** Reading-order number shown on the page and in the board, 1-based. */
  n: number
  /**
   * What a real click was seen to play, from the probe frame. Differs from `click` when the click causes a
   * change that has its own sound (a step pill plays the step sound, not the button click). Undefined while
   * the probe has not answered, in which case `click` is the best guess. An empty list means silent.
   */
  heard?: string[]
}

export const INTERACTIVE = 'button, select, input, textarea, [role="tab"]'

const HANDLED_EVENTS = new Set(['click', 'input', 'change'])

/**
 * Remembers every element that is given a click or input handler. Install before the mockup renders the screen
 * you care about; the director's baseline re-render happens straight after, so nothing is missed.
 */
export function trackHandlers(): Set<Element> {
  const tracked = new Set<Element>()
  const original = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    if (this instanceof Element && HANDLED_EVENTS.has(type)) tracked.add(this)
    original.call(this, type, listener, options)
  }
  return tracked
}

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()
const WORDLIKE = /[\p{L}\p{N}]/u
const MAX_LABEL = 44

export function kindOf(element: Element): SurfaceKind {
  if (element.matches('select')) return 'menu'
  if (element.matches('input, textarea')) return 'field'
  if (element.matches('[role="tab"]')) return 'tab'
  return element.matches('button') ? 'button' : 'area'
}

/** What a person would call this control: its words if it has any, else its accessible name. */
export function labelOf(element: Element): string {
  const aria = clean(element.getAttribute('aria-label'))
  let label: string
  if (element instanceof HTMLSelectElement) label = clean(element.selectedOptions[0]?.textContent) || aria || 'menu'
  else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) label = aria || clean(element.placeholder) || 'text field'
  else {
    const text = clean(element.textContent)
    // Icon buttons carry an arrow or a cross as their text; the aria-label is the better name.
    label = WORDLIKE.test(text) ? text : aria || clean(element.getAttribute('title')) || text || (element instanceof SVGPolygonElement ? '3D room surface' : `clickable ${element.localName}`)
  }
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label
}

/**
 * Every control in document order: the usual suspects, anything the mockup gave a handler, and anything a click
 * binding names outright (`extra`), such as the floor in Play mode, which has no handler of its own but is where a
 * tap-to-walk sound is meant to start. Detached elements are forgotten from `tracked` as a side effect.
 */
export function controlsIn(root: Element, tracked: Set<Element>, extra = ''): Element[] {
  for (const element of tracked) if (!element.isConnected) tracked.delete(element)
  const selector = extra ? `${INTERACTIVE}, ${extra}` : INTERACTIVE
  return [...root.querySelectorAll('*')].filter((element) => (element.matches(selector) || tracked.has(element)) && !element.matches(':disabled, input[type="hidden"]'))
}

const SAMPLE_POINTS: Array<[number, number]> = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]

/** True if the pointer, at one of a few points inside the box, would land on this control or something inside it. */
export function isReachable(element: Element, rect: DOMRect): boolean {
  if (rect.width < 4 || rect.height < 4) return false
  if (rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight) return false
  return SAMPLE_POINTS.some(([fx, fy]) => {
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width * fx))
    const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height * fy))
    const hit = document.elementFromPoint(x, y)
    return !!hit && (hit === element || element.contains(hit))
  })
}

/** Reading order: top to bottom in bands about a line tall, then left to right, so a toolbar reads as a row. */
function readingOrder(a: Surface, b: Surface): number {
  const rowA = Math.round(a.rect.top / 14)
  const rowB = Math.round(b.rect.top / 14)
  return rowA - rowB || a.rect.left - b.rect.left
}

export function describe(director: UiSoundDirector, element: Element): SurfaceInfo {
  const { click, hover } = director.predict(element)
  return { label: labelOf(element), kind: kindOf(element), click: click?.binding.cue ?? null, clickBy: click?.binding.component ?? null, hover: hover?.binding.cue ?? null }
}

/** Compact, comparable form of a surface list: changes whenever anything shown on the page or the board would. */
function signature(surfaces: Surface[]): string {
  return surfaces.map((s) => `${s.index}|${s.label}|${s.click}|${s.hover}|${s.heard?.join('+') ?? '?'}|${Math.round(s.rect.left)},${Math.round(s.rect.top)},${Math.round(s.rect.width)},${Math.round(s.rect.height)}`).join('\n')
}

export class ScreenMap {
  surfaces: Surface[] = []
  /** Labels of every control in the DOM, in order. The probe frame sends the same list back, so the two can be matched. */
  docSignature = ''
  private heard: string[][] | null = null
  private heardSignature = ''
  private readonly described = new WeakMap<Element, SurfaceInfo>()
  private readonly listeners = new Set<() => void>()
  private dirty = true
  private lastSignature = ''
  private running = false

  constructor(private readonly director: UiSoundDirector, private readonly root: HTMLElement, private readonly tracked: Set<Element>) {
    // The mockup replaces its whole DOM on every change, so a childList observer is all it takes to know the list is stale.
    new MutationObserver(() => this.invalidate()).observe(root, { childList: true, subtree: true })
    window.addEventListener('resize', () => this.invalidate())
    document.addEventListener('scroll', () => this.invalidate(), true)
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  invalidate(): void {
    this.dirty = true
    this.start()
  }

  /** Applies a probe frame's answer, if it was taken of the same DOM that is on screen now. */
  setHeard(signatureOfProbe: string, heard: string[][]): boolean {
    // The frame loop may not have run since the DOM last changed (a hidden tab pauses it), so bring the list up to date first.
    if (this.dirty) this.refresh()
    if (signatureOfProbe !== this.docSignature) return false
    this.heard = heard
    this.heardSignature = signatureOfProbe
    this.dirty = true
    this.start()
    return true
  }

  /** The surface whose element is this one, if it is on the list. */
  surfaceFor(element: Element | null): Surface | undefined {
    const control = element?.closest(INTERACTIVE) ?? element
    return this.surfaces.find((surface) => surface.element === control || (control && surface.element.contains(control)))
  }

  /**
   * Watches the page for as long as anyone is listening: a frame loop, because animations move controls without
   * touching the DOM. A timer backs it up, since browsers pause animation frames in hidden tabs and panes.
   */
  private start(): void {
    if (this.running) return
    this.running = true
    const step = () => {
      let ran = false
      const run = () => {
        if (ran) return
        ran = true
        cancelAnimationFrame(frame)
        window.clearTimeout(timer)
        this.refresh()
        if (this.listeners.size > 0) step()
        else this.running = false
      }
      const frame = requestAnimationFrame(run)
      const timer = window.setTimeout(run, 250)
    }
    step()
  }

  private refresh(): void {
    if (!this.dirty && !this.moved()) return
    this.dirty = false
    this.rebuild()
    const next = signature(this.surfaces)
    if (next === this.lastSignature) return
    this.lastSignature = next
    for (const listener of [...this.listeners]) listener()
  }

  private moved(): boolean {
    return this.surfaces.some((surface) => {
      const rect = surface.element.getBoundingClientRect()
      return Math.abs(rect.left - surface.rect.left) > 0.5 || Math.abs(rect.top - surface.rect.top) > 0.5 || Math.abs(rect.width - surface.rect.width) > 0.5 || Math.abs(rect.height - surface.rect.height) > 0.5
    })
  }

  private rebuild(): void {
    const controls = controlsIn(this.root, this.tracked, this.director.clickSelector)
    const infos = controls.map((element) => {
      let info = this.described.get(element)
      if (!info) {
        info = describe(this.director, element)
        this.described.set(element, info)
      }
      return info
    })
    this.docSignature = infos.map((info) => `${info.kind}:${info.label}`).join('\u0001')
    const heard = this.heardSignature === this.docSignature ? this.heard : null
    const surfaces: Surface[] = []
    controls.forEach((element, index) => {
      const rect = element.getBoundingClientRect()
      if (!isReachable(element, rect)) return
      surfaces.push({ ...infos[index], index, element, rect, n: 0, heard: heard?.[index] })
    })
    surfaces.sort(readingOrder)
    surfaces.forEach((surface, position) => (surface.n = position + 1))
    this.surfaces = surfaces
  }
}

/** The cues a control really plays: what the probe heard if it has, else what the binding table predicts. */
export function playsOf(surface: Surface): string[] {
  if (surface.heard) return surface.heard
  return surface.click ? [surface.click] : []
}
