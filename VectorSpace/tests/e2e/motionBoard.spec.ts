import { expect, test } from '@playwright/test'

// The board is a dev-server route (see App.tsx), so it needs no sign-in and Playwright's dev server has it.

test('the board lists every cue and marks the undecided ones', async ({ page }) => {
  await page.goto('/#/motion-board')
  await expect(page.getByRole('heading', { name: 'Motion board' })).toBeVisible({ timeout: 30_000 }) // the first visit builds the page on the dev server; give it time like the actions below
  await expect(page.locator('code', { hasText: /^popup\.enter$/ })).toBeVisible()
  await expect(page.locator('.motion-board-badge').first()).toHaveText('undecided')
})

test('a token slider retunes the running app and Reset puts it back', async ({ page }) => {
  await page.goto('/#/motion-board')
  const fast = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--mo-dur-fast'))
  expect(await fast()).toBe('')

  await page.getByRole('slider').nth(1).fill('300')
  expect(await fast()).toBe('300ms')

  await page.getByRole('button', { name: 'Reset tokens' }).click()
  expect(await fast()).toBe('')
})

test('Play runs the cue on the stage, and pointing a cue at another recipe changes what plays', async ({ page }) => {
  await page.goto('/#/motion-board')
  // slow the preview to 0.1x (the board's own speed control) so a loaded machine cannot finish the animation before it is looked at
  await page.getByLabel(/Speed/).fill('0.1')
  const running = () => page.evaluate(() => document.querySelector('.motion-board-sample')!.getAnimations().length)

  await page.getByRole('row', { name: /popup\.enter/ }).getByRole('button', { name: 'Play' }).click()
  await expect.poll(running).toBeGreaterThan(0)
  // -1 while nothing is running yet, so a poll keeps waiting instead of throwing
  const duration = () =>
    page.evaluate(() => Number(document.querySelector('.motion-board-sample')!.getAnimations()[0]?.effect?.getTiming().duration ?? -1))
  expect(await duration()).toBe(140) // pop-in is "fast"

  await page.getByRole('combobox', { name: 'Recipe for popup.enter' }).selectOption('fade')
  await page.getByRole('row', { name: /popup\.enter/ }).getByRole('button', { name: 'Play' }).click()
  await expect.poll(duration).toBe(220) // fade is "base"
})

test('a recipe edit with broken keyframes is refused and says why', async ({ page }) => {
  await page.goto('/#/motion-board')
  await page.getByLabel(/Keyframes/).fill('{ not json')
  await page.getByRole('button', { name: 'Apply and replay' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('the export holds the edited tables', async ({ page }) => {
  await page.goto('/#/motion-board')
  await page.getByRole('combobox', { name: 'Recipe for popup.enter' }).selectOption('fade')
  await expect(page.getByLabel('Exported motion tables')).toHaveValue(/"id": "popup.enter"[\s\S]*?"recipe": "fade"/)
})
