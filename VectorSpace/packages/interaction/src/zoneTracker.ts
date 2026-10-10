/**
 * @file        zoneTracker.ts
 * @brief       Edge-triggered spatial detection: the one place polling is allowed.
 *
 * @responsibility
 * Diffs "who is inside which zone" between frames and emits a zoneEnter or
 * zoneExit RuntimeEvent only on a transition — never once per frame. The browser
 * gives no native event for entering a volume, so this must be checked; keeping
 * the edge detection here is what lets the rest of the system stay event-shaped
 * and keeps dispatch() off the frame loop.
 *
 * @inputs
 * Zone definitions and, each tick, the current world position of every tracked
 * occupant. Positions are plain tuples, so this module never imports Three.js
 * and stays unit-testable without a renderer.
 *
 * @outputs
 * Zero or more RuntimeEvents per tick — one per transition.
 *
 * @ownership
 * Owns inside/outside bookkeeping only. It does not dispatch, does not know what
 * a rule is, and holds no runtime state beyond the current occupancy sets.
 *
 * @testing
 * Covered by zoneTracker.test.ts: one event per transition, no repeat while
 * still inside, re-entry fires again, and reset clears occupancy.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { ZoneDefinition } from '@vectorspace/project'
import type { RuntimeEvent } from './RuntimeEvent'

export type Vector3Tuple = [number, number, number]

/** One thing whose zone membership is tracked — the visitor camera, or an object. */
export interface ZoneOccupant {
  id: string
  position: Vector3Tuple
}

export interface ZoneTracker {
  /**
   * Call once per frame with current positions. Returns only transitions, so an
   * occupant standing still inside a zone produces nothing after its first frame.
   */
  tick(occupants: readonly ZoneOccupant[]): RuntimeEvent[]
  /** Forgets all occupancy, so the next tick re-fires enters. Used by resetRuntime(). */
  reset(): void
}

const isInside = (zone: ZoneDefinition, position: Vector3Tuple): boolean => {
  const dx = position[0] - zone.position[0]
  const dy = position[1] - zone.position[1]
  const dz = position[2] - zone.position[2]
  if (zone.shape.kind === 'sphere') {
    const r = zone.shape.radius
    return dx * dx + dy * dy + dz * dz <= r * r
  }
  // Box extents are full sizes, so each half-extent is the comparison bound.
  const [sx, sy, sz] = zone.shape.size
  return Math.abs(dx) <= sx / 2 && Math.abs(dy) <= sy / 2 && Math.abs(dz) <= sz / 2
}

export const createZoneTracker = (zones: readonly ZoneDefinition[]): ZoneTracker => {
  // zoneId → ids currently inside it. This is the frame-to-frame memory that
  // turns a continuous condition into discrete events.
  const occupancy = new Map<string, Set<string>>()
  for (const zone of zones) occupancy.set(zone.id, new Set())

  return {
    tick(occupants) {
      const events: RuntimeEvent[] = []
      for (const zone of zones) {
        const previouslyInside = occupancy.get(zone.id) ?? new Set<string>()
        const nowInside = new Set<string>()

        for (const occupant of occupants) {
          if (isInside(zone, occupant.position)) nowInside.add(occupant.id)
        }

        for (const id of nowInside) {
          if (!previouslyInside.has(id)) {
            events.push({ kind: 'zoneEnter', objectId: id, zoneId: zone.id })
          }
        }
        for (const id of previouslyInside) {
          if (!nowInside.has(id)) {
            events.push({ kind: 'zoneExit', objectId: id, zoneId: zone.id })
          }
        }

        occupancy.set(zone.id, nowInside)
      }
      return events
    },
    reset() {
      for (const zone of zones) occupancy.set(zone.id, new Set())
    },
  }
}
