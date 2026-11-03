import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import cueMap from './cue-map.json'
import { UiSoundPlayer } from './UiSoundPlayer'

// A player whose "end of task" is a manual flush, so each test decides when the task ends.
const setup = (muted = false) => {
  const played: string[] = []
  const queue: Array<() => void> = []
  const player = new UiSoundPlayer((cueId) => played.push(cueId), { muted, schedule: (flush) => queue.push(flush) })
  const endTask = () => queue.splice(0).forEach((flush) => flush())
  return { player, played, endTask }
}

describe('UiSoundPlayer: one sound per gesture', () => {
  it('plays a press at the end of the task, not at once', () => {
    const { player, played, endTask } = setup()
    player.press('ui.click')
    expect(played).toEqual([])
    endTask()
    expect(played).toEqual(['ui.click'])
  })

  it('lets an outcome replace the press that caused it', () => {
    const { player, played, endTask } = setup()
    player.press('ui.click')
    player.play('ui.close')
    endTask()
    expect(played).toEqual(['ui.close'])
  })

  it('never lets a press displace an outcome already waiting', () => {
    const { player, played, endTask } = setup()
    player.play('ui.dialog.open')
    player.press('ui.click')
    endTask()
    expect(played).toEqual(['ui.dialog.open'])
  })

  it('keeps the last outcome, so StrictMode open-close-open makes one open', () => {
    const { player, played, endTask } = setup()
    player.play('ui.dialog.open')
    player.play('ui.close')
    player.play('ui.dialog.open')
    endTask()
    expect(played).toEqual(['ui.dialog.open'])
  })

  it('plays an outcome that arrives in a later task (a reply from the server) after the click', () => {
    const { player, played, endTask } = setup()
    player.press('ui.click.primary')
    endTask()
    player.play('publish.sent')
    endTask()
    expect(played).toEqual(['ui.click.primary', 'publish.sent'])
  })

  it('treats null and undefined as no sound, without dropping what is waiting', () => {
    const { player, played, endTask } = setup()
    player.press('ui.click')
    player.play(null)
    player.press(undefined)
    endTask()
    expect(played).toEqual(['ui.click'])
  })
})

describe('UiSoundPlayer: on and off', () => {
  it('makes no sound while muted', () => {
    const { player, played, endTask } = setup(true)
    player.press('ui.click')
    player.play('ui.close')
    endTask()
    expect(played).toEqual([])
  })

  it('drops a sound that was waiting when the person muted', () => {
    const { player, played, endTask } = setup()
    player.press('ui.click')
    player.setMuted(true)
    endTask()
    expect(played).toEqual([])
  })

  it('tells subscribers when the choice changes, and only then', () => {
    const { player } = setup()
    let calls = 0
    const stop = player.subscribe(() => calls++)
    player.setMuted(true)
    player.setMuted(true)
    player.setMuted(false)
    stop()
    player.setMuted(true)
    expect(calls).toBe(2)
  })
})

// A cue id the map does not have is silent, with no error. This catches the typo instead.
describe('cue ids used in src/', () => {
  const srcRoot = join(__dirname, '..')
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return files(path)
      return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
    })
  // every dotted id inside a play/press/useUiSoundIn call (so both sides of a ternary count), and
  // the cue prop of a Button or Popup (not <Motion cue>, which names a motion cue)
  const calls = /(?:uiSound\.(?:play|press)|useUiSoundIn)\(([^)\n]*)\)|<(?:Button|Popup)\b(?:=>|[^>])*?\bcue="([^"]+)"/g
  const used = new Set<string>()
  for (const file of files(srcRoot)) {
    for (const [, args, prop] of readFileSync(file, 'utf8').matchAll(calls)) {
      if (prop) used.add(prop)
      for (const [, cueId] of (args ?? '').matchAll(/["']([a-z]+(?:\.[a-z-]+)+)["']/g)) used.add(cueId)
    }
  }
  const known = new Set(cueMap.cues.map((cue) => cue.id))

  it('finds the wiring at all', () => {
    expect(used.size).toBeGreaterThan(5)
  })

  it.each([...used].sort())('"%s" is a cue in cue-map.json', (cueId) => {
    expect(known.has(cueId)).toBe(true)
  })
})
