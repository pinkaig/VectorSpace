import { describe, expect, it, vi } from 'vitest'
import { FakeMotionDriver } from './fakeDriver'
import { MotionBank, STAGGER_CAP, validateMotionMap } from './MotionBank'
import type { MotionMap } from './types'

const map = (): MotionMap => ({
  recipes: {
    fade: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 'base', easing: 'standard' },
    pop: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 'fast', easing: 'emphasis' },
  },
  cues: [
    { id: 'popup.enter', label: 'Popup opens', group: 'popup', tier: 1, recipe: 'fade' },
    { id: 'table.rows.enter', label: 'Rows arrive', group: 'table', tier: 2, recipe: 'fade', gain: 0.5, stagger: 20 },
    { id: 'tile.value.change', label: 'Tile changes', group: 'tile', tier: 3, recipe: '', placeholder: true },
    { id: 'broken.cue', label: 'Points nowhere', group: 'popup', tier: 2, recipe: 'missing' },
  ],
})

const setup = () => {
  const driver = new FakeMotionDriver()
  const warn = vi.fn()
  const bank = new MotionBank(map(), driver, { warn })
  // the bank only uses an element as a key, so a plain object stands in for one
  const el = () => ({}) as Element
  return { driver, warn, bank, el }
}

describe('MotionBank', () => {
  it('plays a known cue by handing its recipe to the driver', () => {
    const { driver, bank, el } = setup()
    const target = el()
    bank.play('popup.enter', target)
    expect(driver.plays).toHaveLength(1)
    expect(driver.plays[0].el).toBe(target)
    expect(driver.plays[0].recipe.duration).toBe('base')
  })

  it('treats an unknown cue as a skip: no throw, one warning per id, a handle that is already settled', async () => {
    const { driver, warn, bank, el } = setup()
    const handle = bank.play('nope.nothing', el())
    bank.play('nope.nothing', el())
    expect(driver.plays).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    await expect(handle.finished).resolves.toBe(true)
  })

  it('plays nothing for a placeholder cue and does not warn', async () => {
    const { driver, warn, bank, el } = setup()
    await expect(bank.play('tile.value.change', el()).finished).resolves.toBe(true)
    expect(driver.plays).toHaveLength(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('skips, with one warning, a cue whose recipe is missing', () => {
    const { driver, warn, bank, el } = setup()
    bank.play('broken.cue', el())
    bank.play('broken.cue', el())
    expect(driver.plays).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('missing')
  })

  it('retarget changes which recipe the next play uses', () => {
    const { driver, bank, el } = setup()
    bank.play('popup.enter', el())
    bank.retarget('popup.enter', 'pop')
    bank.play('popup.enter', el())
    expect(driver.plays.map((play) => play.recipe.duration)).toEqual(['base', 'fast'])
  })

  it('retarget also turns a placeholder cue into a live one', () => {
    const { driver, bank, el } = setup()
    bank.retarget('tile.value.change', 'pop')
    bank.play('tile.value.change', el())
    expect(driver.plays).toHaveLength(1)
  })

  it('a second play on the same element cancels the first; a different element is left alone', () => {
    const { driver, bank, el } = setup()
    const first = el()
    bank.play('popup.enter', first)
    bank.play('popup.enter', el())
    expect(driver.plays[0].cancelled).toBe(false)
    bank.play('popup.enter', first)
    expect(driver.plays[0].cancelled).toBe(true)
    expect(driver.plays[2].cancelled).toBe(false)
  })

  it('a cancelled play settles as false and never rejects, so a waiting caller always continues', async () => {
    const { driver, bank, el } = setup()
    const target = el()
    const first = bank.play('popup.enter', target)
    bank.play('popup.enter', target)
    await expect(first.finished).resolves.toBe(false)
    driver.plays[1].finish()
  })

  it('passes gain and stagger to the driver as computed, not raw', () => {
    const { driver, bank, el } = setup()
    bank.play('table.rows.enter', el(), { gain: 0.5, staggerIndex: 3 })
    expect(driver.plays[0].opts).toEqual({ gain: 0.25, stagger: 20, staggerIndex: 3 })
  })

  it('caps the stagger index so a long table does not take seconds to arrive', () => {
    const { driver, bank, el } = setup()
    bank.play('table.rows.enter', el(), { staggerIndex: 200 })
    expect(driver.plays[0].opts.staggerIndex).toBe(STAGGER_CAP)
  })

  it('tells listeners about plays and about edits, and lets them unsubscribe', () => {
    const { bank, el } = setup()
    const played = vi.fn()
    const changed = vi.fn()
    const stop = bank.onPlay(played)
    bank.onChange(changed)
    bank.play('popup.enter', el())
    bank.updateRecipe('fade', { delay: 10 })
    expect(played).toHaveBeenCalledWith({ cueId: 'popup.enter', recipeId: 'fade' })
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
    bank.play('popup.enter', el())
    expect(played).toHaveBeenCalledTimes(1)
  })

  it('exports its current state, and edits never write back into the map it was built from', () => {
    const source = map()
    const bank = new MotionBank(source, new FakeMotionDriver(), { warn: () => {} })
    bank.retarget('popup.enter', 'pop')
    bank.updateRecipe('fade', { duration: 999 })
    expect(bank.toJSON().cues.find((cue) => cue.id === 'popup.enter')?.recipe).toBe('pop')
    expect(bank.toJSON().recipes.fade.duration).toBe(999)
    expect(source.cues[0].recipe).toBe('fade')
    expect(source.recipes.fade.duration).toBe('base')
  })
})

describe('validateMotionMap', () => {
  it('is empty for a usable map, ignoring placeholders that have no recipe', () => {
    const usable = map()
    usable.cues = usable.cues.filter((cue) => cue.id !== 'broken.cue')
    expect(validateMotionMap(usable)).toEqual([])
  })

  it('names a duplicate cue and a missing recipe in words a designer can act on', () => {
    const bad = map()
    bad.cues.push({ ...bad.cues[0] })
    const problems = validateMotionMap(bad)
    expect(problems).toContain('Cue "popup.enter" is listed twice')
    expect(problems).toContain('Cue "broken.cue" uses recipe "missing", which is not in the recipes list')
  })
})
