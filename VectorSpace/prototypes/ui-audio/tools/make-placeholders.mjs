/**
 * @file        make-placeholders.mjs
 * @brief       Writes the stand-in tones in sfx/placeholder/ so every cue has something to play.
 *
 * @responsibility
 * Every sound a cue needs (hover, click, close, notify, error, toggle, drop,
 * whoosh, door...) is a plain synthesised tone from here, flagged
 * `placeholder: true` in cue-map.json so the board and the brief can show what
 * still needs real audio. No third-party sample pack is shipped. They are meant
 * to be replaced, not tuned: the point is that the app sounds complete while
 * the real sounds are chosen.
 *
 * Deterministic on purpose (seeded noise), so re-running leaves git with no diff.
 *
 * Run from VectorSpace/:  node prototypes/ui-audio/tools/make-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../sfx/placeholder/', import.meta.url))
const SR = 44100
const TARGET_PEAK = 10 ** (-13 / 20) // matches the library, whose level-matched peaks sit near -13 dBFS

// mulberry32: a tiny seeded generator, so the noise in whooshes is the same every run.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const TAU = Math.PI * 2
const sine = (hz, t) => Math.sin(TAU * hz * t)
const decay = (t, tau) => Math.exp(-t / tau)
/** Linear fade-in over `attack` seconds, then exponential decay. Without the attack every note starts with a click. */
const pluck = (t, attack, tau) => Math.min(1, t / attack) * decay(t, tau)
const sweep = (from, to, t, duration) => from * (to / from) ** Math.min(1, t / duration)

/** Integrates frequency so a sweep stays phase-continuous (sine(f(t), t) would chirp wrongly). */
const sweepWave = (from, to, duration) => {
  let phase = 0
  return (t) => {
    phase += (TAU * sweep(from, to, t, duration)) / SR
    return Math.sin(phase)
  }
}

const render = (seconds, voice, rate = SR) => {
  const out = new Float32Array(Math.round(seconds * rate))
  for (let i = 0; i < out.length; i++) out[i] = voice(i / rate, i)
  return out
}

/** One-pole low-pass whose cutoff moves over time: the whole of a "whoosh". */
const filteredNoise = (seconds, cutoffAt, shape, seed) => {
  const rand = seeded(seed)
  let low = 0
  return render(seconds, (t) => {
    const a = 1 - Math.exp((-TAU * cutoffAt(t / seconds)) / SR)
    low += a * ((rand() * 2 - 1) - low)
    return low * shape(t / seconds)
  })
}

const bell = (hz, t, tau) => (sine(hz, t) + 0.35 * sine(hz * 2.76, t) * decay(t, tau * 0.5)) * pluck(t, 0.004, tau)

const sounds = {
  // Touch feedback: short, dry and quiet, since these are the sounds heard most.
  'hover-light': render(0.03, (t) => sine(2400, t) * pluck(t, 0.002, 0.008)),
  'click-small-1': render(0.06, (t) => sine(1500, t) * pluck(t, 0.002, 0.012)),
  'click-small-2': render(0.07, (t) => sine(1250, t) * pluck(t, 0.002, 0.016)),
  'click-positive-1': render(0.18, (t) => (sine(880, t) + 0.4 * sine(1760, t)) * pluck(t, 0.003, 0.05)),
  'click-positive-2': render(0.2, (t) => (t < 0.07 ? sine(740, t) * pluck(t, 0.003, 0.05) : sine(988, t - 0.07) * pluck(t - 0.07, 0.003, 0.06))),
  'notification-d': render(0.6, (t) => (t < 0.15 ? bell(784, t, 0.2) : bell(1047, t - 0.15, 0.3))),

  // Four close sounds, each a little different in pitch so dismissing cards in a row does not repeat.
  'quit-c': render(0.16, (t) => sine(sweep(700, 420, t, 0.12), t) * pluck(t, 0.003, 0.045)),
  'quit-c-2': render(0.16, (t) => sine(sweep(640, 380, t, 0.12), t) * pluck(t, 0.003, 0.045)),
  'quit-c-3': render(0.2, (t) => sine(sweep(760, 450, t, 0.14), t) * pluck(t, 0.003, 0.055)),
  'quit-c-4': render(0.15, (t) => sine(sweep(580, 350, t, 0.1), t) * pluck(t, 0.003, 0.04)),

  'toggle-on': render(0.14, (t) => sine(t < 0.06 ? 520 : 780, t) * pluck(t % 0.06, 0.004, 0.03)),
  'toggle-off': render(0.14, (t) => sine(t < 0.06 ? 780 : 520, t) * pluck(t % 0.06, 0.004, 0.03)),

  // Two low, slightly clashing bonks: reads as "not allowed" without being a scary alarm for children.
  error: render(0.42, (t) => {
    const hit = t < 0.2 ? t : t - 0.2
    return (sine(185, t) + sine(196, t)) * 0.5 * pluck(hit, 0.006, 0.07)
  }),

  // Squash-and-settle to match the vsDrop animation: a falling thump plus a tiny click on contact.
  drop: (() => {
    const body = sweepWave(190, 55, 0.12)
    const rand = seeded(7)
    return render(0.34, (t) => body(t) * pluck(t, 0.002, 0.07) + (rand() * 2 - 1) * decay(t, 0.006) * 0.35)
  })(),

  pop: (() => {
    const wave = sweepWave(420, 900, 0.07)
    return render(0.16, (t) => wave(t) * pluck(t, 0.003, 0.05))
  })(),

  // A job on the Mission brief ticked itself off: two rising bell notes, the closest thing here to a reward.
  'task-complete': render(0.5, (t) => (t < 0.11 ? bell(660, t, 0.18) : bell(990, t - 0.11, 0.22))),

  'step-up': render(0.4, (t) => [523, 659, 784].reduce((sum, hz, i) => sum + (t >= i * 0.07 ? bell(hz, t - i * 0.07, 0.14) : 0), 0) / 2),

  'whoosh-up': filteredNoise(0.45, (p) => 250 + p * p * 3500, (p) => Math.sin(Math.PI * p) ** 2 * 1.8, 11),
  'whoosh-down': filteredNoise(0.45, (p) => 250 + (1 - p) ** 2 * 3500, (p) => Math.sin(Math.PI * p) ** 2 * 1.8, 12),
  'whoosh-soft': filteredNoise(0.28, (p) => 400 + Math.sin(Math.PI * p) * 1800, (p) => Math.sin(Math.PI * p) ** 2 * 1.4, 13),

  ding: render(0.9, (t) => bell(1175, t, 0.35)),

  // Noise burst for the latch, then a short creak: a sawtooth that wobbles around a low note.
  door: (() => {
    const rand = seeded(21)
    let low = 0
    return render(0.7, (t) => {
      low += 0.12 * ((rand() * 2 - 1) - low)
      const latch = low * decay(t, 0.03) * 3
      const wobble = 100 + 25 * sine(6, t)
      const creak = t > 0.1 ? (((t * wobble) % 1) * 2 - 1) * 0.25 * Math.sin(Math.PI * Math.min(1, (t - 0.1) / 0.55)) : 0
      return latch + creak
    })
  })(),

  footstep: (() => {
    const rand = seeded(31)
    let low = 0
    return render(0.16, (t) => {
      low += 0.2 * ((rand() * 2 - 1) - low)
      return low * decay(t, 0.025) * 2.2 + sine(95, t) * decay(t, 0.03)
    })
  })(),

  'tap-go': (() => {
    const wave = sweepWave(640, 380, 0.08)
    return render(0.14, (t) => wave(t) * pluck(t, 0.003, 0.04))
  })(),

  // Stands in for "Dino roar": a growling sawtooth that bends down, amplitude-modulated for the growl.
  'reaction-roar': (() => {
    const rand = seeded(41)
    let phase = 0
    return render(1.0, (t) => {
      phase += (sweep(130, 62, t, 0.9) / SR) % 1
      const saw = ((phase % 1) * 2 - 1) * 0.6
      const growl = 0.6 + 0.4 * sine(28, t)
      return (saw * growl + (rand() * 2 - 1) * 0.12) * Math.min(1, t / 0.05) * Math.min(1, (1 - t) / 0.3)
    })
  })(),
}

// Soft piano bed: eight seconds at a low rate, notes wrapped round the end so the loop seam is silent.
const bgmPiano = (() => {
  const rate = 22050
  const seconds = 8
  const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0] // C E G C G E D G
  const out = new Float32Array(seconds * rate)
  notes.forEach((hz, i) => {
    const start = i * 1.0
    for (let n = 0; n < 4.5 * rate; n++) {
      const t = n / rate
      const at = (Math.round(start * rate) + n) % out.length
      out[at] += (sine(hz, t) + 0.3 * sine(hz * 2, t) * decay(t, 0.5) + 0.1 * sine(hz * 3, t) * decay(t, 0.25)) * pluck(t, 0.012, 1.1)
    }
  })
  return { samples: out, rate }
})()

const toWav = (samples, rate) => {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  const gain = peak > 0 ? TARGET_PEAK / peak : 1
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8, 'latin1')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'latin1')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

mkdirSync(OUT, { recursive: true })
for (const [name, samples] of Object.entries(sounds)) writeFileSync(`${OUT}${name}.wav`, toWav(samples, SR))
writeFileSync(`${OUT}bgm-piano.wav`, toWav(bgmPiano.samples, bgmPiano.rate))
console.log(`Wrote ${Object.keys(sounds).length + 1} placeholder sounds to ${OUT}`)
