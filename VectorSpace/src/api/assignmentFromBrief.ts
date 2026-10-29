/**
 * @file        assignmentFromBrief.ts
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       What Assign sends with each student's copy, read from the mission brief: the
 *              task (the to-dos joined, until the brief has its own one-line task) and the due
 *              date as "YYYY-MM-DD" for the student home's due chip and the archive rule.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { MissionBrief } from '../mission/missionBrief'
import type { AssignDetails } from './projects'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const HALF_A_YEAR_MS = 183 * 86_400_000

// "Friday, 30 Oct" -> "2026-10-30". The brief shows no year, so this takes the closest one:
// a date more than half a year ago means next year. Text it can't read gives undefined,
// so the server keeps the due date it already has.
export const dueFromBrief = (due: string, today = new Date()): string | undefined => {
  const match = /(\d{1,2})\s+([A-Za-z]{3})/.exec(due)
  if (!match) return undefined
  const day = Number(match[1])
  const month = MONTHS.indexOf(match[2].toLowerCase())
  if (month < 0) return undefined
  let year = today.getFullYear()
  if (new Date(year, month, day).getTime() < today.getTime() - HALF_A_YEAR_MS) year += 1
  if (new Date(year, month, day).getMonth() !== month) return undefined // e.g. "31 Feb"
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// the to-dos as one line, e.g. "Place 3 exhibits · Add one reaction"
export const taskFromBrief = (brief: MissionBrief): string =>
  brief.todos.map((todo) => todo.text.trim()).filter((text) => text !== '').join(' · ')

export const assignDetailsFromBrief = (brief: MissionBrief): AssignDetails => ({
  task: taskFromBrief(brief),
  dueAt: dueFromBrief(brief.due),
})