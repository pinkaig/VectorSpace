import type { Page } from '@playwright/test'

// Specs sign in by setting the stored role before any app code runs, instead of clicking
// through the login page; navigation.spec.ts is the one place that walks the real buttons.
// The key must match STORAGE_KEY in src/session/session.tsx.
export const signInAs = (page: Page, role: 'teacher' | 'student') =>
  page.addInitScript((value) => sessionStorage.setItem('vectorspace-session-role', value), role)

// The editor is teacher-only, so this signs in as a teacher and opens the editor route.
export const openEditor = async (page: Page) => {
  await signInAs(page, 'teacher')
  await page.goto('/#/editor')
}
