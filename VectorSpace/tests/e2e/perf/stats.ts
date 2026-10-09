/**
 * Pure frame-time statistics for the renderer performance check.
 * No browser or Playwright imports, so it is unit-testable under vitest.
 */
export interface FrameStats {
  frames: number
  avgFps: number
  medianMs: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  stddevMs: number
  /** Frames slower than 33.3 ms (below 30 fps). */
  slowFrames: number
}

/** Linear-interpolated percentile of an ascending-sorted array; `p` in [0, 1]. */
export const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0
  const rank = p * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

export const frameStats = (frameMs: readonly number[]): FrameStats => {
  if (frameMs.length === 0) {
    return { frames: 0, avgFps: 0, medianMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, stddevMs: 0, slowFrames: 0 }
  }
  const sorted = [...frameMs].sort((a, b) => a - b)
  const mean = frameMs.reduce((sum, v) => sum + v, 0) / frameMs.length
  const variance = frameMs.reduce((sum, v) => sum + (v - mean) ** 2, 0) / frameMs.length
  return {
    frames: frameMs.length,
    avgFps: 1000 / mean,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1],
    stddevMs: Math.sqrt(variance),
    slowFrames: frameMs.filter((v) => v > 1000 / 30).length,
  }
}
