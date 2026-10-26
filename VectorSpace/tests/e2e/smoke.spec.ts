import { expect, test } from '@playwright/test'
import { openEditor } from '../openEditor'

test('loads the editor and enters simulation mode', async ({ page }) => {
  await openEditor(page)

  await expect(page).toHaveTitle('VectorSpace')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByText('Playing · exactly what visitors will see')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})