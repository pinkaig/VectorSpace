import { describe, expect, it } from 'vitest'
import { allHold, condHolds, edgeFired, readPath, volumeGain, type Binding, type RenderContext } from './conditions'

const ctx = (state: Record<string, unknown>, vals: Record<string, unknown> = {}): RenderContext => ({ state, vals })

const binding = (patch: Partial<Binding>): Binding => ({ cue: 'x', component: 'x', on: 'state', ...patch })

describe('readPath', () => {
  it('reads state and vals, with nesting, and gives undefined for anything missing', () => {
    const now = ctx({ opt: { vol: 'loud' } }, { briefDone: '2' })
    expect(readPath(now, 'state.opt.vol')).toBe('loud')
    expect(readPath(now, 'vals.briefDone')).toBe('2')
    expect(readPath(now, 'state.nope.deeper')).toBeUndefined()
    expect(readPath(now, 'other.x')).toBeUndefined()
    expect(readPath(null, 'state.x')).toBeUndefined()
  })
})

describe('edgeFired', () => {
  it('becomes: true fires on the rise only, and treats any truthy value as true', () => {
    const b = binding({ watch: 'state.placed', becomes: true })
    expect(edgeFired(b, ctx({ placed: true }), ctx({ placed: false }))).toBe(true)
    expect(edgeFired(b, ctx({ placed: true }), ctx({ placed: true }))).toBe(false)
    expect(edgeFired(b, ctx({ placed: false }), ctx({ placed: true }))).toBe(false)
    expect(edgeFired(b, ctx({ placed: 'error' }), ctx({ placed: null }))).toBe(true)
  })

  it('becomes with a value fires when the state arrives at that value, not while it stays there', () => {
    const b = binding({ watch: 'state.popup', becomes: 'error' })
    expect(edgeFired(b, ctx({ popup: 'error' }), ctx({ popup: null }))).toBe(true)
    expect(edgeFired(b, ctx({ popup: 'error' }), ctx({ popup: 'loading' }))).toBe(true)
    expect(edgeFired(b, ctx({ popup: 'error' }), ctx({ popup: 'error' }))).toBe(false)
    expect(edgeFired(b, ctx({ popup: 'loading' }), ctx({ popup: null }))).toBe(false)
  })

  it('leaves fires when the state departs from a value', () => {
    const b = binding({ watch: 'state.view', leaves: 'play' })
    expect(edgeFired(b, ctx({ view: 'editor' }), ctx({ view: 'play' }))).toBe(true)
    expect(edgeFired(b, ctx({ view: 'play' }), ctx({ view: 'play' }))).toBe(false)
  })

  it('changes uses identity, so a rebuilt object counts and an untouched one does not', () => {
    const b = binding({ watch: 'state.opt', changes: true })
    const opt = { vol: 'normal' }
    expect(edgeFired(b, ctx({ opt }), ctx({ opt }))).toBe(false)
    expect(edgeFired(b, ctx({ opt: { ...opt } }), ctx({ opt }))).toBe(true)
  })

  it('increases compares as numbers, because the mockup hands briefDone over as a string', () => {
    const b = binding({ watch: 'vals.briefDone', increases: true })
    expect(edgeFired(b, ctx({}, { briefDone: '2' }), ctx({}, { briefDone: '1' }))).toBe(true)
    expect(edgeFired(b, ctx({}, { briefDone: '10' }), ctx({}, { briefDone: '9' }))).toBe(true)
    expect(edgeFired(b, ctx({}, { briefDone: '1' }), ctx({}, { briefDone: '2' }))).toBe(false)
    expect(edgeFired(b, ctx({}, {}), ctx({}, {}))).toBe(false)
  })

  it('fires if any one of several watched paths has the edge', () => {
    const b = binding({ watch: ['vals.roomsOpen', 'vals.publishOpen'], becomes: true })
    expect(edgeFired(b, ctx({}, { roomsOpen: false, publishOpen: true }), ctx({}, { roomsOpen: false, publishOpen: false }))).toBe(true)
    expect(edgeFired(b, ctx({}, { roomsOpen: false, publishOpen: false }), ctx({}, { roomsOpen: false, publishOpen: false }))).toBe(false)
  })
})

describe('condHolds', () => {
  it('equals, in and notIn all have to hold, and default stands in for an unset value', () => {
    const now = ctx({ move: 'walk' })
    expect(condHolds({ watch: 'state.move', equals: 'walk' }, now, null)).toBe(true)
    expect(condHolds({ watch: 'state.move', in: ['tap', 'tour'] }, now, null)).toBe(false)
    expect(condHolds({ watch: 'state.move', notIn: ['tap'] }, now, null)).toBe(true)
    expect(condHolds({ watch: 'state.bgm', equals: 'hum', default: 'hum' }, now, null)).toBe(true)
    expect(condHolds({ watch: 'state.bgm', equals: 'piano', default: 'hum' }, now, null)).toBe(false)
  })

  it('prev reads the previous render, and is false when there is none', () => {
    const cond = { watch: 'state.view', notIn: ['play'], prev: true }
    expect(condHolds(cond, ctx({ view: 'editor' }), ctx({ view: 'play' }))).toBe(false)
    expect(condHolds(cond, ctx({ view: 'editor' }), ctx({ view: 'home' }))).toBe(true)
    expect(condHolds(cond, ctx({ view: 'editor' }), null)).toBe(false)
  })

  it('unchanged holds only when the value did not move this render', () => {
    const cond = { watch: 'state.view', unchanged: true }
    expect(condHolds(cond, ctx({ view: 'editor' }), ctx({ view: 'editor' }))).toBe(true)
    expect(condHolds(cond, ctx({ view: 'play' }), ctx({ view: 'editor' }))).toBe(false)
    expect(condHolds(cond, ctx({ view: 'play' }), null)).toBe(true)
  })

  it('allHold is true for no conditions and needs every one otherwise', () => {
    const now = ctx({ view: 'play', move: 'tap' })
    expect(allHold(undefined, now, null)).toBe(true)
    expect(allHold([{ watch: 'state.view', equals: 'play' }, { watch: 'state.move', equals: 'tap' }], now, null)).toBe(true)
    expect(allHold([{ watch: 'state.view', equals: 'play' }, { watch: 'state.move', equals: 'walk' }], now, null)).toBe(false)
  })
})

describe('volumeGain', () => {
  const by = { watch: 'state.opt.vol', default: 'normal', map: { quiet: 0.45, normal: 0.75, loud: 1 } }

  it('maps the chosen level, falls back to the default when unset, and to 1 for an unknown level', () => {
    expect(volumeGain(binding({ volumeBy: by }), ctx({ opt: { vol: 'quiet' } }))).toBe(0.45)
    expect(volumeGain(binding({ volumeBy: by }), ctx({ opt: {} }))).toBe(0.75)
    expect(volumeGain(binding({ volumeBy: by }), ctx({ opt: { vol: 'whisper' } }))).toBe(1)
    expect(volumeGain(binding({}), ctx({}))).toBe(1)
  })
})
