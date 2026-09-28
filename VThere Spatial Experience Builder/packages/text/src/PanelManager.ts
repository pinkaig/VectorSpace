/**
 * @file        PanelManager.ts
 * @brief       The open-panel stack: order, modal policy, cap, auto-close, sequence index.
 *
 * @responsibility
 * Owns which panels are open and where. A modal panel sits on top and marks
 * modalOpen; non-modal panels coexist up to a cap (default 3) after which
 * the oldest closes. Re-opening an open attachmentId re-focuses instead of
 * duplicating. Sequence navigation (prev/curr/next) is index arithmetic
 * over already-resolved content — no buffering, no look-ahead — and both
 * directions no-op at the ends. Auto-close is driven by an injected clock
 * read on tick(), so it is testable without timers.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 7
 */
import type { TextPresentation } from '@vthere/project'
import type { PanelStatus, TextStateStore } from './TextStateStore'

export interface OpenPanelInput {
  attachmentId: string
  assetId: string
  mode: TextPresentation['mode']
  state?: 'open' | 'error'
  modal?: boolean
  autoCloseMs?: number
  pageCount?: number
}

export type PanelSelector = { panelId: string } | { attachmentId: string } | { assetId: string } | { top: true }

interface PanelRecord extends PanelStatus {
  modal: boolean
  autoCloseAt?: number
}

const DEFAULT_NON_MODAL_CAP = 3

export class PanelManager {
  /** Bottom to top; modal panels always sort above non-modal ones. */
  private panels: PanelRecord[] = []
  private nextId = 0
  private readonly clock: () => number
  private readonly maxNonModal: number

  constructor(
    private readonly store: TextStateStore,
    opts: { clock?: () => number; maxNonModal?: number } = {},
  ) {
    this.clock = opts.clock ?? (() => Date.now())
    this.maxNonModal = opts.maxNonModal ?? DEFAULT_NON_MODAL_CAP
  }

  open(input: OpenPanelInput): PanelStatus {
    const existing = this.panels.find((panel) => panel.attachmentId === input.attachmentId)
    if (existing) {
      // re-focus, never duplicate: the panel moves to the top of its class
      this.panels = this.panels.filter((panel) => panel !== existing)
      this.insert(existing)
      this.publish()
      return { ...existing }
    }
    const record: PanelRecord = {
      id: `panel-${this.nextId++}`,
      attachmentId: input.attachmentId,
      assetId: input.assetId,
      mode: input.mode,
      state: input.state ?? 'open',
      page: 0,
      pageCount: Math.max(1, input.pageCount ?? 1),
      modal: input.modal ?? false,
      autoCloseAt: input.autoCloseMs === undefined ? undefined : this.clock() + input.autoCloseMs,
    }
    this.insert(record)
    const nonModal = this.panels.filter((panel) => !panel.modal)
    if (nonModal.length > this.maxNonModal) this.closeRecord(nonModal[0])
    this.publish()
    this.store.emit({ kind: 'panelOpened', panel: { ...record } })
    if (record.state === 'error') this.store.emit({ kind: 'panelError', panel: { ...record } })
    return { ...record }
  }

  close(sel: PanelSelector): void {
    const record = this.find(sel)
    if (!record) return
    this.closeRecord(record)
    this.publish()
  }

  closeAll(): void {
    for (const record of [...this.panels].reverse()) this.closeRecord(record)
    this.publish()
  }

  advance(sel: PanelSelector, dir: 'next' | 'prev' = 'next'): void {
    const record = this.find(sel)
    if (!record) return
    const nextPage = record.page + (dir === 'next' ? 1 : -1)
    // both ends are no-ops, not errors: over-clicking never loses the place
    if (nextPage < 0 || nextPage > record.pageCount - 1) return
    record.page = nextPage
    this.publish()
    this.store.emit({ kind: 'panelPaged', panel: { ...record } })
  }

  /** Host loop drives auto-close: closes every panel whose deadline passed. */
  tick(): void {
    const now = this.clock()
    const expired = this.panels.filter((panel) => panel.autoCloseAt !== undefined && panel.autoCloseAt <= now)
    if (expired.length === 0) return
    for (const record of expired) this.closeRecord(record)
    this.publish()
  }

  private find(sel: PanelSelector): PanelRecord | undefined {
    if ('top' in sel) return this.panels.at(-1)
    if ('panelId' in sel) return this.panels.find((panel) => panel.id === sel.panelId)
    if ('attachmentId' in sel) return this.panels.find((panel) => panel.attachmentId === sel.attachmentId)
    return this.panels.find((panel) => panel.assetId === sel.assetId)
  }

  private insert(record: PanelRecord): void {
    if (record.modal) {
      this.panels.push(record)
      return
    }
    // a non-modal panel never covers a modal one
    const firstModal = this.panels.findIndex((panel) => panel.modal)
    if (firstModal === -1) this.panels.push(record)
    else this.panels.splice(firstModal, 0, record)
  }

  private closeRecord(record: PanelRecord): void {
    this.panels = this.panels.filter((panel) => panel !== record)
    this.store.emit({ kind: 'panelClosed', panel: { ...record } })
  }

  private publish(): void {
    this.store.publish(
      this.panels.map(({ modal: _modal, autoCloseAt: _autoCloseAt, ...status }) => status),
      this.panels.some((panel) => panel.modal),
    )
  }
}
