import { describe, expect, it } from 'vitest'
import { snapAngle, snapScale, snapToFloorGrid } from './snapping'

describe('snapping', () => {
  it('puts x and z on the floor grid every half cell and leaves the height alone', () => {
    expect(snapToFloorGrid([1.26, 0.55, -0.74])).toEqual([1.5, 0.55, -0.5])
    expect(snapToFloorGrid([0.2, 2, 3.1])).toEqual([0, 2, 3])
  })

  it('turns in 15 degree steps', () => {
    const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)
    expect(degrees(snapAngle((40 * Math.PI) / 180))).toBe(45)
    expect(degrees(snapAngle((-8 * Math.PI) / 180))).toBe(-15)
    expect(degrees(snapAngle((7 * Math.PI) / 180))).toBe(0)
  })

  it('sizes in quarter steps and never shrinks below a quarter', () => {
    expect(snapScale(1.13)).toBe(1.25)
    expect(snapScale(0.9)).toBe(1)
    expect(snapScale(0.05)).toBe(0.25)
  })
})
