import { describe, expect, it } from 'vitest'
import type { InteractionRule, ProjectData, ZoneDefinition } from '@vectorspace/project'
import {
  createActionRegistry,
  createActionSequencer,
  createEffectRegistry,
  createRuntimeState,
  createZoneTracker,
  dispatch,
  resetRuntime,
  waitSeconds,
  type ActionGenerator,
} from './index'

/**
 * End-to-end: event → dispatch → rule match → action executor → side effect →
 * reset, mirroring exactly what Viewport.tsx's animate() loop drives, but with
 * no renderer. This is the integration coverage the subsystem's acceptance
 * criteria call for; the per-module tests alongside it cover the units.
 */
describe('WHEN->DO end to end', () => {
  const zone: ZoneDefinition = {
    id: 'zone-entry',
    name: 'Entry',
    shape: { kind: 'box', size: [2, 2, 2] },
    position: [0, 0, 0],
  }
  const rules: InteractionRule[] = [
    { id: 'r-click', objectId: 'cube-1', triggers: ['click'], actions: [{ kind: 'showPanel', params: { componentId: 'p1' } }] },
    { id: 'r-zone', zoneId: 'zone-entry', triggers: ['zoneEnter'], actions: [{ kind: 'playAudio', params: { assetId: 'a1' } }] },
    { id: 'r-start', triggers: ['sceneStart'], actions: [{ kind: 'fadeIn' }] },
  ]
  const project = { schemaVersion: 1, id: 'p', name: 'p', activeSceneId: 's', scenes: [], rules } as unknown as ProjectData

  const harness = () => {
    const sequencer = createActionSequencer()
    const effects = createEffectRegistry()
    const actions = createActionRegistry()
    const zones = createZoneTracker([zone])
    const log: string[] = []

    actions.register('showPanel', (action, ctx) => {
      log.push(`panel:${action.params?.componentId}`)
      effects.add(() => log.push('panel-closed'))
      return ctx.state
    })
    actions.register('playAudio', (action, ctx) => {
      log.push(`audio:${action.params?.assetId}`)
      effects.add(() => log.push('audio-stopped'))
      return ctx.state
    })
    actions.register('fadeIn', (_a, ctx) => {
      sequencer.start(function* (): ActionGenerator {
        log.push('fade-start')
        yield waitSeconds(1)
        log.push('fade-done')
      })
      return ctx.state
    })
    return { sequencer, effects, actions, zones, log }
  }

  it('runs click -> rule -> action', async () => {
    const h = harness()
    let state = createRuntimeState('s')
    const result = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state)
    for (const a of result.actions) state = await h.actions.execute(a, { state, effects: h.effects })
    expect(h.log).toEqual(['panel:p1'])
  })

  it('runs zone entry once per transition, through dispatch', async () => {
    const h = harness()
    let state = createRuntimeState('s')
    const inside = [{ id: 'viewer', position: [0, 0, 0] as [number, number, number] }]
    const outside = [{ id: 'viewer', position: [9, 0, 0] as [number, number, number] }]

    for (const frame of [inside, inside, inside]) {
      for (const event of h.zones.tick(frame)) {
        const r = dispatch(event, rules, project, state)
        state = r.nextState
        for (const a of r.actions) state = await h.actions.execute(a, { state, effects: h.effects })
      }
    }
    expect(h.log).toEqual(['audio:a1'])
    expect(state.visitedZones.has('zone-entry')).toBe(true)

    h.zones.tick(outside)
    for (const event of h.zones.tick(inside)) {
      const r = dispatch(event, rules, project, state)
      state = r.nextState
      for (const a of r.actions) state = await h.actions.execute(a, { state, effects: h.effects })
    }
    expect(h.log).toEqual(['audio:a1', 'audio:a1'])
  })

  it('sequences a timed action across frames and resets cleanly', async () => {
    const h = harness()
    let state: ReturnType<typeof createRuntimeState> | null = createRuntimeState('s')
    const start = dispatch({ kind: 'sceneStart' }, rules, project, state)
    for (const a of start.actions) state = await h.actions.execute(a, { state: state!, effects: h.effects })

    h.sequencer.tick(0.1)
    expect(h.log).toEqual(['fade-start'])
    h.sequencer.tick(0.5)
    expect(h.log).toEqual(['fade-start'])
    h.sequencer.tick(0.6)
    expect(h.log).toEqual(['fade-start', 'fade-done'])

    // open a panel, then reset -- the effect must be disposed
    const click = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state!)
    for (const a of click.actions) state = await h.actions.execute(a, { state: state!, effects: h.effects })
    expect(h.log).toContain('panel:p1')

    state = resetRuntime({ sequencer: h.sequencer, effects: h.effects, zones: h.zones }, { restart: false })
    expect(state).toBeNull()
    expect(h.log).toContain('panel-closed')
    expect(h.sequencer.runningCount).toBe(0)
    expect(h.effects.size).toBe(0)
  })

  it('restart re-arms zones and clears visited state', async () => {
    const h = harness()
    let state = createRuntimeState('s')
    const inside = [{ id: 'viewer', position: [0, 0, 0] as [number, number, number] }]
    for (const event of h.zones.tick(inside)) state = dispatch(event, rules, project, state).nextState
    expect(state.visitedZones.size).toBe(1)
    expect(h.zones.tick(inside)).toHaveLength(0)

    const fresh = resetRuntime({ sequencer: h.sequencer, effects: h.effects, zones: h.zones }, { restart: true, sceneId: 's' })
    expect(fresh?.visitedZones.size).toBe(0)
    // standing still, the visitor gets a fresh enter after restart
    expect(h.zones.tick(inside)).toHaveLength(1)
  })
})
