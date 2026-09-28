/**
 * @file        TextStateStore.ts
 * @brief       Snapshot/subscribe store reporting which text panels are open.
 *
 * @responsibility
 * The one read surface other systems get: React subscribes for rendering,
 * interactionController reads getSnapshot().modalOpen (a plain boolean — the
 * text system reports modal state and never decides what it means for
 * input), and the event stream feeds the future rule-engine bridge. Only
 * PanelManager writes here; everything public is read-only.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md sections 8 and "Modal input boundary"
 */
import type { TextPresentation } from '@vthere/project'

export interface PanelStatus {
  id: string
  attachmentId: string
  assetId: string
  mode: TextPresentation['mode']
  state: 'loading' | 'open' | 'error'
  /** Position in this panel's sequence (a page, or later a dialogue line). */
  page: number
  pageCount: number
}

export interface TextSnapshot {
  /** Bottom to top; the last entry is the front-most panel. */
  panels: PanelStatus[]
  topPanelId?: string
  modalOpen: boolean
}

export interface TextEvent {
  kind: 'panelOpened' | 'panelClosed' | 'panelPaged' | 'panelError'
  panel: PanelStatus
}

export type TextSnapshotListener = (snapshot: TextSnapshot) => void
export type TextEventListener = (event: TextEvent) => void

export class TextStateStore {
  private snapshot: TextSnapshot = { panels: [], modalOpen: false }
  private readonly snapshotListeners = new Set<TextSnapshotListener>()
  private readonly eventListeners = new Set<TextEventListener>()

  getSnapshot(): TextSnapshot {
    return this.snapshot
  }

  subscribe(listener: TextSnapshotListener): () => void {
    this.snapshotListeners.add(listener)
    return () => this.snapshotListeners.delete(listener)
  }

  onEvent(listener: TextEventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  isOpen(attachmentId: string): boolean {
    return this.snapshot.panels.some((panel) => panel.attachmentId === attachmentId)
  }

  getPanel(id: string): PanelStatus | undefined {
    return this.snapshot.panels.find((panel) => panel.id === id)
  }

  /** Package-internal: PanelManager publishes each new state through here. */
  publish(panels: PanelStatus[], modalOpen: boolean): void {
    this.snapshot = {
      panels: panels.map((panel) => ({ ...panel })),
      topPanelId: panels.at(-1)?.id,
      modalOpen,
    }
    this.snapshotListeners.forEach((listener) => listener(this.snapshot))
  }

  /** Package-internal: PanelManager emits lifecycle events through here. */
  emit(event: TextEvent): void {
    this.eventListeners.forEach((listener) => listener(event))
  }

  clearListeners(): void {
    this.snapshotListeners.clear()
    this.eventListeners.clear()
  }
}
