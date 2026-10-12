import type { Page } from '@playwright/test'

// The editor is behind the teacher sign-in (src/session/session.tsx), so a spec signs in
// by setting the stored role before any app code runs, then opens the editor route.
// The key must match STORAGE_KEY in session.tsx.
export const openEditor = async (page: Page) => {
  await page.addInitScript(() => sessionStorage.setItem('vectorspace-session-role', 'teacher'))
  await page.goto('/#/editor')
}
