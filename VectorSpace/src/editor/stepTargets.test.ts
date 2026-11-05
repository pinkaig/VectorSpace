import { describe, expect, it } from 'vitest'
import { nextStepThing } from './stepTargets'

const things = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const doneOnly = (...ids: string[]) => (thing: { id: string }) => ids.includes(thing.id)

describe('nextStepThing', () => {
  it('goes to the first thing still missing what the step adds', () => {
    expect(nextStepThing(things, doneOnly('a'), null, false)?.id).toBe('b')
  })

  it('leaves a finished thing for one that still needs it, even when arriving from another step', () => {
    expect(nextStepThing(things, doneOnly('a'), 'a', true)?.id).toBe('b')
  })

  it('keeps the current thing when arriving from another step, if it still needs it', () => {
    expect(nextStepThing(things, doneOnly('a'), 'c', true)?.id).toBe('c')
  })

  it('moves through the unfinished things on repeat clicks, and wraps round', () => {
    expect(nextStepThing(things, doneOnly('b'), 'a', false)?.id).toBe('c')
    expect(nextStepThing(things, doneOnly('b'), 'c', false)?.id).toBe('a')
  })

  it('cycles through every thing once all are finished', () => {
    const allDone = doneOnly('a', 'b', 'c')
    expect(nextStepThing(things, allDone, null, false)?.id).toBe('a')
    expect(nextStepThing(things, allDone, 'a', false)?.id).toBe('b')
    expect(nextStepThing(things, allDone, 'c', false)?.id).toBe('a')
  })

  it('gives nothing for an empty room', () => {
    expect(nextStepThing([], () => false, null, false)).toBeNull()
  })
})
