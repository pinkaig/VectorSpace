import { describe, expect, it, vi } from 'vitest'
import { createActionSequencer, waitSeconds, type ActionGenerator } from './ActionSequencer'

describe('createActionSequencer', () => {
  it('does not advance a sequence until the first tick', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      steps.push('ran')
    })
    expect(steps).toEqual([])
    sequencer.tick(0.016)
    expect(steps).toEqual(['ran'])
  })

  it('advances one step per tick', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      steps.push('a')
      yield
      steps.push('b')
      yield
      steps.push('c')
    })
    sequencer.tick(0.016)
    expect(steps).toEqual(['a'])
    sequencer.tick(0.016)
    expect(steps).toEqual(['a', 'b'])
    sequencer.tick(0.016)
    expect(steps).toEqual(['a', 'b', 'c'])
  })

  it('reports a sequence as running until it completes', () => {
    const sequencer = createActionSequencer()
    const handle = sequencer.start(function* (): ActionGenerator {
      yield
    })
    expect(sequencer.isRunning(handle)).toBe(true)
    sequencer.tick(0.016)
    expect(sequencer.isRunning(handle)).toBe(true)
    sequencer.tick(0.016)
    expect(sequencer.isRunning(handle)).toBe(false)
    expect(sequencer.runningCount).toBe(0)
  })

  it('holds a sequence for the full waitSeconds duration', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      steps.push('before')
      yield waitSeconds(1)
      steps.push('after')
    })
    sequencer.tick(0.5)
    expect(steps).toEqual(['before'])
    sequencer.tick(0.4)
    expect(steps).toEqual(['before'])
    sequencer.tick(0.2) // total 1.1 > 1
    expect(steps).toEqual(['before', 'after'])
  })

  it('accumulates delta rather than reading a clock', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      yield waitSeconds(0.1)
      steps.push('done')
    })
    // One big frame satisfies the wait immediately; time comes only from delta.
    sequencer.tick(5)
    expect(steps).toEqual(['done'])
  })

  it('treats waitSeconds(0) as a one-frame yield', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      yield waitSeconds(0)
      steps.push('done')
    })
    sequencer.tick(0.016)
    expect(steps).toEqual(['done'])
  })

  it('stop halts a sequence mid-run', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    const handle = sequencer.start(function* (): ActionGenerator {
      steps.push('a')
      yield
      steps.push('b')
    })
    sequencer.tick(0.016)
    sequencer.stop(handle)
    sequencer.tick(0.016)
    expect(steps).toEqual(['a'])
    expect(sequencer.isRunning(handle)).toBe(false)
  })

  it('stop runs a sequence finally block so held effects are released', () => {
    const released: string[] = []
    const sequencer = createActionSequencer()
    const handle = sequencer.start(function* (): ActionGenerator {
      try {
        yield
        yield
      } finally {
        released.push('released')
      }
    })
    sequencer.tick(0.016)
    sequencer.stop(handle)
    expect(released).toEqual(['released'])
  })

  it('stop is safe on an unknown or already-finished handle', () => {
    const sequencer = createActionSequencer()
    const handle = sequencer.start(function* (): ActionGenerator {})
    sequencer.tick(0.016)
    expect(() => sequencer.stop(handle)).not.toThrow()
    expect(() => sequencer.stop({ id: 999 })).not.toThrow()
  })

  it('stopAll clears every sequence, staged ones included', () => {
    const sequencer = createActionSequencer()
    const a = sequencer.start(function* (): ActionGenerator { yield })
    sequencer.tick(0.016)
    const b = sequencer.start(function* (): ActionGenerator { yield })
    expect(sequencer.runningCount).toBe(2)
    sequencer.stopAll()
    expect(sequencer.runningCount).toBe(0)
    expect(sequencer.isRunning(a)).toBe(false)
    expect(sequencer.isRunning(b)).toBe(false)
  })

  it('stopAll runs finally blocks, as a reset must', () => {
    const released: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      try {
        yield
        yield
      } finally {
        released.push('one')
      }
    })
    sequencer.tick(0.016)
    sequencer.stopAll()
    expect(released).toEqual(['one'])
  })

  it('runs independent sequences concurrently', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      steps.push('a1'); yield; steps.push('a2')
    })
    sequencer.start(function* (): ActionGenerator {
      steps.push('b1'); yield; steps.push('b2')
    })
    sequencer.tick(0.016)
    expect(steps.slice().sort()).toEqual(['a1', 'b1'])
    sequencer.tick(0.016)
    expect(steps.slice().sort()).toEqual(['a1', 'a2', 'b1', 'b2'])
  })

  it('drops a throwing sequence without killing the tick', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      throw new Error('boom')
    })
    const survivor = sequencer.start(function* (): ActionGenerator {
      steps.push('survived')
      yield
    })
    expect(() => sequencer.tick(0.016)).not.toThrow()
    expect(steps).toEqual(['survived'])
    expect(sequencer.isRunning(survivor)).toBe(true)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('lets a sequence started during a tick join on the next tick', () => {
    const steps: string[] = []
    const sequencer = createActionSequencer()
    sequencer.start(function* (): ActionGenerator {
      steps.push('outer')
      sequencer.start(function* (): ActionGenerator {
        steps.push('inner')
      })
    })
    sequencer.tick(0.016)
    expect(steps).toEqual(['outer'])
    sequencer.tick(0.016)
    expect(steps).toEqual(['outer', 'inner'])
  })

  it('parks a zero-wait infinite loop instead of hanging the frame', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let iterations = 0
    const sequencer = createActionSequencer()
    const handle = sequencer.start(function* (): ActionGenerator {
      while (true) {
        iterations += 1
        yield waitSeconds(0)
      }
    })
    sequencer.tick(0.016)
    // Bounded, not infinite — and the sequence survives to continue next frame.
    expect(iterations).toBeLessThanOrEqual(1000)
    expect(iterations).toBeGreaterThan(0)
    expect(sequencer.isRunning(handle)).toBe(true)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('ticking with nothing running is a no-op', () => {
    const sequencer = createActionSequencer()
    expect(() => sequencer.tick(0.016)).not.toThrow()
    expect(sequencer.runningCount).toBe(0)
  })
})
