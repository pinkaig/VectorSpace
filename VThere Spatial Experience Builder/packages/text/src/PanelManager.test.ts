import { describe, expect, it } from 'vitest'
import { PanelManager, type OpenPanelInput } from './PanelManager'
import { TextStateStore, type TextEvent } from './TextStateStore'

const input = (attachmentId: string, overrides: Partial<OpenPanelInput> = {}): OpenPanelInput => ({
  attachmentId,
  assetId: `asset-${attachmentId}`,
  mode: 'panel',
  ...overrides,
})

const build = (opts: { clock?: () => number; maxNonModal?: number } = {}) => {
  const store = new TextStateStore()
  const events: TextEvent[] = []
  store.onEvent((event) => events.push(event))
  return { store, events, manager: new PanelManager(store, opts) }
}

describe('PanelManager stack and modal policy', () => {
  it('opens panels, reports the top one, and flags modalOpen only while a modal is open', () => {
    const { store, manager } = build()
    manager.open(input('a'))
    const modal = manager.open(input('b', { modal: true }))
    expect(store.getSnapshot().modalOpen).toBe(true)
    expect(store.getSnapshot().topPanelId).toBe(modal.id)

    // a later non-modal panel must not cover the modal one
    manager.open(input('c'))
    expect(store.getSnapshot().topPanelId).toBe(modal.id)

    manager.close({ panelId: modal.id })
    expect(store.getSnapshot().modalOpen).toBe(false)
  })

  it('re-focuses instead of duplicating when an open attachmentId opens again', () => {
    const { store, manager } = build()
    const first = manager.open(input('a'))
    manager.open(input('b'))
    const again = manager.open(input('a'))

    expect(again.id).toBe(first.id)
    expect(store.getSnapshot().panels).toHaveLength(2)
    expect(store.getSnapshot().topPanelId).toBe(first.id)
  })

  it('closes the oldest non-modal panel past the cap', () => {
    const { store, events, manager } = build({ maxNonModal: 3 })
    manager.open(input('a'))
    manager.open(input('b'))
    manager.open(input('c'))
    manager.open(input('d'))

    expect(store.getSnapshot().panels.map((panel) => panel.attachmentId)).toEqual(['b', 'c', 'd'])
    expect(events.filter((event) => event.kind === 'panelClosed').map((event) => event.panel.attachmentId)).toEqual(['a'])
  })
})

describe('PanelManager auto-close and events', () => {
  it('closes a panel once its injected-clock deadline passes on tick', () => {
    let now = 0
    const { store, manager } = build({ clock: () => now })
    manager.open(input('a', { autoCloseMs: 500 }))
    manager.open(input('b'))

    now = 499
    manager.tick()
    expect(store.getSnapshot().panels).toHaveLength(2)

    now = 500
    manager.tick()
    expect(store.getSnapshot().panels.map((panel) => panel.attachmentId)).toEqual(['b'])
  })

  it('emits panelOpened, panelPaged, and panelClosed in order', () => {
    const { events, manager } = build()
    manager.open(input('a', { pageCount: 3 }))
    manager.advance({ attachmentId: 'a' }, 'next')
    manager.close({ top: true })

    expect(events.map((event) => event.kind)).toEqual(['panelOpened', 'panelPaged', 'panelClosed'])
  })

  it('emits panelError alongside panelOpened for an error-state panel', () => {
    const { events, manager } = build()
    manager.open(input('broken', { state: 'error' }))
    expect(events.map((event) => event.kind)).toEqual(['panelOpened', 'panelError'])
  })
})

describe('PanelManager sequence navigation', () => {
  it('moves the index both ways and no-ops at either end', () => {
    const { store, manager } = build()
    manager.open(input('a', { pageCount: 2 }))
    const page = () => store.getSnapshot().panels[0].page

    manager.advance({ attachmentId: 'a' }, 'prev')
    expect(page()).toBe(0)
    manager.advance({ attachmentId: 'a' }, 'next')
    expect(page()).toBe(1)
    manager.advance({ attachmentId: 'a' }, 'next')
    expect(page()).toBe(1)
    manager.advance({ attachmentId: 'a' }, 'prev')
    expect(page()).toBe(0)
  })

  it('closeAll empties the stack and re-opening starts the sequence over', () => {
    const { store, manager } = build()
    manager.open(input('a', { pageCount: 3 }))
    manager.advance({ attachmentId: 'a' })
    manager.closeAll()
    expect(store.getSnapshot().panels).toHaveLength(0)

    manager.open(input('a', { pageCount: 3 }))
    expect(store.getSnapshot().panels[0].page).toBe(0)
  })
})
