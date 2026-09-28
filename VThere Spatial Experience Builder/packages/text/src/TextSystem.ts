/**
 * @file        TextSystem.ts
 * @brief       The text system facade — the only object other code holds.
 *
 * @responsibility
 * Ties the internals together behind one API: open resolves content through
 * TextLibrary (synchronously — text is project data), parses it into a safe
 * node tree, and hands the panel to PanelManager; close/advance address
 * panels by selector; layout runs the pure wrap/page maths. A missing or
 * corrupt assetId opens an error panel ("Content unavailable" is the
 * renderer's string) and emits panelError — nothing throws toward the
 * dispatcher. Pure TypeScript: no React, no Three.js, no browser.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md "Class design"
 */
import type { TextAttachment } from '@vthere/project'
import { PanelManager, type PanelSelector } from './PanelManager'
import { RichTextParser } from './parse/RichTextParser'
import { DEFAULT_TEXT_LIMITS, type TextLimits, type TextNode } from './parse/nodes'
import { TextLayout, type TextLayoutResult } from './layout/TextLayout'
import type { FontSpec, TextMeasurer } from './layout/TextMeasurer'
import { TextLibrary } from './TextLibrary'
import { TextStateStore } from './TextStateStore'
import { UrlPolicy } from './UrlPolicy'

export interface TextSystemOptions {
  library: TextLibrary
  /**
   * Needed only for layout(); the DOM overlay panels let the browser wrap, so
   * the app constructs TextSystem without one. Supply a canvas-backed
   * measurer for a fixed-size surface that has to wrap text itself — a
   * caption box or a dialogue plate. Without it, layout() returns undefined
   * and canLayout is false.
   */
  measurer?: TextMeasurer
  clock?: () => number
  limits?: Partial<TextLimits>
  maxNonModalPanels?: number
}

export interface PanelHandle {
  readonly id: string
  readonly state: 'loading' | 'open' | 'error'
  readonly nodes?: TextNode[]
  /** Text opens synchronously; this exists for API symmetry with async kinds. */
  readonly ready: Promise<void>
  close(): void
  advance(dir?: 'next' | 'prev'): void
}

export interface TextStats {
  openPanels: number
  modalOpen: boolean
}

export class TextSystem {
  readonly store = new TextStateStore()
  private readonly parser: RichTextParser
  private readonly panels: PanelManager
  private readonly layoutEngine?: TextLayout
  private readonly library: TextLibrary
  private readonly nodesByPanel = new Map<string, TextNode[]>()

  constructor(opts: TextSystemOptions) {
    this.library = opts.library
    this.parser = new RichTextParser(new UrlPolicy(), { ...DEFAULT_TEXT_LIMITS, ...opts.limits })
    this.panels = new PanelManager(this.store, { clock: opts.clock, maxNonModal: opts.maxNonModalPanels })
    this.layoutEngine = opts.measurer === undefined ? undefined : new TextLayout(opts.measurer)
    this.store.onEvent((event) => {
      if (event.kind === 'panelClosed') this.nodesByPanel.delete(event.panel.id)
    })
  }

  open(att: TextAttachment, opts: { modal?: boolean; autoCloseMs?: number; title?: string } = {}): PanelHandle {
    const meta = this.library.getMeta(att.assetId)
    const nodes = meta === undefined ? undefined : this.parser.parse(meta.format, meta.content)
    const status = this.panels.open({
      attachmentId: att.id,
      assetId: att.assetId,
      mode: att.presentation.mode,
      state: meta === undefined ? 'error' : 'open',
      // setting resolution order: action params > attachment presentation > meta
      modal: opts.modal ?? att.presentation.modal,
      autoCloseMs: opts.autoCloseMs ?? att.presentation.autoCloseMs,
      title: opts.title ?? att.presentation.title ?? meta?.title,
      lang: meta?.lang,
    })
    if (nodes) this.nodesByPanel.set(status.id, nodes)
    return {
      id: status.id,
      state: status.state,
      nodes,
      ready: Promise.resolve(),
      close: () => this.close({ panelId: status.id }),
      advance: (dir) => this.advance({ panelId: status.id }, dir),
    }
  }

  close(sel: PanelSelector): void {
    this.panels.close(sel)
  }

  closeAll(): void {
    this.panels.closeAll()
  }

  advance(sel: PanelSelector, dir: 'next' | 'prev' = 'next'): void {
    this.panels.advance(sel, dir)
  }

  /** The parsed tree a renderer draws for one open panel. */
  getNodes(panelId: string): TextNode[] | undefined {
    return this.nodesByPanel.get(panelId)
  }

  /**
   * Wrapped/paged lines for a fixed-size surface (a canvas caption box, a
   * dialogue plate) — not needed by the DOM overlay panels, which let the
   * browser wrap. Returns undefined when no measurer was supplied rather than
   * throwing: whether layout is available is a construction-time fact the
   * caller can check once, and a method that throws based on a constructor
   * argument turns that into a runtime surprise.
   */
  layout(att: TextAttachment, box: { width: number; height: number }, font: FontSpec): TextLayoutResult | undefined {
    if (!this.layoutEngine) return undefined
    const meta = this.library.getMeta(att.assetId)
    const nodes = meta === undefined ? [] : this.parser.parse(meta.format, meta.content)
    return this.layoutEngine.layout(nodes, box, font)
  }

  /** True when a measurer was supplied, so layout() returns a result. */
  get canLayout(): boolean {
    return this.layoutEngine !== undefined
  }

  /** Host loop drives auto-close through here. */
  tick(): void {
    this.panels.tick()
  }

  getStats(): TextStats {
    const snapshot = this.store.getSnapshot()
    return { openPanels: snapshot.panels.length, modalOpen: snapshot.modalOpen }
  }

  dispose(): void {
    this.panels.closeAll()
    this.store.clearListeners()
    this.nodesByPanel.clear()
  }
}
