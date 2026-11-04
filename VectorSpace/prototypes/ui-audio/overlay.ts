/**
 * @file        overlay.ts
 * @brief       Draws every clickable and hoverable control on the page, numbered, with the sound it plays.
 *
 * @responsibility
 * The debug lens. Each control the page offers gets an outline and a number
 * that matches its row in the board's "On this screen" list, coloured by the
 * priority of the sound it plays; a control that plays nothing is red and
 * dashed, and the plain default click is grey so the special ones stand out
 * without the ordinary ones disappearing. Two layers can be shown on their own
 * or together: clickable (solid) and hoverable (dotted, marked H).
 *
 * The boxes come from `ScreenMap`, which already knows what is reachable and
 * where, so this file only draws. They live in a layer above the page rather
 * than inside it, because the mockup rebuilds its DOM on every render and
 * would wipe anything added there.
 */
import type { CueBank } from '../../packages/audio/src/index'
import { playsOf, type ScreenMap, type Surface } from './surfaces'

const TIER_CLASS: Record<number, string> = { 1: 'sfx-t1', 2: 'sfx-t2', 3: 'sfx-t3' }
/** Controls narrower than this get only their number: a name would spill over their neighbours. */
const LABEL_MIN_WIDTH = 64

export class TagOverlay {
  private showClicks = true
  private showHovers = false
  private focusCue: string | null = null
  private highlight: number | null = null
  private readonly layer: HTMLDivElement
  private unsubscribe: (() => void) | null = null

  constructor(private readonly map: ScreenMap, private readonly bank: CueBank) {
    this.layer = document.createElement('div')
    this.layer.id = 'sfx-overlay'
    document.body.append(this.layer)
    this.update()
  }

  setClicks(on: boolean): void {
    this.showClicks = on
    this.update()
  }

  setHovers(on: boolean): void {
    this.showHovers = on
    this.update()
  }

  /** Orange-outlines the controls that play this cue (the board's cue rows call this on hover). */
  setFocusCue(cueId: string | null): void {
    this.focusCue = cueId
    this.update()
  }

  /** Orange-outlines one control, by its `index` (the board's screen rows call this on hover). */
  setHighlight(index: number | null): void {
    this.highlight = index
    this.update()
  }

  /** The map's frame loop only runs while someone listens, so listen only while there is something to draw. */
  private update(): void {
    const wanted = this.showClicks || this.showHovers || this.focusCue !== null || this.highlight !== null
    if (wanted && !this.unsubscribe) this.unsubscribe = this.map.onChange(() => this.draw())
    if (!wanted && this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.draw()
  }

  private draw(): void {
    const boxes: HTMLElement[] = []
    for (const surface of this.map.surfaces) {
      const plays = playsOf(surface)
      const focused = this.highlight === surface.index || (this.focusCue !== null && (plays.includes(this.focusCue) || surface.hover === this.focusCue))
      const dimmed = (this.focusCue !== null || this.highlight !== null) && !focused
      const clickable = this.showClicks
      const hoverable = this.showHovers && surface.hover !== null
      if (!focused && !clickable && !hoverable) continue
      boxes.push(this.box(surface, plays, { focused, dimmed, hoverOnly: !focused && !clickable }))
    }
    this.layer.replaceChildren(...boxes)
  }

  private box(surface: Surface, plays: string[], flags: { focused: boolean; dimmed: boolean; hoverOnly: boolean }): HTMLElement {
    const { rect } = surface
    const primary = plays[0]
    const tier = primary ? this.bank.getCue(primary)?.tier : undefined
    const kind = flags.focused ? 'sfx-focus' : surface.kind === 'field' ? 'sfx-field' : !primary ? 'sfx-silent' : primary === 'ui.click' ? 'sfx-default' : tier ? TIER_CLASS[tier] : 'sfx-silent'
    const box = document.createElement('div')
    box.className = `sfx-box ${kind}${flags.hoverOnly ? ' sfx-hovering' : ''}${flags.dimmed ? ' sfx-dim' : ''}`
    box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`

    const number = document.createElement('i')
    number.textContent = String(surface.n)
    box.append(number)
    if (rect.width >= LABEL_MIN_WIDTH) {
      const label = document.createElement('span')
      const what = flags.hoverOnly ? `hover ${surface.hover}` : plays.length ? plays.join(' + ') : surface.kind === 'field' ? 'text field' : 'silent'
      // A question mark means the probe has not confirmed this yet; the name is the table's prediction.
      label.textContent = surface.heard || flags.hoverOnly ? what : `${what} ?`
      box.append(label)
    }
    if (this.showHovers && surface.hover && !flags.hoverOnly) {
      const mark = document.createElement('b')
      mark.textContent = 'H'
      box.append(mark)
    }
    return box
  }
}
