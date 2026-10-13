import { describe, expect, it } from 'vitest'
import { guardRedirect } from './session'

describe('guardRedirect', () => {
  it('lets the required role stay', () => {
    expect(guardRedirect('teacher', 'teacher')).toBeNull()
    expect(guardRedirect('student', 'student')).toBeNull()
  })

  it('sends a signed-out visitor to login', () => {
    expect(guardRedirect(null, 'teacher')).toBe('/login')
  })

  it('sends the wrong role to its own home, not to login', () => {
    expect(guardRedirect('student', 'teacher')).toBe('/student')
    expect(guardRedirect('teacher', 'student')).toBe('/teacher')
  })

  it('lets an admin stay on any page, whichever role it is acting as', () => {
    expect(guardRedirect('student', 'teacher', true)).toBeNull()
    expect(guardRedirect('teacher', 'student', true)).toBeNull()
  })

  it('still sends a signed-out visitor to login, admin flag or not', () => {
    expect(guardRedirect(null, 'teacher', true)).toBe('/login')
  })
})
