/**
 * @file        panelKeys.ts
 * @author      Weian Ching
 * @brief       The keyboard rule for open text panels and info cards: Escape
 *              closes only the top panel. No other key or press closes anything.
 *
 * @responsibility
 * Kept apart from TextPanelHost so the rule can be unit-tested without a
 * browser. TextPanelHost calls it from a window keydown listener in the
 * capture phase, which runs before RuntimeView's own Escape ("leave Play").
 * When this returns true, the caller stops the event, so one Escape press
 * never both closes a panel and leaves Play.
 *
 * @documentation
 * docs/handover/info-card-work-package.md step A2.
 */

/** The two calls the rule needs, so tests can pass a small fake. */
export interface PanelCloser {
  store: { getSnapshot: () => { topPanelId?: string } }
  close: (selector: { top: true }) => void
}

/**
 * Closes the top panel when Escape is pressed and a panel is open.
 * Returns true when it handled the key, false to let the key through.
 */
export const handlePanelKey = (event: { key: string; repeat: boolean }, text: PanelCloser): boolean => {
  if (event.key !== 'Escape' || event.repeat) return false
  if (text.store.getSnapshot().topPanelId === undefined) return false
  text.close({ top: true })
  return true
}
