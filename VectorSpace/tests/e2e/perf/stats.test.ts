import { describe, expect, it } from 'vitest'
import { frameStats, percentile } from './stats'

describe('frameStats', () => {
  it('reports a steady 60 fps stream as stable', () => {
    const stats = frameStats(Array(100).fill(1000 / 60))
    expect(stats.avgFps).toBeCloseTo(60)
    expect(stats.stddevMs).toBeCloseTo(0)
    expect(stats.slowFrames).toBe(0)
  })

  it('surfaces hitches in p99/max/slowFrames even when the average looks fine', () => {
    const stats = frameStats([...Array(98).fill(16), 120, 120])
    expect(stats.avgFps).toBeGreaterThan(55)
    expect(stats.maxMs).toBe(120)
    expect(stats.p99Ms).toBeGreaterThan(100)
    expect(stats.slowFrames).toBe(2)
  })

  it('handles empty input and interpolates percentiles', () => {
    expect(frameStats([]).frames).toBe(0)
    expect(percentile([10, 20], 0.5)).toBe(15)
  })
})
