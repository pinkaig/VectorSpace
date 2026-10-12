import { expect, test } from '@playwright/test'

test('a signed-out visit to the editor is sent to login', async ({ page }) => {
  await page.goto('/#/editor')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('button', { name: 'Sign in as a Teacher' })).toBeVisible()
})

test('a teacher can walk login, home, editor, home and sign out', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/#\/login$/)

  await page.getByRole('button', { name: 'Sign in as a Teacher' }).click()
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

test('a student cannot open the editor and is sent to the student home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in as a Student' }).click()
  await expect(page).toHaveURL(/#\/student$/)

  await page.goto('/#/editor')
  await expect(page).toHaveURL(/#\/student$/)
})
