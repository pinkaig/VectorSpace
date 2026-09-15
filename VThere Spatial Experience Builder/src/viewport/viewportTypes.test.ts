import { describe, expect, it } from 'vitest'
import { colorFor, getVerticalDirection, getWalkDirection, isTypingTarget } from './viewportTypes'

describe('viewport policies', () => {
  it('maps supported asset kinds to stable presentation colors', () => {
    expect(colorFor('cube')).toBe(0x4ea7a0)
    expect(colorFor('sphere')).toBe(0xe6ad5a)
    expect(colorFor('cylinder')).toBe(0xd66d75)
  })

  it('combines walk keys and ignores unrelated keys', () => {
    expect(getWalkDirection(['KeyW', 'KeyD', 'ShiftLeft', 'Escape'])).toEqual({ x: 1, z: 1 })
    expect(getWalkDirection(['KeyW', 'KeyS'])).toEqual({ x: 0, z: 0 })
  })

  it('combines vertical keys', () => {
    expect(getVerticalDirection(['Space', 'KeyC'])).toBe(0)
    expect(getVerticalDirection(['Space', 'Escape'])).toBe(1)
  })

  it('identifies editable text targets without requiring a browser element', () => {
    const target = (tagName: string, isContentEditable: boolean) => ({ tagName, isContentEditable }) as unknown as EventTarget
    expect(isTypingTarget(target('INPUT', false))).toBe(true)
    expect(isTypingTarget(target('DIV', true))).toBe(true)
    expect(isTypingTarget(target('BUTTON', false))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})