/**
 * @file        assignmentFromBrief.test.ts
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Tests for assignmentFromBrief: reading the brief's due text back into a date,
 *              and the to-dos as the task line.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { describe, expect, it } from 'vitest'
import { dueFromBrief, taskFromBrief } from './assignmentFromBrief'

const today = new Date(2026, 9, 29) // Thursday 29 Oct 2026

describe('dueFromBrief', () => {
  it('reads the date the brief shows', () => {
    expect(dueFromBrief('Friday, 30 Oct', today)).toBe('2026-10-30')
  })
  it('takes next year for a date early in the year', () => {
    expect(dueFromBrief('Monday, 4 Jan', today)).toBe('2027-01-04')
  })
  it('reads September written as Sept', () => {
    expect(dueFromBrief('Tuesday, 1 Sept', today)).toBe('2026-09-01')
  })
  it('gives nothing for text it cannot read', () => {
    expect(dueFromBrief('next week', today)).toBeUndefined()
    expect(dueFromBrief('Saturday, 31 Feb', today)).toBeUndefined()
  })
})

describe('taskFromBrief', () => {
  it('joins the to-dos and skips blank ones', () => {
    const brief = {
      due: 'Friday, 30 Oct',
      todos: [
        { id: 'a', text: 'Place 3 exhibits' },
        { id: 'b', text: '  ' },
        { id: 'c', text: 'Add one reaction' },
      ],
      rules: [],
    }
    expect(taskFromBrief(brief)).toBe('Place 3 exhibits · Add one reaction')
  })
})