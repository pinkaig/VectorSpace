import { expect, test } from '@playwright/test'
import { signInAs } from '../openEditor'

test('a signed-out visit to the editor is sent to login', async ({ page }) => {
  await page.goto('/#/editor')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('button', { name: /Educator/ })).toBeVisible()
})

test('the login page downloads neither the editor nor any audio', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))
  await page.goto('/#/login')
  await expect(page.getByRole('button', { name: /Educator/ })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(requested.filter((url) => /EditorPage|EditorApplication/.test(url))).toEqual([])
  expect(requested.filter((url) => url.includes('/audio/'))).toEqual([])
})

test('a teacher can walk login, home, editor, home and sign out', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/#\/login$/)

  await page.getByRole('button', { name: /Educator/ }).click()
  await expect(page).toHaveURL(/#\/teacher$/)

  await page.getByRole('link', { name: 'Editor' }).click()
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()

  // a refresh keeps the session, so the editor is still open afterwards
  await page.reload()
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()

  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page).toHaveURL(/#\/teacher$/)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/#\/login$/)
})

test('an admin reaches every page and can switch the role it acts as', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /VThere Admin/ }).click()
  await expect(page).toHaveURL(/#\/teacher$/)

  // the strip lists every page, so no sign-out is needed to see another role's home
  await page.getByRole('link', { name: 'student: Home' }).click()
  await expect(page).toHaveURL(/#\/student$/)
  await page.getByRole('link', { name: 'teacher: Template setup' }).click()
  await expect(page).toHaveURL(/#\/teacher\/template$/)

  // "Act as" goes to that role's home, and the admin controls stay
  await page.getByLabel('Act as').selectOption('student')
  await expect(page).toHaveURL(/#\/student$/)
  await expect(page.getByLabel('Act as')).toHaveValue('student')

  // an admin acting as a student still opens the editor
  await page.getByRole('link', { name: 'teacher: Editor' }).click()
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
})

// The two guard checks sign in through storage (signInAs): the walk above already covers the buttons.
test('a teacher gets no admin controls and cannot open the student home', async ({ page }) => {
  await signInAs(page, 'teacher')
  await page.goto('/#/teacher')
  await expect(page.getByLabel('Act as')).toHaveCount(0)

  await page.goto('/#/student')
  await expect(page).toHaveURL(/#\/teacher$/)
})

test('a student cannot open the editor and is sent to the student home', async ({ page }) => {
  await signInAs(page, 'student')
  await page.goto('/#/editor')
  await expect(page).toHaveURL(/#\/student$/)
})
