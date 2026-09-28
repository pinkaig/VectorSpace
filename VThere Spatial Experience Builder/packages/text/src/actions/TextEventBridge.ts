/**
 * @file        TextEventBridge.ts
 * @brief       Forwards panelOpened/panelClosed into the rule engine as runtime events.
 *
 * @responsibility
 * Lets rules chain on text ("when the intro panel closes, start the tour")
 * by forwarding the store's open/close events to the app's emitRuntimeEvent,
 * with a re-entrancy guard: a rule reacting to panelClosed may synchronously
 * open or close more panels, and the guard stops that from recursing back
 * through the bridge within the same emit. panelPaged and panelError stay
 * internal — they are UI state, not rule triggers.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md section 9
 */
import type { TextStateStore } from '../TextStateStore'

export interface TextRuntimeEvent {
  kind: 'panelOpened' | 'panelClosed'
  payload: { attachmentId: string; assetId: string; panelId: string }
}

/** Returns the unsubscribe function; the caller owns the bridge's lifetime. */
export const createTextEventBridge = (
  store: TextStateStore,
  emit: (event: TextRuntimeEvent) => void,
): (() => void) => {
  let forwarding = false
  return store.onEvent((event) => {
    if (event.kind !== 'panelOpened' && event.kind !== 'panelClosed') return
    if (forwarding) return
    forwarding = true
    try {
      emit({
        kind: event.kind,
        payload: { attachmentId: event.panel.attachmentId, assetId: event.panel.assetId, panelId: event.panel.id },
      })
    } finally {
      forwarding = false
    }
  })
}
