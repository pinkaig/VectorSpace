/**
 * Renderer performance check: frame stability with 100+ primitive objects.
 *
 * Reproducibility strategy: absolute FPS on CI (software GL) is meaningless, so
 * nothing is gated on an absolute frame time. Each view measures a small baseline
 * scene and the stress scenes inside the same browser/run, and gates on
 *   1. deterministic structure  — draw calls scale with objects within a budget
 *                                 (catches lost batching, culling, duplicate draws)
 *   2. relative timing          — stress frame time stays within a multiple of baseline
 *   3. no hitches               — p99 stays within a multiple of the stress median
 * Views: "runtime" (Run simulation, play mode, draws every frame) and "editor"
 * (orbit camera, on-demand renderer, driven by synthetic wheel events).
 *
 * Run with: npm run test:perf      (software GL, gated; this is what CI runs)
 *           npm run test:perf:gpu  (headed, real GPU, report-only)
 * Both are serial in their own project so nothing competes for CPU.
 */
import { expect, test, type Page } from '@playwright/test'
import { harnessInit, type PerfSample } from './harness'
import { buildPerfProject } from './perfScene'
import { frameStats, type FrameStats } from './stats'

const BASELINE_OBJECTS = 10
const STRESS_OBJECTS = [150, 300]
const WARMUP_MS = 2000
const MEASURE_MS = 6000

// Gates. See header for why these are relative.
const MAX_MEDIAN_RATIO = 2.5 // stress median frame time vs baseline
const MEDIAN_SLACK_MS = 8 // absorbs vsync quantisation when baseline is ~16.7 ms
const MAX_P99_OVER_MEDIAN = 3 // hitch detector
const TIMING_GATED_UP_TO = 150 // larger scenes are reported + structurally gated only (CPU-raster time is machine-dependent)
// Fraction of objects that must get a draw call, net of the baseline's fixed overhead
// (grid, gizmos). The editor's wheel-driven camera zooms in and frustum-culls some edge objects.
const MIN_OBJECTS_DRAWN = { runtime: 0.95, editor: 0.75 }
const MIN_DRAWN_FRAME_RATIO = 0.9 // frames in which the main canvas issued draws
const MAX_DRAWS_PER_EXTRA_OBJECT = 3 // budget: mesh + outline/shadow headroom

interface Measurement {
  objects: number
  stats: FrameStats
  medianDraws: number
  drawnFrameRatio: number
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

const measure = async (page: Page, view: 'runtime' | 'editor', objects: number): Promise<Measurement> => {
  await page.addInitScript(harnessInit)
  await page.addInitScript((project) => {
    localStorage.setItem('vectorspace-project-v1', JSON.stringify(project))
  }, buildPerfProject(objects))
  await page.goto('/')
  if (view === 'runtime') {
    await page.getByRole('button', { name: 'Run simulation' }).click()
    await expect(page.getByText('Visitor view')).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible()
  }
  await page.waitForTimeout(WARMUP_MS) // shader compile, first uploads, GC settle

  await page.evaluate((wheel) => (window as unknown as { __perf: { start(o: { wheel: boolean }): void } }).__perf.start({ wheel }), view === 'editor')
  await page.waitForTimeout(MEASURE_MS)
  const sample = await page.evaluate(() => (window as unknown as { __perf: { stop(): PerfSample } }).__perf.stop())

  return {
    objects,
    stats: frameStats(sample.frameMs),
    medianDraws: median(sample.draws),
    drawnFrameRatio: sample.draws.filter((d) => d > 0).length / Math.max(sample.draws.length, 1),
  }
}

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 720 } })

for (const view of ['runtime', 'editor'] as const) {
  test(`${view}: frame time stays stable from ${BASELINE_OBJECTS} to ${STRESS_OBJECTS.join('/')} objects`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000)
    const results: Measurement[] = []
    for (const objects of [BASELINE_OBJECTS, ...STRESS_OBJECTS]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      results.push(await measure(await context.newPage(), view, objects))
      await context.close()
    }
    await testInfo.attach(`${view}-perf.json`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
    console.table(results.map((r) => ({
      view, objects: r.objects, frames: r.stats.frames, fps: r.stats.avgFps.toFixed(1),
      medianMs: r.stats.medianMs.toFixed(1), p95Ms: r.stats.p95Ms.toFixed(1), p99Ms: r.stats.p99Ms.toFixed(1),
      maxMs: r.stats.maxMs.toFixed(1), slow: r.stats.slowFrames, medianDraws: r.medianDraws,
      drawn: r.drawnFrameRatio.toFixed(2),
    })))

    // perf-gpu project: real-GPU local run, numbers reported but nothing asserted
    if (testInfo.project.name === 'perf-gpu') return

    const [baseline, ...stress] = results
    expect(baseline.drawnFrameRatio, 'baseline must actually render frames').toBeGreaterThanOrEqual(MIN_DRAWN_FRAME_RATIO)
    const overhead = baseline.medianDraws - baseline.objects
    for (const r of stress) {
      const label = `${view} @ ${r.objects} objects`
      expect(r.drawnFrameRatio, `${label}: frames with draws`).toBeGreaterThanOrEqual(MIN_DRAWN_FRAME_RATIO)
      expect(r.medianDraws - overhead, `${label}: objects drawn`).toBeGreaterThanOrEqual(r.objects * MIN_OBJECTS_DRAWN[view])
      expect(r.medianDraws, `${label}: draw-call budget`).toBeLessThanOrEqual(
        baseline.medianDraws + MAX_DRAWS_PER_EXTRA_OBJECT * (r.objects - baseline.objects),
      )
      if (r.objects > TIMING_GATED_UP_TO) continue
      expect(r.stats.medianMs, `${label}: median frame time vs baseline`).toBeLessThanOrEqual(
        baseline.stats.medianMs * MAX_MEDIAN_RATIO + MEDIAN_SLACK_MS,
      )
      expect(r.stats.p99Ms, `${label}: hitches (p99 vs median)`).toBeLessThanOrEqual(
        Math.max(r.stats.medianMs * MAX_P99_OVER_MEDIAN, 50),
      )
    }
  })
}
