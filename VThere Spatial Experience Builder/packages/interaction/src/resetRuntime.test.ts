import { describe, expect, it } from 'vitest'
import type { ZoneDefinition } from '@vthere/project'
import { createActionSequencer, type ActionGenerator } from './ActionSequencer'
import { createEffectRegistry } from './actions/registry'
import { createZoneTracker } from './zoneTracker'
import { resetRuntime } from './resetRuntime'

const zone: ZoneDefinition = {
  id: 'zone-a',
  name: 'Zone A',
  shape: { kind: 'box', size: [2, 2, 2] },
  position: [0, 0, 0],
}

const session = () => ({
  sequencer: createActionSequencer(),
  effects: createEffectRegistry(),
  zones: createZoneTracker([zone]),
})

describe('resetRuntime', () => {
  it('stops every running sequence', () => {
    const live = session()
    const handle = live.sequencer.start(function* (): ActionGenerator {
      yield
      yield
    })
    live.sequencer.tick(0.016)
    expect(live.sequencer.isRunning(handle)).toBe(true)

    resetRuntime(live, { restart: false })
    expect(live.sequencer.isRunning(handle)).toBe(false)
    expect(live.sequencer.runningCount).toBe(0)
  })

  it('disposes every registered non-scene side effect', () => {
    const live = session()
    const closed: string[] = []
    live.effects.add(() => closed.push('panel'))
    live.effects.add(() => closed.push('audio'))

    resetRuntime(live, { restart: false })
    expect(closed.sort()).toEqual(['audio', 'panel'])
    expect(live.effects.size).toBe(0)
  })

  it('re-arms zone occupancy so a restart re-fires enters', () => {
    const live = session()
    const inside = [{ id: 'visitor', position: [0, 0, 0] as [number, number, number] }]
    expect(live.zones.tick(inside)).toHaveLength(1)
    expect(live.zones.tick(inside)).toHaveLength(0)

    resetRuntime(live, { restart: true, sceneId: 'scene-gallery' })
    expect(live.zones.tick(inside)).toEqual([
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-a' },
    ])
  })

  it('returns null when exiting to edit mode', () => {
    expect(resetRuntime(session(), { restart: false })).toBeNull()
  })

  it('returns a fresh empty state when restarting', () => {
    const live = session()
    const state = resetRuntime(live, { restart: true, sceneId: 'scene-gallery' })
    expect(state).not.toBeNull()
    expect(state?.currentSceneId).toBe('scene-gallery')
    expect(state?.visitedZones.size).toBe(0)
  })

  it('never carries visited zones across a restart', () => {
    const live = session()
    const first = resetRuntime(live, { restart: true, sceneId: 'scene-gallery' })
    first?.visitedZones.add('zone-a')
    const second = resetRuntime(live, { restart: true, sceneId: 'scene-gallery' })
    expect(second?.visitedZones.size).toBe(0)
  })

  it('rejects a restart with no sceneId rather than inventing one', () => {
    expect(() => resetRuntime(session(), { restart: true })).toThrow(/sceneId/)
  })

  it('works for a session with no zones', () => {
    const live = { sequencer: createActionSequencer(), effects: createEffectRegistry() }
    expect(() => resetRuntime(live, { restart: false })).not.toThrow()
  })

  it('is idempotent — a second reset changes nothing', () => {
    const live = session()
    live.effects.add(() => {})
    resetRuntime(live, { restart: false })
    expect(() => resetRuntime(live, { restart: false })).not.toThrow()
    expect(live.effects.size).toBe(0)
    expect(live.sequencer.runningCount).toBe(0)
  })
})
