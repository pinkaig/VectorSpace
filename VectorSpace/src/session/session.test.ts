import { describe, expect, it } from 'vitest'
import { adminRedirect, devSubjectFor, guardRedirect, homePath } from './session'

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

describe('devSubjectFor', () => {
  it('maps each picker button to a seeded person', () => {
    expect(devSubjectFor('teacher', false)).toBe('dev|teacher')
    expect(devSubjectFor('student', false)).toBe('dev|student1')
  })

  it('maps the admin override to the seeded admin whichever role is picked', () => {
    expect(devSubjectFor('teacher', true)).toBe('dev|admin')
    expect(devSubjectFor('student', true)).toBe('dev|admin')
  })
})

describe('adminRedirect', () => {
  it('lets only an admin stay on the admin pages', () => {
    expect(adminRedirect('teacher', true)).toBeNull()
    expect(adminRedirect('student', true)).toBeNull()
  })

  it('sends a signed-out visitor to login and anyone else to their own home', () => {
    expect(adminRedirect(null, false)).toBe('/login')
    expect(adminRedirect('teacher', false)).toBe('/teacher')
    expect(adminRedirect('student', false)).toBe('/student')
  })
})

describe('homePath', () => {
  it('sends an admin to /admin whichever role it is acting as', () => {
    expect(homePath('teacher', true)).toBe('/admin')
    expect(homePath('student', true)).toBe('/admin')
  })

  it('sends everyone else to the page named after their role', () => {
    expect(homePath('teacher', false)).toBe('/teacher')
    expect(homePath('student', false)).toBe('/student')
  })
})
