import { describe, expect, it } from 'vitest'
import { createCommandTimeline } from './index'

describe('command timeline', () => {
  it('restores committed snapshots without sharing mutable state', () => {
    const timeline = createCommandTimeline({ value: 0 }, (state) => ({ ...state }))

    timeline.commit('change value', { value: 1 })
    expect(timeline.current).toEqual({ value: 1 })

    timeline.undo()
    expect(timeline.current).toEqual({ value: 0 })
    expect(timeline.canRedo).toBe(true)

    const snapshot = timeline.current
    snapshot.value = 99
    expect(timeline.current).toEqual({ value: 0 })

    timeline.redo()
    expect(timeline.current).toEqual({ value: 1 })
  })
})