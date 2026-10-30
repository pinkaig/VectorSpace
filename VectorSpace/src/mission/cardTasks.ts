/**
 * @file        cardTasks.ts
 * @project     VectorSpace
 * @author      Weian Ching
 * @brief       Info card tasks: cards a teacher sets in the mission brief for
 *              students to complete. Two kinds:
 *                fill in the blanks: "The T-rex lived [how long ago?] million years ago."
 *                questions (pointers): "What did it eat?", "Where was it found?"
 *
 * @responsibility
 * Pure helpers, no storage and no React. The teacher writes a blanks passage
 * as plain text with [square brackets] (or ___) marking each blank; the words
 * inside the brackets become the hint. That text is turned into CardFields
 * (locked words and blanks, in reading order) and back. On the student's
 * card the same fields carry the answers in `value`, and cardBody() builds the
 * card's visible text from them, so a task card shows in Play like any other.
 *
 * @documentation
 * packages/project/src/index.ts (CardTask, CardField, MissionBrief.cardTasks).
 */
import type { CardField, CardTask, ProjectData } from '../project/model'

// [hint] or [ ] or three or more underscores mark a blank
const BLANK = /\[([^\]]*)\]|_{3,}/g

let nextKey = 0
const key = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nextKey++}`

export const newTaskId = () => key('card-task')

/** "The T-rex lived [how long ago?] years ago." -> locked words and blanks, in reading order. */
export const parseBlanks = (text: string): CardField[] => {
  const fields: CardField[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(BLANK)) {
    const before = text.slice(last, match.index)
    if (before) fields.push({ key: `t${index++}`, label: before, locked: true })
    const hint = (match[1] ?? '').trim()
    fields.push({ key: `b${index++}`, label: '', ...(hint ? { prompt: hint } : {}) })
    last = (match.index ?? 0) + match[0].length
  }
  const after = text.slice(last)
  if (after) fields.push({ key: `t${index++}`, label: after, locked: true })
  return fields
}

/** The teacher's passage back from its fields: blanks become [hint] or [ ]. */
export const blanksText = (fields: CardField[]): string =>
  fields.map((field) => (field.locked ? field.label : `[${field.prompt ?? ' '}]`)).join('')

/** One unlocked field per pointer or question. */
export const promptFields = (prompts: string[]): CardField[] =>
  prompts.map((prompt, index) => ({ key: `q${index}`, label: prompt }))

export const blankCount = (fields: CardField[]) => fields.filter((field) => !field.locked).length

/** A task's fields as a student starts them: every answer empty. */
export const startFields = (task: CardTask): CardField[] => task.fields.map((field) => ({ ...field, ...(field.locked ? {} : { value: '' }) }))

/** Every blank or question has an answer. */
export const isComplete = (fields: CardField[]) => fields.every((field) => field.locked || (field.value ?? '').trim() !== '')

/**
 * The card's visible text, built from the answers. Blanks: the passage with the
 * answers in place (an empty blank shows as ____). Questions: each question in
 * bold, then its answer.
 */
export const cardBody = (kind: CardTask['kind'], fields: CardField[]): string => {
  if (kind === 'blanks') return fields.map((field) => (field.locked ? field.label : (field.value ?? '').trim() || '____')).join('').trim()
  return fields
    .filter((field) => !field.locked)
    .map((field) => `**${field.label.trim()}**\n\n${(field.value ?? '').trim() || '…'}`)
    .join('\n\n')
}

/** Tasks as they should be saved: titles trimmed, empty questions dropped, empty tasks dropped. */
export const tidyCardTasks = (tasks: CardTask[]): CardTask[] =>
  tasks
    .map((task) => ({
      ...task,
      title: task.title.trim(),
      fields: task.kind === 'prompts'
        ? task.fields.filter((field) => field.label.trim() !== '').map((field) => ({ ...field, label: field.label.trim() }))
        : task.fields,
    }))
    .filter((task) => task.title !== '' || blankCount(task.fields) > 0)

export type TaskStatus = { state: 'todo' } | { state: 'started' | 'done'; objectName: string; objectId: string }

/** Whether a student has a card for this task anywhere in the project, and how far along it is. */
export const taskStatus = (project: ProjectData, task: CardTask): TaskStatus => {
  let started: TaskStatus | null = null
  for (const scene of project.scenes) {
    for (const object of scene.objects) {
      for (const attachment of object.attachments ?? []) {
        if (attachment.kind !== 'text' || attachment.presentation.taskId !== task.id) continue
        const fields = attachment.presentation.fields ?? []
        if (isComplete(fields)) return { state: 'done', objectName: object.name, objectId: object.id }
        started ??= { state: 'started', objectName: object.name, objectId: object.id }
      }
    }
  }
  return started ?? { state: 'todo' }
}
