/**
 * @file        missionBrief.ts
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Mission brief helpers. The brief itself (due date, to-dos, rules) is stored on
 *              the project as ProjectData.missionBrief; its shape is in the shared project model.
 *
 *              A to-do is written in plain English by the teacher. parseTodo() reads it and,
 *              if it recognises it, turns it into a MissionGoal the app can count by itself
 *              (checkTodo.ts). If it does not recognise it, the goal is null and the teacher
 *              ticks that to-do by hand when reviewing.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

// the kinds of thing the app can count in a project
export type GoalKind =
  | 'exhibits'   // objects from the Exhibits part of the catalogue
  | 'things'     // any placed object at all
  | 'factCards'  // text attachments
  | 'sounds'     // audio attachments
  | 'reactions'  // WHEN -> DO rules
  | 'rooms'      // scenes
  | 'zones'      // zones

// the reactions that hang off an exhibit, so "give EACH exhibit a ..."
export const PER_EXHIBIT_KINDS: readonly GoalKind[] = ['factCards', 'sounds', 'reactions']

// what a to-do asks for, once understood
export interface MissionGoal {
  kind: GoalKind
  // a number: how many in the whole project
  // 'eachExhibit': "every exhibit has at least one" (only for PER_EXHIBIT_KINDS, only atLeast)
  target: number | 'eachExhibit'
  // 'atLeast': "Place 3 exhibits" -> 3 or more is done
  // 'atMost':  a limit, "Don't add any sounds" -> 0 or fewer, "Up to 5 exhibits" -> 5 or fewer
  compare: 'atLeast' | 'atMost'
}

// The stored shapes (what is saved in the project file) live in the shared project model,
// so the serializer and every app read the same ones. Re-exported here for convenience.
import type { MissionBrief } from '../project/model'
import { tidyCardTasks } from './cardTasks'
export type { CardField, CardTask, MissionBrief, MissionRule, MissionTodo } from '../project/model'

// The due date as the brief shows it, e.g. "Thursday, 22 Oct". A new brief is due today until the teacher changes it. Built in two parts
// because en-GB 
export const formatDueDate = (date: Date): string =>
  `${date.toLocaleDateString('en-GB', { weekday: 'long' })}, ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

// a fresh id for a new to-do or rule row (ids only need to be unique inside one brief)
let nextId = 0
export const newBriefId = (prefix: 'todo' | 'rule'): string => `${prefix}-${Date.now().toString(36)}-${nextId++}`

// The brief as it should be saved: text trimmed, empty to-dos and rules (a row added but never typed in) dropped. Run before saving, so students never see a blank line.
export const tidyBrief = (brief: MissionBrief): MissionBrief => {
  const tidy = <T extends { text: string }>(items: T[]): T[] =>
    items.map((item) => ({ ...item, text: item.text.trim() })).filter((item) => item.text !== '')
  const cardTasks = tidyCardTasks(brief.cardTasks ?? [])
  return { due: brief.due.trim(), todos: tidy(brief.todos), rules: tidy(brief.rules), ...(cardTasks.length > 0 ? { cardTasks } : {}) }
}
