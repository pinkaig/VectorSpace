import { expect, test } from '@playwright/test'

test('loads the editor and enters simulation mode', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('VThere Spatial Experience Builder')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()

  await page.getByRole('button', { name: 'Run simulation' }).click()
  await expect(page.getByRole('button', { name: 'Exit simulation' })).toBeVisible()

  await page.getByRole('button', { name: 'Exit simulation' }).click()
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
})