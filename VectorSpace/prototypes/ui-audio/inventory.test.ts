import { describe, expect, it } from 'vitest'
import { SCREENS, controlsByCue, scanKey, toCsv, type ProbeItem, type ScreenScan } from './inventory'

const item = (label: string, heard: string[], extra: Partial<ProbeItem> = {}): ProbeItem => ({ label, kind: 'button', click: heard[0] ?? null, clickBy: null, hover: 'ui.hover', heard, ...extra })

const scans: ScreenScan[] = [
  { id: 'home', name: 'Home', items: [item('Next', ['ui.click']), item('Done', ['ui.click.primary']), item('Search', [], { kind: 'field', hover: null })] },
  { id: 'rule', name: 'Rule', items: [item('Next', ['ui.click']), item('Quiet', ['ui.select']), item('Step 2', ['editor.step', 'nav.screen'])] },
]

describe('controlsByCue', () => {
  it('lists each control once per cue and gathers the screens it appears on', () => {
    const next = controlsByCue(scans).get('ui.click')?.find((control) => control.role === 'press')
    expect(next).toEqual({ label: 'Next', kind: 'button', role: 'press', screens: ['Home', 'Rule'] })
  })

  it('credits every cue a press plays, not only the first', () => {
    const byCue = controlsByCue(scans)
    expect(byCue.get('editor.step')?.[0].label).toBe('Step 2')
    expect(byCue.get('nav.screen')?.[0].label).toBe('Step 2')
  })

  it('keeps hover and press apart, and skips text fields', () => {
    const hovers = controlsByCue(scans).get('ui.hover') ?? []
    expect(hovers.every((control) => control.role === 'hover')).toBe(true)
    expect(hovers.map((control) => control.label)).not.toContain('Search')
  })

  it('puts the control seen on the most screens first', () => {
    expect(controlsByCue(scans).get('ui.hover')?.[0].label).toBe('Next')
  })
})

describe('toCsv', () => {
  it('writes one row per control per screen with its best priority', () => {
    const csv = toCsv(scans, (cueId) => ({ 'ui.click': 1, 'editor.step': 1, 'nav.screen': 2, 'ui.select': 2 })[cueId])
    const rows = csv.split('\n')
    expect(rows[0]).toBe('screen,control,type,plays when pressed,tier,plays on hover,binding rule')
    expect(rows).toHaveLength(1 + 6)
    expect(rows).toContain('Rule,Step 2,button,editor.step + nav.screen,P1,ui.hover,')
  })

  it('says silent for a control that plays nothing, and quotes cells that contain commas', () => {
    const csv = toCsv([{ id: 'x', name: 'X', items: [item('Save, then close', [])] }], () => undefined)
    expect(csv.split('\n')[1]).toBe('X,"Save, then close",button,silent,,ui.hover,')
  })
})

describe('scanKey', () => {
  it('changes when the bindings change, and not otherwise', () => {
    expect(scanKey('{"a":1}')).toBe(scanKey('{"a":1}'))
    expect(scanKey('{"a":1}')).not.toBe(scanKey('{"a":2}'))
  })
})

describe('SCREENS', () => {
  it('names every scan once, so results can be keyed by name', () => {
    const names = SCREENS.map((screen) => screen.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
