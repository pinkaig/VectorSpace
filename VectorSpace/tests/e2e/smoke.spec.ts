import { expect, test } from '@playwright/test'
import { openEditor } from '../openEditor'

test('loads the editor and enters simulation mode', async ({ page }) => {
  test.setTimeout(120_000) // the editor is large and can take a while to load
  await openEditor(page)

  await expect(page).toHaveTitle('VectorSpace')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByText('Playing · exactly what visitors will see')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})