import { describe, expect, it } from 'vitest'
import { emptyTimeline, percentile, summarizeMetric, summarizeRuns, toPhases } from './phases'

describe('toPhases', () => {
  it('derives spans, counts and totals from a raw timeline', () => {
    const phases = toPhases({
      ...emptyTimeline(),
      firstDrawMs: 400,
      interactiveMs: 350,
      audioContexts: [{ at: 100, state: 'suspended' }, { at: 110, state: 'running' }],
      audioResources: [
        { start: 100, end: 180, transferSize: 1000 },
        { start: 120, end: 260, transferSize: 2000 },
      ],
      decodes: [
        { start: 180, end: 230, bytes: 1000, ok: true },
        { start: 260, end: 300, bytes: 2000, ok: false },
      ],
      longTasks: [{ start: 120, duration: 80 }],
    })
    expect(phases.audioFetchSpanMs).toBe(160)
    expect(phases.audioReadyMs).toBe(300)
    expect(phases.audioDecodeTotalMs).toBe(90)
    expect(phases.audioDecodeFailures).toBe(1)
    expect(phases.audioContextsSuspended).toBe(1)
    expect(phases.audioTransferBytes).toBe(3000)
    expect(phases.longTaskTotalMs).toBe(80)
  })

  it('reports zeros for an empty timeline instead of throwing', () => {
    const phases = toPhases(emptyTimeline())
    expect(phases.audioFetchSpanMs).toBe(0)
    expect(phases.audioReadyMs).toBe(0)
  })
})

describe('summaries', () => {
  it('interpolates percentiles', () => {
    expect(percentile([10, 20], 0.5)).toBe(15)
    expect(percentile([], 0.5)).toBe(0)
  })

  it('computes spread ratio as p95 over median and guards a zero median', () => {
    const steady = summarizeMetric([100, 100, 100, 100])
    expect(steady.spreadRatio).toBe(1)
    const noisy = summarizeMetric([100, 100, 100, 100, 100, 100, 100, 100, 100, 500])
    expect(noisy.spreadRatio).toBeGreaterThan(1)
    expect(summarizeMetric([0, 0]).spreadRatio).toBe(0)
  })

  it('summarises every metric across runs', () => {
    const run = toPhases({ ...emptyTimeline(), firstDrawMs: 200 })
    const summary = summarizeRuns([run, { ...run, firstDrawMs: 300 }])
    expect(summary.firstDrawMs.median).toBe(250)
    expect(summary.firstDrawMs.max).toBe(300)
  })
})
