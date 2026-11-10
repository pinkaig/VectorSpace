import { describe, expect, it } from 'vitest'
import { defaultProject, makeObject, makeScene, type ProjectData } from '@vectorspace/project'
import { dispatch } from './dispatcher'
import { createRuntimeState } from './RuntimeState'
import type { InteractionRule } from './InteractionRule'

const project: ProjectData = defaultProject()
const state = () => createRuntimeState('scene-gallery')

const rule = (id: string, overrides: Partial<InteractionRule> = {}): InteractionRule => ({
  id,
  triggers: ['click'],
  actions: [{ kind: 'showPanel', params: { componentId: `panel-${id}` } }],
  ...overrides,
})

describe('dispatch', () => {
  it('matches a rule on trigger kind and object id', () => {
    const rules = [rule('r1', { objectId: 'cube-1' })]
    const result = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['r1'])
    expect(result.actions).toEqual([{ kind: 'showPanel', params: { componentId: 'panel-r1' } }])
  })

  it('does not match when the trigger kind differs', () => {
    const rules = [rule('r1', { objectId: 'cube-1' })]
    const result = dispatch({ kind: 'hover', objectId: 'cube-1' }, rules, project, state())
    expect(result.rulesMatched).toEqual([])
    expect(result.actions).toEqual([])
  })

  it('does not match when the object id differs', () => {
    const rules = [rule('r1', { objectId: 'cube-1' })]
    const result = dispatch({ kind: 'click', objectId: 'cube-2' }, rules, project, state())
    expect(result.rulesMatched).toEqual([])
  })

  it('treats an absent objectId as a wildcard so lifecycle rules match', () => {
    const rules = [rule('start', { triggers: ['sceneStart'], objectId: undefined })]
    const result = dispatch({ kind: 'sceneStart' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['start'])
  })

  it('matches on zone id and trigger kind together', () => {
    const rules = [
      rule('zoneRule', { triggers: ['zoneEnter'], zoneId: 'zone-a', objectId: undefined }),
      rule('otherZone', { triggers: ['zoneEnter'], zoneId: 'zone-b', objectId: undefined }),
    ]
    const result = dispatch({ kind: 'zoneEnter', zoneId: 'zone-a' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['zoneRule'])
  })

  it('requires every present address field to match, not just one', () => {
    const rules = [rule('r1', { triggers: ['zoneEnter'], objectId: 'visitor', zoneId: 'zone-a' })]
    const wrongZone = dispatch(
      { kind: 'zoneEnter', objectId: 'visitor', zoneId: 'zone-b' },
      rules,
      project,
      state(),
    )
    expect(wrongZone.rulesMatched).toEqual([])
  })

  it('fires multiple rules on one object in authoring order', () => {
    const rules = [
      rule('first', { objectId: 'cube-1' }),
      rule('second', { objectId: 'cube-1' }),
      rule('third', { objectId: 'cube-1' }),
    ]
    const result = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['first', 'second', 'third'])
  })

  it('orders by priority descending, keeping authoring order as the tiebreak', () => {
    const rules = [
      rule('lowA', { objectId: 'cube-1' }),
      rule('high', { objectId: 'cube-1', priority: 10 }),
      rule('lowB', { objectId: 'cube-1' }),
      rule('mid', { objectId: 'cube-1', priority: 5 }),
    ]
    const result = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['high', 'mid', 'lowA', 'lowB'])
  })

  it('flattens actions across matched rules in firing order', () => {
    const rules = [
      rule('a', { objectId: 'cube-1', actions: [{ kind: 'one' }, { kind: 'two' }] }),
      rule('b', { objectId: 'cube-1', actions: [{ kind: 'three' }] }),
    ]
    const result = dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state())
    expect(result.actions.map((a) => a.kind)).toEqual(['one', 'two', 'three'])
  })

  it('records a visited zone even when no rule matches the entry', () => {
    const result = dispatch({ kind: 'zoneEnter', zoneId: 'zone-a' }, [], project, state())
    expect(result.nextState.visitedZones.has('zone-a')).toBe(true)
  })

  it('does not mutate the state it was given', () => {
    const before = state()
    const result = dispatch({ kind: 'zoneEnter', zoneId: 'zone-a' }, [], project, before)
    expect(before.visitedZones.size).toBe(0)
    expect(result.nextState).not.toBe(before)
    expect(result.nextState.visitedZones).not.toBe(before.visitedZones)
  })

  it('does not mutate the rules array it was given', () => {
    const rules = [
      rule('lowA', { objectId: 'cube-1' }),
      rule('high', { objectId: 'cube-1', priority: 10 }),
    ]
    dispatch({ kind: 'click', objectId: 'cube-1' }, rules, project, state())
    expect(rules.map((r) => r.id)).toEqual(['lowA', 'high'])
  })

  it('returns a new state value even when nothing matched', () => {
    const before = state()
    const result = dispatch({ kind: 'click', objectId: 'nobody' }, [], project, before)
    expect(result.nextState).not.toBe(before)
    expect(result.nextState.currentSceneId).toBe('scene-gallery')
  })

  it('carries an unknown trigger and action kind through without special-casing', () => {
    // The vocabulary-independence guarantee: a kind the dispatcher has never
    // heard of matches and flows through untouched, so adding a trigger or
    // action never means editing dispatcher.ts.
    const rules = [
      rule('novel', {
        triggers: ['gazeDwell'],
        objectId: 'cube-1',
        actions: [{ kind: 'startHaptics', params: { intensity: 0.4 } }],
      }),
    ]
    const result = dispatch({ kind: 'gazeDwell', objectId: 'cube-1' }, rules, project, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['novel'])
    expect(result.actions).toEqual([{ kind: 'startHaptics', params: { intensity: 0.4 } }])
  })

  it('preserves visited zones across successive dispatches', () => {
    const first = dispatch({ kind: 'zoneEnter', zoneId: 'zone-a' }, [], project, state())
    const second = dispatch({ kind: 'zoneEnter', zoneId: 'zone-b' }, [], project, first.nextState)
    expect([...second.nextState.visitedZones].sort()).toEqual(['zone-a', 'zone-b'])
  })

    // A played room holding cube-1, so rules owned by cube-1 count as "in this room"
  const roomWithCube: ProjectData = {
    ...defaultProject(),
    scenes: [{ ...makeScene('scene-gallery', 'Gallery'), objects: [{ ...makeObject('cube', 1), id: 'cube-1' }] }],
  }
  const cardEvent = (attachmentId: string) =>
    ({ kind: 'panelClosed', payload: { attachmentId, assetId: 'text-1', panelId: 'panel-1' } }) as const

  it('fires a room-start rule whose owner is in the room being played', () => {
    const rules = [rule('start', { triggers: ['sceneStart'], objectId: 'cube-1' })]
    const result = dispatch({ kind: 'sceneStart' }, rules, roomWithCube, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['start'])
  })

  // otherwise a room 2 exhibit's room-start rule would also fire when room 1 is played
  it('does not fire a room-start rule whose owner is in another room', () => {
    const rules = [rule('start', { triggers: ['sceneStart'], objectId: 'cube-in-room-2' })]
    const result = dispatch({ kind: 'sceneStart' }, rules, roomWithCube, state())
    expect(result.rulesMatched).toEqual([])
  })

  it('fires a card-closed rule only for the chosen card', () => {
    const rules = [rule('closed', { triggers: ['panelClosed'], objectId: 'cube-1', triggerParams: { cardId: 'card-a' } })]
    expect(dispatch(cardEvent('card-a'), rules, roomWithCube, state()).rulesMatched.map((r) => r.id)).toEqual(['closed'])
    expect(dispatch(cardEvent('card-b'), rules, roomWithCube, state()).rulesMatched).toEqual([])
  })

  it('fires a card-closed rule with no chosen card for any card', () => {
    const rules = [rule('closed', { triggers: ['panelClosed'], objectId: 'cube-1' })]
    expect(dispatch(cardEvent('card-b'), rules, roomWithCube, state()).rulesMatched.map((r) => r.id)).toEqual(['closed'])
  })

  // zone events name the visitor ('viewer'), not the rule's object, so the owner must not block them
  it('fires a zone rule owned by an object when the visitor walks in', () => {
    const rules = [rule('zone', { triggers: ['zoneEnter'], objectId: 'cube-1', zoneId: 'zone-a' })]
    const result = dispatch({ kind: 'zoneEnter', objectId: 'viewer', zoneId: 'zone-a' }, rules, roomWithCube, state())
    expect(result.rulesMatched.map((r) => r.id)).toEqual(['zone'])
  })

  it('still needs the same object for a click, even when the owner is in the room', () => {
    const rules = [rule('both', { triggers: ['click', 'sceneStart'], objectId: 'cube-1' })]
    expect(dispatch({ kind: 'click', objectId: 'cube-2' }, rules, roomWithCube, state()).rulesMatched).toEqual([])
    expect(dispatch({ kind: 'click', objectId: 'cube-1' }, rules, roomWithCube, state()).rulesMatched.map((r) => r.id)).toEqual(['both'])
    expect(dispatch({ kind: 'sceneStart' }, rules, roomWithCube, state()).rulesMatched.map((r) => r.id)).toEqual(['both'])
  })
})
