/**
 * @file        RuntimeEvent.ts
 * @brief       The normalized shape every WHEN trigger arrives as.
 *
 * @responsibility
 * Gives all three event sources — DOM listeners for discrete input, explicit
 * lifecycle calls, and the edge-triggered zone poller — one shape to produce and
 * one entry point to call. A rule author never knows or cares which mechanism
 * detected the trigger.
 *
 * @ownership
 * Owns the event vocabulary's *shape*, never its contents. `kind` is an open
 * string precisely so a new trigger kind costs no change here or in dispatcher.ts.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */

export interface RuntimeEvent {
  /**
   * Open vocabulary — 'click', 'hover', 'key', 'sceneStart', 'zoneEnter', etc.
   * The dispatcher compares it against rule triggers and has no opinion about
   * which values are legal.
   */
  kind: string
  /** The scene object this event concerns, when it concerns one. */
  objectId?: string
  /** The zone this event concerns, for spatial triggers. */
  zoneId?: string
  /** Trigger-specific detail (key code, pointer position, …). */
  payload?: Record<string, unknown>
}
