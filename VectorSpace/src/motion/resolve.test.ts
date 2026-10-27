import { describe, expect, it } from 'vitest'
import { resolveDuration, resolveEasing, resolveRecipe } from './resolve'
import type { DriverOpts, MotionRecipe } from './types'

const noPage = () => ''
const opts = (patch: Partial<DriverOpts> = {}): DriverOpts => ({ gain: 1, stagger: 0, staggerIndex: 0, ...patch })

const slide: MotionRecipe = {
  keyframes: [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0px)' },
  ],
  duration: 'base',
  easing: 'standard',
}

describe('resolveRecipe', () => {
  it('passes the keyframes through and fills "both" by default, so the element does not snap back at the end', () => {
    const plan = resolveRecipe(slide, opts(), false, noPage)
    expect(plan?.keyframes).toEqual(slide.keyframes)
    expect(plan?.options.fill).toBe('both')
  })

  it('reads token names from the page when it can, so a slider on the board retunes recipes', () => {
    const page = (name: string) => ({ '--mo-dur-base': '0.5s', '--mo-ease-standard': ' ease-in ' })[name] ?? ''
    const plan = resolveRecipe(slide, opts(), false, page)
    expect(plan?.options.duration).toBe(500)
    expect(plan?.options.easing).toBe('ease-in')
  })

  it('falls back to the sheet defaults when the page cannot be asked', () => {
    expect(resolveDuration('slow', noPage)).toBe(320)
    expect(resolveDuration(75, noPage)).toBe(75)
    expect(resolveEasing('exit', noPage)).toBe('cubic-bezier(0.4, 0, 1, 1)')
    expect(resolveEasing('linear(0, 1)', noPage)).toBe('linear(0, 1)')
  })

  it('adds the stagger as delay: index times the gap, on top of the recipe delay', () => {
    const plan = resolveRecipe({ ...slide, delay: 10 }, opts({ stagger: 20, staggerIndex: 3 }), false, noPage)
    expect(plan?.options.delay).toBe(70)
  })

  it('reduced motion with "skip" plays nothing', () => {
    expect(resolveRecipe({ ...slide, reducedMotion: 'skip' }, opts(), true, noPage)).toBeNull()
  })

  it('reduced motion with "fade" keeps only opacity and collapses the duration to 0', () => {
    const plan = resolveRecipe({ ...slide, reducedMotion: 'fade' }, opts(), true, noPage)
    expect(plan?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(plan?.options.duration).toBe(0)
  })

  it('reduced motion with nothing said means "fade"', () => {
    const plan = resolveRecipe(slide, opts(), true, noPage)
    expect(plan?.keyframes.every((frame) => !('transform' in frame))).toBe(true)
  })

  it('reduced motion with "full" ignores the preference', () => {
    const plan = resolveRecipe({ ...slide, reducedMotion: 'full' }, opts(), true, noPage)
    expect(plan?.keyframes).toEqual(slide.keyframes)
    expect(plan?.options.duration).toBe(220)
  })

  it('a visitor with no preference gets the full recipe even when it says "skip"', () => {
    expect(resolveRecipe({ ...slide, reducedMotion: 'skip' }, opts(), false, noPage)).not.toBeNull()
  })
})
