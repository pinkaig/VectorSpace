import { expect, test, type Page } from '@playwright/test'

// Admin pages in offline mode (no API): the popup, the disabled look and the reduced-motion
// promise do not need any data. Keys must match session.tsx; the admin flag only works on the dev server.
const signInAsAdmin = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('vectorspace-session-role', 'teacher')
    sessionStorage.setItem('vectorspace-session-admin', 'true')
  })

const openImportPopup = async (page: Page) => {
  await page.goto('/#/admin/accounts')
  await page.getByRole('button', { name: 'Import class list (CSV)' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('a popup opens, and closing it leaves nothing behind on the page', async ({ page }) => {
  await signInAsAdmin(page)
  await openImportPopup(page)
  await page.getByRole('button', { name: 'OK' }).click()

  // the exit animation plays on a copy; the copy must be deleted when it ends. A leaked one
  // would still be in the DOM here, so this counts elements, not accessible dialogs
  await expect(page.locator('.ui-popup-backdrop')).toHaveCount(0)
})

test('a popup that closes while its exit is still playing still leaves nothing behind', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/#/admin/accounts')
  // open and close twice in one breath: the second open starts while the first copy is mid-exit
  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: 'Import class list (CSV)' }).click()
    await page.getByRole('button', { name: 'OK' }).click()
  }
  await expect(page.locator('.ui-popup-backdrop')).toHaveCount(0)
})

test('Escape closes the popup the same way', async ({ page }) => {
  await signInAsAdmin(page)
  await openImportPopup(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ui-popup-backdrop')).toHaveCount(0)
})

test('a disabled button cannot be clicked and looks disabled', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/#/admin/accounts')
  await page.getByRole('button', { name: '+ Add an account' }).click()

  const add = page.getByRole('button', { name: 'Add account' })
  await expect(add).toBeDisabled()
  await expect(add).toHaveCSS('opacity', '0.4')
  await expect(add).toHaveCSS('cursor', 'not-allowed')
})

test.describe('with reduced motion asked for', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('the four admin pages still render and no element is left mid-animation', async ({ page }) => {
    await signInAsAdmin(page)
    for (const [path, heading] of [
      ['/#/admin', 'Overview'],
      ['/#/admin/permissions', 'Permissions'],
      ['/#/admin/accounts', 'Accounts'],
      ['/#/admin/rooms', 'Rooms & assets'],
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length))
        .toBe(0)
    }
  })

  test('a popup still closes and leaves nothing behind', async ({ page }) => {
    await signInAsAdmin(page)
    await openImportPopup(page)
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.locator('.ui-popup-backdrop')).toHaveCount(0)
  })
})
