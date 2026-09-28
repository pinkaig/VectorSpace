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
  /** Needed only for layout(); overlay panels can rely on DOM wrapping instead. */
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

  layout(att: TextAttachment, box: { width: number; height: number }, font: FontSpec): TextLayoutResult {
    if (!this.layoutEngine) throw new Error('TextSystem was constructed without a measurer; layout() is unavailable')
    const meta = this.library.getMeta(att.assetId)
    const nodes = meta === undefined ? [] : this.parser.parse(meta.format, meta.content)
    return this.layoutEngine.layout(nodes, box, font)
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
