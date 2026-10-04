import { expect, test } from '@playwright/test'

test('loads the editor and enters simulation mode', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('VectorSpace')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()

  await page.getByRole('button', { name: 'Run simulation' }).click()
  await expect(page.getByText('Visitor view')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
})