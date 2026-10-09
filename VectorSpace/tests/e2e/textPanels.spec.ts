/**
 * Text-system dev surface (text-system.md build step 6), executable form.
 *
 * Seeds the browser draft with fixtures/text-demo-project.json — the same
 * file a human can load through the editor's Import JSON button — and
 * automates the design doc's manual checks: a rule-opened panel renders
 * markdown-lite as safe DOM, a deliberately hostile text (script tag, HTML,
 * javascript: link, deep nesting) renders as inert literal text with no
 * dialog and no link, a modal panel stacks on top, and Escape closes panels
 * one by one before it exits the simulation.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const demoProject = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/text-demo-project.json', import.meta.url)), 'utf8'),
) as Record<string, unknown>

test('rule-driven text panels render safely and close on Escape in order', async ({ page }) => {
  // fail loudly if the hostile text ever executes: no native dialog may open
  page.on('dialog', (dialog) => {
    throw new Error(`hostile text executed script: ${dialog.message()}`)
  })
  await page.addInitScript((project) => {
    localStorage.setItem('vectorspace-project-v1', JSON.stringify(project))
  }, demoProject)

  await page.goto('/')
  await page.getByRole('button', { name: 'Run simulation' }).click()
  await expect(page.getByText('Visitor view')).toBeVisible()

  // sceneStart rule: the welcome panel opens with parsed markdown-lite
  const welcome = page.getByRole('dialog', { name: 'Welcome' })
  await expect(welcome).toBeVisible()
  await expect(welcome.locator('strong')).toHaveText('exhibition')
  const guideLink = welcome.getByRole('link', { name: 'guide' })
  await expect(guideLink).toHaveAttribute('href', 'https://example.org/guide')
  await expect(guideLink).toHaveAttribute('target', '_blank')
  await expect(guideLink).toHaveAttribute('rel', 'noopener noreferrer')

  // zoneEnter rule (componentId alias, modal: true): the hostile panel stacks on top
  const hostile = page.getByRole('dialog', { name: 'Hostile Input' })
  await expect(hostile).toBeVisible()
  await expect(hostile).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('.text-panel-backdrop')).toBeVisible()

  // the hostile content is literal text: markup visible as characters,
  // nothing parsed into elements, the javascript: link reduced to its label
  await expect(hostile.getByText("<script>alert('xss')</script>")).toBeVisible()
  await expect(hostile.getByText("<img src=x onerror=alert('xss')>")).toBeVisible()
  // the URL scan ends at the first ')' inside javascript:alert('xss'), so the
  // label plus the leftover paren render as plain text — the URL itself is gone
  await expect(hostile.getByText('click me) must stay inert')).toBeVisible()
  await expect(hostile.locator('script, img, a')).toHaveCount(0)

  // Escape closes panels top-down, then exits the simulation
  await page.keyboard.press('Escape')
  await expect(hostile).toBeHidden()
  await expect(welcome).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(welcome).toBeHidden()
  await expect(page.getByText('Visitor view')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
})
