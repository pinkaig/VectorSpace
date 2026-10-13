/**
 * Startup measurement: how long the app takes to fetch, decode, initialise and
 * draw its first frame, cold (empty cache) and warm (same browser profile).
 *
 * Reproducibility strategy (same philosophy as tests/e2e/perf/perf.spec.ts):
 *  - every cold run is a brand-new browser context (clean cache, storage, profile)
 *  - warm runs navigate once to prime, then reload and measure the reload
 *  - runs against the production build (`vite build` + `vite preview`), because
 *    the dev server's unbundled modules say nothing about a real user's load
 *  - nothing is gated on absolute milliseconds; gates are structural (counts,
 *    failures) or relative (warm vs cold, p95 vs median)
 *  - results are written to test-results/startup/ with the environment recorded
 *
 * The app no longer fetches or decodes any audio at launch (audio loads on demand), so
 * the audio columns are expected to be zero and the gates below assert exactly that.
 * The probe still records them so a launch-time audio fetch coming back is caught here.
 *
 * Run with: npx playwright test -c playwright.startup.config.ts
 * Default is 3 runs, enough for the structural gates (they are exact counts, not timings).
 * For numbers worth quoting, run STARTUP_RUNS=15 (the spread gate only applies from 10 runs).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { summarizeRuns, toPhases, type StartupPhases } from './phases'
import { startupProbeInit, type RawTimeline, type StartupProbe } from './startupProbe'
import { openEditor } from '../openEditor'

const RUNS = Number(process.env.STARTUP_RUNS ?? 3)
const SETTLE_MS = 300 // decode count must hold steady this long to count as done
const MAX_SPREAD_RATIO = 3 // p95 over median on first draw; loose on purpose
const MIN_RUNS_FOR_SPREAD = 10 // a p95 over fewer runs is just the slowest run
const VIEWPORT = { width: 1280, height: 720 }

type Probe = { __startup: StartupProbe }

const waitForSettled = async (page: Page) => {
  // The app's own UI is the ready signal (same selector smoke.spec.ts relies on).
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
  const interactiveMs = await page.evaluate(() => performance.now())
  // Settled = a frame was drawn and no decode is in flight, held for SETTLE_MS. There is
  // no launch-time audio decode to wait for, so zero decodes is a valid settled state.
  const decodeCount = () => page.evaluate(() => (window as unknown as Probe).__startup.snapshot().decodes.length)
  await page.waitForFunction(() => {
    const s = (window as unknown as Probe).__startup.snapshot()
    return s.firstDrawMs !== null && s.pendingDecodes === 0
  })
  let last = await decodeCount()
  for (;;) {
    await page.waitForTimeout(SETTLE_MS)
    const now = await decodeCount()
    if (now === last) break
    last = now
  }
  return interactiveMs
}

const readPhases = async (page: Page, interactiveMs: number): Promise<StartupPhases> => {
  const raw: RawTimeline = await page.evaluate(() => (window as unknown as Probe).__startup.snapshot())
  return toPhases({ ...raw, interactiveMs })
}

const coldRun = async (browser: Browser): Promise<StartupPhases> => {
  const context = await browser.newContext({ viewport: VIEWPORT })
  try {
    const page = await context.newPage()
    await page.addInitScript(startupProbeInit)
    await openEditor(page)
    return await readPhases(page, await waitForSettled(page))
  } finally {
    await context.close()
  }
}

const warmRun = async (browser: Browser): Promise<StartupPhases> => {
  const context = await browser.newContext({ viewport: VIEWPORT })
  try {
    const page = await context.newPage()
    await page.addInitScript(startupProbeInit)
    await openEditor(page)
    await waitForSettled(page) // priming load; its numbers are discarded
    await page.reload()
    return await readPhases(page, await waitForSettled(page))
  } finally {
    await context.close()
  }
}

test.describe.configure({ mode: 'serial' })

test('startup: cold vs warm load, repeated', async ({ browser }, testInfo) => {
  test.setTimeout(RUNS * 2 * 30_000)

  const cold: StartupPhases[] = []
  const warm: StartupPhases[] = []
  for (let i = 0; i < RUNS; i++) {
    cold.push(await coldRun(browser))
    warm.push(await warmRun(browser))
  }

  const summary = { cold: summarizeRuns(cold), warm: summarizeRuns(warm) }
  const report = {
    recordedAt: new Date().toISOString(),
    environment: {
      browser: `${browser.browserType().name()} ${browser.version()}`,
      os: `${os.platform()} ${os.release()}`,
      cpus: os.cpus().length,
      node: process.version,
      runs: RUNS,
      viewport: VIEWPORT,
    },
    summary,
    runs: { cold, warm },
  }

  const outDir = path.join('test-results', 'startup')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `startup-${report.recordedAt.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
  await testInfo.attach('startup.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })

  const row = (label: string, s: typeof summary.cold) => ({
    load: label,
    interactiveMs: s.interactiveMs.median.toFixed(0),
    firstDrawMs: s.firstDrawMs.median.toFixed(0),
    firstDrawP95: s.firstDrawMs.p95.toFixed(0),
    spread: s.firstDrawMs.spreadRatio.toFixed(2),
    audioFetchMs: s.audioFetchSpanMs.median.toFixed(0),
    audioReadyMs: s.audioReadyMs.median.toFixed(0),
    decodes: s.audioDecodeCount.median,
    contexts: s.audioContextsCreated.median,
    suspended: s.audioContextsSuspended.median,
    audioKB: (s.audioTransferBytes.median / 1024).toFixed(0),
    longTaskMs: s.longTaskTotalMs.median.toFixed(0),
  })
  console.table([row('cold', summary.cold), row('warm', summary.warm)])
  console.log(`startup report: ${outFile}`)

  // Structural gates: deterministic, independent of machine speed.
  for (const [label, runs] of [['cold', cold], ['warm', warm]] as const) {
    for (const [i, r] of runs.entries()) {
      const where = `${label} run ${i}`
      expect(r.firstDrawMs, `${where}: a frame was drawn`).toBeGreaterThan(0)
      expect(r.audioFileCount, `${where}: no audio is fetched at launch`).toBe(0)
      expect(r.audioDecodeCount, `${where}: no audio is decoded at launch`).toBe(0)
      expect(r.audioDecodeFailures, `${where}: nothing failed to decode`).toBe(0)
    }
  }
  // Relative gates.
  expect(summary.warm.audioTransferBytes.median, 'warm load transfers no more audio than cold').toBeLessThanOrEqual(
    summary.cold.audioTransferBytes.median,
  )
  for (const [label, s] of RUNS >= MIN_RUNS_FOR_SPREAD ? ([['cold', summary.cold], ['warm', summary.warm]] as const) : []) {
    expect(s.firstDrawMs.spreadRatio, `${label}: first-draw p95/median spread`).toBeLessThanOrEqual(MAX_SPREAD_RATIO)
  }
})
