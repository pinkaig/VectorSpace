import { expect, test } from '@playwright/test'
import { openEditor } from '../openEditor'

test('loads the editor and enters simulation mode', async ({ page }) => {
  await openEditor(page)

  await expect(page).toHaveTitle('VectorSpace')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()

  await page.getByRole('button', { name: 'Run simulation' }).click()
  await expect(page.getByText('Visitor view')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
})