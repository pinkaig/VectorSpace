import { describe, expect, it } from 'vitest'
import { describeGoal, parseTodo } from './parseTodo'
import { checkGoal, progressLabel } from './checkTodo'
import type { ProjectData } from '../project/model'

describe('parseTodo: the verb does not matter, only the number and the thing', () => {
  it('reads the same goal from different wordings', () => {
    const goal = { kind: 'exhibits', target: 5, compare: 'atLeast' }
    expect(parseTodo('Place 5 exhibits')).toEqual(goal)
    expect(parseTodo('Add 5 exhibits')).toEqual(goal)
    expect(parseTodo('put five exhibits in the room')).toEqual(goal)
    expect(parseTodo('Build 5 artefacts!')).toEqual(goal)
  })

  it('reads the four sample to-dos', () => {
    expect(parseTodo('Place 3 exhibits')).toEqual({ kind: 'exhibits', target: 3, compare: 'atLeast' })
    expect(parseTodo('Give each exhibit a fact card')).toEqual({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' })
    expect(parseTodo('Add one reaction')).toEqual({ kind: 'reactions', target: 1, compare: 'atLeast' })
    expect(parseTodo('Add a second room')).toEqual({ kind: 'rooms', target: 2, compare: 'atLeast' })
  })

  it('handles each/every, missing numbers and two-word names', () => {
    expect(parseTodo('Label every exhibit')).toEqual({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' })
    expect(parseTodo('Add a sound effect')).toEqual({ kind: 'sounds', target: 1, compare: 'atLeast' })
    expect(parseTodo('Add zones')).toEqual({ kind: 'zones', target: 1, compare: 'atLeast' })
    expect(parseTodo('Place 3 exhibits in 2 rooms')).toEqual({ kind: 'exhibits', target: 3, compare: 'atLeast' })
  })

  it('reads more ways of writing a number', () => {
    expect(parseTodo('Add 2nd room')).toEqual({ kind: 'rooms', target: 2, compare: 'atLeast' })
    expect(parseTodo('Write a dozen fact cards')).toEqual({ kind: 'factCards', target: 12, compare: 'atLeast' })
    expect(parseTodo('Place a pair of exhibits')).toEqual({ kind: 'exhibits', target: 2, compare: 'atLeast' })
    expect(parseTodo('Add a third gallery')).toEqual({ kind: 'rooms', target: 3, compare: 'atLeast' })
    expect(parseTodo('Place thirteen artefacts')).toEqual({ kind: 'exhibits', target: 13, compare: 'atLeast' })
  })

  it('reads a negative or a ceiling as a limit', () => {
    const noSounds = { kind: 'sounds', target: 0, compare: 'atMost' }
    expect(parseTodo("Don't add any sounds")).toEqual(noSounds)
    expect(parseTodo('No music')).toEqual(noSounds)
    expect(parseTodo("Don't add a sound effect")).toEqual(noSounds)
    expect(parseTodo('No more than 5 exhibits')).toEqual({ kind: 'exhibits', target: 5, compare: 'atMost' })
    expect(parseTodo("Don't use more than two rooms")).toEqual({ kind: 'rooms', target: 2, compare: 'atMost' })
    expect(parseTodo('Add up to 4 reactions')).toEqual({ kind: 'reactions', target: 4, compare: 'atMost' })
    expect(parseTodo('Place at most 6 exhibits')).toEqual({ kind: 'exhibits', target: 6, compare: 'atMost' })
  })

  it('gives up (teacher ticks it) on things it cannot count', () => {
    expect(parseTodo('Make it look nice')).toBeNull()
    expect(parseTodo('Place 3 exhibits without sounds')).toBeNull()
    expect(parseTodo("Don't give each exhibit a sound")).toBeNull()
    expect(parseTodo('Give each room 2 exhibits')).toBeNull()
    expect(parseTodo('Place 500 exhibits')).toBeNull()
    expect(parseTodo('')).toBeNull()
  })
})

describe('describeGoal', () => {
  it('says what will be counted', () => {
    expect(describeGoal({ kind: 'exhibits', target: 3, compare: 'atLeast' })).toBe('3 exhibits placed')
    expect(describeGoal({ kind: 'factCards', target: 1, compare: 'atLeast' })).toBe('1 fact card written')
    expect(describeGoal({ kind: 'rooms', target: 2, compare: 'atLeast' })).toBe('2 rooms')
    expect(describeGoal({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' })).toBe('a fact card on every exhibit')
    expect(describeGoal({ kind: 'sounds', target: 0, compare: 'atMost' })).toBe('no sounds')
    expect(describeGoal({ kind: 'exhibits', target: 5, compare: 'atMost' })).toBe('at most 5 exhibits')
  })
})

describe('checkGoal', () => {
  // two rooms; three objects, two with a fact card; one reaction on obj-1
  const object = (id: string, withCard: boolean) => ({
    id, name: id, assetId: 'a', assetKind: 'cube', visible: true, enabled: true,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    attachments: withCard ? [{ id: `${id}-card`, kind: 'text', assetId: 't', presentation: { mode: 'panel' } }] : [],
  })
  const project = {
    schemaVersion: 1, id: 'p', name: 'p', activeSceneId: 's1',
    scenes: [
      { id: 's1', name: 'Hall', objects: [object('obj-1', true), object('obj-2', true)], environmentId: 'e', startCamera: {} },
      { id: 's2', name: 'Room 2', objects: [object('obj-3', false)], environmentId: 'e', startCamera: {} },
    ],
    rules: [{ id: 'r1', objectId: 'obj-1', triggers: ['click'], actions: [] }],
  } as unknown as ProjectData

  it('counts across every room', () => {
    expect(checkGoal({ kind: 'exhibits', target: 3, compare: 'atLeast' }, project)).toEqual({ done: 3, target: 3, compare: 'atLeast', complete: true })
    expect(checkGoal({ kind: 'rooms', target: 2, compare: 'atLeast' }, project).complete).toBe(true)
    expect(checkGoal({ kind: 'reactions', target: 2, compare: 'atLeast' }, project)).toEqual({ done: 1, target: 2, compare: 'atLeast', complete: false })
  })

  it('checks "each exhibit" against how many exhibits there are', () => {
    expect(checkGoal({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' }, project)).toEqual({ done: 2, target: 3, compare: 'atLeast', complete: false })
  })

  it('uses isExhibit when the catalogue can tell exhibits apart', () => {
    const onlyFirstRoom = (o: { id: string }) => o.id !== 'obj-3'
    expect(checkGoal({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' }, project, onlyFirstRoom as never).complete).toBe(true)
  })

  it('never ticks "each exhibit" in an empty room', () => {
    const empty = { ...project, scenes: [{ ...project.scenes[0], objects: [] }] } as ProjectData
    expect(checkGoal({ kind: 'factCards', target: 'eachExhibit', compare: 'atLeast' }, empty)).toEqual({ done: 0, target: 1, compare: 'atLeast', complete: false })
  })

  it('counts sounds on objects and sounds played by reactions, for a limit', () => {
    const withSound = {
      ...project,
      rules: [{ id: 'r2', triggers: ['click'], actions: [{ kind: 'playAudio', params: { assetId: 'roar' } }] }],
    } as unknown as ProjectData
    const noSounds = { kind: 'sounds', target: 0, compare: 'atMost' } as const
    expect(checkGoal(noSounds, project).complete).toBe(true)
    expect(checkGoal(noSounds, withSound)).toEqual({ done: 1, target: 0, compare: 'atMost', complete: false })
    expect(progressLabel(checkGoal(noSounds, withSound))).toBe('too many: 1')
    expect(progressLabel(checkGoal(noSounds, project))).toBe('')
  })

  it('shows a count only when there is more than one to do', () => {
    expect(progressLabel({ done: 2, target: 5, compare: 'atLeast', complete: false })).toBe('2/5')
    expect(progressLabel({ done: 0, target: 1, compare: 'atLeast', complete: false })).toBe('')
  })
})
