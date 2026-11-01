import { describe, expect, it } from 'vitest'
import { defaultProject, makeObject, type CardTask } from '../project/model'
import { deserializeProject, serializeProject } from '../project/serializer'
import { findCard, saveObjectCard } from '../editor/cardEditorOperations'
import { blankCount, blanksText, cardBody, isComplete, parseBlanks, promptFields, startFields, taskStatus, tidyCardTasks } from './cardTasks'
import { tidyBrief } from './missionBrief'

const blanksTask: CardTask = { id: 'task-1', title: 'Meet the T-rex', kind: 'blanks', fields: parseBlanks('The T-rex lived [how long ago?] million years ago and ate ___.') }
const promptsTask: CardTask = { id: 'task-2', title: 'My exhibit', kind: 'prompts', fields: promptFields(['What is it?', 'Why does it matter?']) }

describe('fill in the blanks', () => {
  it('splits a passage into the teacher\'s words and blanks, with hints', () => {
    expect(blanksTask.fields).toEqual([
      { key: 't0', label: 'The T-rex lived ', locked: true },
      { key: 'b1', label: '', prompt: 'how long ago?' },
      { key: 't2', label: ' million years ago and ate ', locked: true },
      { key: 'b3', label: '' },
      { key: 't4', label: '.', locked: true },
    ])
    expect(blankCount(blanksTask.fields)).toBe(2)
  })

  it('turns back into the text the teacher typed, so the passage can be edited again', () => {
    expect(blanksText(blanksTask.fields)).toBe('The T-rex lived [how long ago?] million years ago and ate [ ].')
    expect(parseBlanks(blanksText(blanksTask.fields))).toEqual(blanksTask.fields.map((field) => (field.key === 'b3' ? { ...field } : field)))
  })

  it('builds the card text from the answers, showing ____ for a blank still empty', () => {
    const fields = startFields(blanksTask)
    expect(isComplete(fields)).toBe(false)
    expect(cardBody('blanks', fields)).toBe('The T-rex lived ____ million years ago and ate ____.')
    fields[1].value = '66'
    fields[3].value = 'meat'
    expect(isComplete(fields)).toBe(true)
    expect(cardBody('blanks', fields)).toBe('The T-rex lived 66 million years ago and ate meat.')
  })
})

describe('questions to answer', () => {
  it('builds the card text as each question in bold, then its answer', () => {
    const fields = startFields(promptsTask)
    fields[0].value = 'A fossil'
    expect(cardBody('prompts', fields)).toBe('**What is it?**\n\nA fossil\n\n**Why does it matter?**\n\n…')
    expect(isComplete(fields)).toBe(false)
  })
})

describe('tidying and saving', () => {
  it('drops empty questions and empty tasks, and keeps the tasks in a tidied brief', () => {
    const messy: CardTask[] = [
      { ...promptsTask, title: '  My exhibit ', fields: promptFields(['What is it?', '  ']) },
      { id: 'task-3', title: ' ', kind: 'prompts', fields: [] },
    ]
    expect(tidyCardTasks(messy)).toEqual([{ ...promptsTask, fields: promptFields(['What is it?']) }])
    const brief = tidyBrief({ due: 'Friday', todos: [], rules: [], cardTasks: messy })
    expect(brief.cardTasks).toHaveLength(1)
    expect(tidyBrief({ due: 'Friday', todos: [], rules: [] })).not.toHaveProperty('cardTasks')
  })

  it('round-trips a brief with tasks and a card written from one, and an old brief still loads', () => {
    const project = defaultProject()
    const thing = makeObject('cube', 0)
    thing.id = 'obj-1'
    thing.name = 'Pedestal'
    project.scenes[0].objects.push(thing)
    project.missionBrief = { due: 'Friday', todos: [], rules: [], cardTasks: [blanksTask, promptsTask] }

    const fields = startFields(blanksTask)
    fields[1].value = '66'
    const saved = saveObjectCard(project, project.scenes[0].id, 'obj-1', { title: 'Meet the T-rex', body: cardBody('blanks', fields), fields, taskId: 'task-1' })
    if (!saved.ok) throw new Error(saved.error)

    const loaded = deserializeProject(serializeProject(saved.project))
    expect(loaded.missionBrief?.cardTasks).toEqual([blanksTask, promptsTask])
    const card = findCard(loaded, loaded.scenes[0].objects[0])
    expect(card?.attachment.presentation).toMatchObject({ taskId: 'task-1', fields })
    expect(card?.meta?.content).toBe('The T-rex lived 66 million years ago and ate ____.')
    expect(taskStatus(loaded, blanksTask)).toEqual({ state: 'started', objectName: 'Pedestal', objectId: 'obj-1' })
    expect(taskStatus(loaded, promptsTask)).toEqual({ state: 'todo' })

    const old = JSON.parse(serializeProject(project))
    delete old.missionBrief.cardTasks
    expect(deserializeProject(JSON.stringify(old)).missionBrief).toEqual({ due: 'Friday', todos: [], rules: [] })
  })

  it('refuses a task of an unknown kind or with a bad field', () => {
    const project = defaultProject()
    const json = (cardTasks: unknown) => JSON.stringify({ ...project, missionBrief: { due: '', todos: [], rules: [], cardTasks } })
    expect(() => deserializeProject(json([{ ...blanksTask, kind: 'essay' }]))).toThrow(/info card task/)
    expect(() => deserializeProject(json([{ ...blanksTask, fields: [{ key: '', label: 'x' }] }]))).toThrow(/invalid field/)
    expect(() => deserializeProject(json([blanksTask, blanksTask]))).toThrow(/duplicate/)
  })
})
