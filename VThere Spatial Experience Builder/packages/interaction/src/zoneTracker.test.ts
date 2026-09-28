import { describe, expect, it } from 'vitest'
import type { ZoneDefinition } from '@vthere/project'
import { createZoneTracker } from './zoneTracker'

const box: ZoneDefinition = {
  id: 'zone-box',
  name: 'Box Zone',
  shape: { kind: 'box', size: [2, 2, 2] },
  position: [0, 0, 0],
}
const sphere: ZoneDefinition = {
  id: 'zone-sphere',
  name: 'Sphere Zone',
  shape: { kind: 'sphere', radius: 1 },
  position: [10, 0, 0],
}

const at = (x: number, y = 0, z = 0) => [{ id: 'visitor', position: [x, y, z] as [number, number, number] }]

describe('createZoneTracker', () => {
  it('emits one zoneEnter on the frame the occupant crosses in', () => {
    const tracker = createZoneTracker([box])
    expect(tracker.tick(at(5))).toEqual([])
    expect(tracker.tick(at(0))).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-box' },
    ])
  })

  it('emits nothing on later frames while the occupant stays inside', () => {
    const tracker = createZoneTracker([box])
    tracker.tick(at(0))
    expect(tracker.tick(at(0.1))).toEqual([])
    expect(tracker.tick(at(0.2))).toEqual([])
    expect(tracker.tick(at(0.3))).toEqual([])
  })

  it('emits one zoneExit on the frame the occupant leaves', () => {
    const tracker = createZoneTracker([box])
    tracker.tick(at(0))
    expect(tracker.tick(at(5))).toEqual([
      { kind: 'zoneExit', objectId: 'visitor', zoneId: 'zone-box' },
    ])
    expect(tracker.tick(at(6))).toEqual([])
  })

  it('fires again on re-entry', () => {
    const tracker = createZoneTracker([box])
    tracker.tick(at(0))
    tracker.tick(at(5))
    expect(tracker.tick(at(0))).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-box' },
    ])
  })

  it('treats the box boundary as inside and just beyond it as outside', () => {
    const tracker = createZoneTracker([box])
    // half-extent is exactly 1.0 on each axis
    expect(tracker.tick(at(1))).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-box' },
    ])
    expect(tracker.tick(at(1.001))).toEqual([
      { kind: 'zoneExit', objectId: 'visitor', zoneId: 'zone-box' },
    ])
  })

  it('tests a sphere zone by radius, not by bounding box', () => {
    const tracker = createZoneTracker([sphere])
    // (0.8, 0.8, 0) is inside a radius-1 box corner but outside a radius-1 sphere
    expect(tracker.tick([{ id: 'visitor', position: [10.8, 0.8, 0] }])).toEqual([])
    expect(tracker.tick([{ id: 'visitor', position: [10.5, 0, 0] }])).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-sphere' },
    ])
  })

  it('tracks several zones and several occupants independently', () => {
    const tracker = createZoneTracker([box, sphere])
    const events = tracker.tick([
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [10, 0, 0] },
    ])
    expect(events).toEqual([
      { kind: 'zoneEnter', objectId: 'a', zoneId: 'zone-box' },
      { kind: 'zoneEnter', objectId: 'b', zoneId: 'zone-sphere' },
    ])
    expect(tracker.tick([
      { id: 'a', position: [0, 0, 0] },
      { id: 'b', position: [10, 0, 0] },
    ])).toEqual([])
  })

  it('emits an exit when an occupant disappears from the tick entirely', () => {
    const tracker = createZoneTracker([box])
    tracker.tick(at(0))
    expect(tracker.tick([])).toEqual([
      { kind: 'zoneExit', objectId: 'visitor', zoneId: 'zone-box' },
    ])
  })

  it('reset clears occupancy so the next tick re-fires enters', () => {
    const tracker = createZoneTracker([box])
    tracker.tick(at(0))
    expect(tracker.tick(at(0))).toEqual([])
    tracker.reset()
    expect(tracker.tick(at(0))).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-box' },
    ])
  })

  it('does nothing when a scene has no zones', () => {
    const tracker = createZoneTracker([])
    expect(tracker.tick(at(0))).toEqual([])
  })
})
