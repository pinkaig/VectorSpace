/**
 * @file        overrides.ts
 * @brief       Keeps board edits across reloads, as a small diff against cue-map.json.
 *
 * @responsibility
 * Board changes (a different sound for a cue, a volume nudge) survive a refresh
 * so a consultation can be paused and resumed. Stored in this browser only
 * (localStorage), as differences from the shipped map: if cue-map.json changes
 * on disk, cues the board never touched pick up the new file. The durable way
 * to keep a change is "Copy cue-map.json" on the board, then paste it over the
 * file. Audio dropped onto a cue exists only in memory and is skipped here.
 */
import type { CueBank, CueMap } from '../../packages/audio/src/index'

const KEY = 'vs-ui-audio-overrides:v1'

interface Overrides {
  cues: Record<string, { sounds?: string[]; gain?: number }>
  sounds: Record<string, { volume?: number }>
}

const read = (): Overrides | null => {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Overrides) : null
  } catch {
    return null
  }
}

export function applyOverrides(bank: CueBank): void {
  const saved = read()
  if (!saved) return
  const known = new Set(bank.soundList().map((sound) => sound.id))
  for (const [cueId, patch] of Object.entries(saved.cues)) {
    if (!bank.getCue(cueId)) continue
    if (patch.sounds && patch.sounds.every((soundId) => known.has(soundId))) bank.assign(cueId, patch.sounds)
    if (patch.gain !== undefined) bank.updateCue(cueId, { gain: patch.gain })
  }
  for (const [soundId, patch] of Object.entries(saved.sounds)) {
    if (known.has(soundId) && patch.volume !== undefined) bank.updateSound(soundId, { volume: patch.volume })
  }
}

export function watchOverrides(bank: CueBank, original: CueMap): void {
  bank.onChange(() => {
    const now = bank.toJSON()
    const diff: Overrides = { cues: {}, sounds: {} }
    for (const cue of now.cues) {
      const before = original.cues.find((candidate) => candidate.id === cue.id)
      if (!before) continue
      const patch: Overrides['cues'][string] = {}
      const customAudio = cue.sounds.some((soundId) => !Object.hasOwn(original.sounds, soundId))
      if (!customAudio && cue.sounds.join() !== before.sounds.join()) patch.sounds = cue.sounds
      if ((cue.gain ?? 1) !== (before.gain ?? 1)) patch.gain = cue.gain ?? 1
      if (Object.keys(patch).length > 0) diff.cues[cue.id] = patch
    }
    for (const [soundId, sound] of Object.entries(now.sounds)) {
      const before = original.sounds[soundId]
      if (before && sound.volume !== before.volume) diff.sounds[soundId] = { volume: sound.volume }
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(diff))
    } catch {
      // Storage can be blocked (private window); the board still works, it just forgets on reload.
    }
  })
}

export function clearOverrides(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}
