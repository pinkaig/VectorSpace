/**
 * Pure reduction of a raw startup timeline into named phases, and of many runs
 * into a spread summary. No browser or Playwright imports, so it is
 * unit-testable under vitest (same convention as tests/e2e/perf/stats.ts, which
 * it deliberately does not import so the two suites stay independent).
 */
import type { RawTimeline } from './startupProbe'

export interface StartupPhases {
  domContentLoadedMs: number
  firstContentfulPaintMs: number
  /** App UI usable (button visible); measured by the spec, not the app. */
  interactiveMs: number
  firstDrawMs: number
  /** First audio request start to last audio response end. */
  audioFetchSpanMs: number
  /** First decode start to last decode end. */
  audioReadyMs: number
  /** Sum of individual decode durations (CPU/worker work, not wall time). */
  audioDecodeTotalMs: number
  audioFileCount: number
  audioDecodeCount: number
  audioDecodeFailures: number
  audioContextsCreated: number
  audioContextsSuspended: number
  audioTransferBytes: number
  scriptTransferBytes: number
  longTaskCount: number
  longTaskTotalMs: number
}

const span = (values: number[][]): number => {
  const starts = values.map((v) => v[0])
  const ends = values.map((v) => v[1])
  return starts.length === 0 ? 0 : Math.max(...ends) - Math.min(...starts)
}

export const toPhases = (raw: RawTimeline): StartupPhases => {
  const decodeEnds = raw.decodes.map((d) => d.end)
  return {
    domContentLoadedMs: raw.domContentLoadedMs ?? 0,
    firstContentfulPaintMs: raw.firstContentfulPaintMs ?? 0,
    interactiveMs: raw.interactiveMs ?? 0,
    firstDrawMs: raw.firstDrawMs ?? 0,
    audioFetchSpanMs: span(raw.audioResources.map((r) => [r.start, r.end])),
    audioReadyMs: decodeEnds.length === 0 ? 0 : Math.max(...decodeEnds),
    audioDecodeTotalMs: raw.decodes.reduce((sum, d) => sum + (d.end - d.start), 0),
    audioFileCount: raw.audioResources.length,
    audioDecodeCount: raw.decodes.length,
    audioDecodeFailures: raw.decodes.filter((d) => !d.ok).length,
    audioContextsCreated: raw.audioContexts.length,
    audioContextsSuspended: raw.audioContexts.filter((c) => c.state === 'suspended').length,
    audioTransferBytes: raw.audioResources.reduce((sum, r) => sum + r.transferSize, 0),
    scriptTransferBytes: raw.scriptTransferBytes,
    longTaskCount: raw.longTasks.length,
    longTaskTotalMs: raw.longTasks.reduce((sum, t) => sum + t.duration, 0),
  }
}

export interface MetricSummary {
  median: number
  p95: number
  min: number
  max: number
  /** p95 / median; 0 when the median is 0. The repeatability number. */
  spreadRatio: number
}

/** Linear-interpolated percentile of an ascending-sorted array; `p` in [0, 1]. */
export const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0
  const rank = p * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

export const summarizeMetric = (values: readonly number[]): MetricSummary => {
  const sorted = [...values].sort((a, b) => a - b)
  const median = percentile(sorted, 0.5)
  const p95 = percentile(sorted, 0.95)
  return {
    median,
    p95,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    spreadRatio: median === 0 ? 0 : p95 / median,
  }
}

export const summarizeRuns = (runs: readonly StartupPhases[]): Record<keyof StartupPhases, MetricSummary> => {
  const keys = Object.keys(runs[0] ?? toPhases(emptyTimeline())) as (keyof StartupPhases)[]
  return Object.fromEntries(keys.map((key) => [key, summarizeMetric(runs.map((r) => r[key]))])) as Record<keyof StartupPhases, MetricSummary>
}

export const emptyTimeline = (): RawTimeline => ({
  domContentLoadedMs: null,
  loadMs: null,
  firstContentfulPaintMs: null,
  firstDrawMs: null,
  audioContexts: [],
  decodes: [],
  pendingDecodes: 0,
  audioResources: [],
  scriptTransferBytes: 0,
  longTasks: [],
  interactiveMs: null,
})
