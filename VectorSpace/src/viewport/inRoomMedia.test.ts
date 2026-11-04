import { describe, expect, it } from 'vitest'
import { plainCardText, wrapLines } from './inRoomMedia'

describe('in-room sign text', () => {
  it('turns markdown-lite into the plain words a sign shows', () => {
    expect(plainCardText('# Hello\n\nThe **T-rex** was *big*. See the [guide](https://example.org).\n- teeth\n- claws'))
      .toBe('Hello\n\nThe T-rex was big. See the guide.\n• teeth\n• claws')
  })

  it('wraps to the width, keeps paragraphs apart, and ends with … when too long', () => {
    const measure = (text: string) => text.length * 10
    expect(wrapLines(measure, 'one two three four five', 100, 5)).toEqual(['one two', 'three four', 'five'])
    expect(wrapLines(measure, 'first\nsecond', 200, 5)).toEqual(['first', 'second'])
    expect(wrapLines(measure, 'a b c d e f g h', 30, 2)).toEqual(['a b', 'c…'])
  })
})
