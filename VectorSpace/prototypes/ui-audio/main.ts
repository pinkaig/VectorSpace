/**
 * @file        main.ts
 * @brief       Boots the sound layer on top of the VectorSpace V3 mockup.
 *
 * @responsibility
 * Wires the pieces in the same order the real app does in Viewport.tsx: a
 * WebAudioBackend, one AudioSystem for the page, then the cue layer on top
 * (CueBank is the system's resolver, so it also serves audio dropped onto the
 * board as bytes). The mockup's own script has already run by the time this
 * module executes, which is what lets the director wrap its Component.
 *
 * Reads cue-map.json (what plays) and bindings.json (which component triggers
 * it) at load, so either file can be edited and the page refreshed. `vsSfx` on
 * window is a console handle for the same objects the board uses.
 *
 * The same page also boots as its own probe: with `?sfx=probe` it makes no
 * sound and builds no board, and only answers the real page's questions about
 * what each control plays (probe.ts). That is how the debug view stays right.
 */
import { AudioSystem, CueBank, FakeAudioBackend, WebAudioBackend, type CueMap } from '../../packages/audio/src/index'
import cueMapJson from '../../src/audio/cue-map.json'
import bindingsJson from './bindings.json'
import type { Binding } from './conditions'
import { UiSoundDirector } from './director'
import { scanKey } from './inventory'
import { TagOverlay } from './overlay'
import { applyOverrides, watchOverrides } from './overrides'
import { ProbeClient, serveProbe, watchLive } from './probe'
import { mountSoundboard } from './soundboard'
import { ScreenMap, trackHandlers } from './surfaces'

// Defined by the mockup's own classic script; not importable, but visible to modules as a global.
declare const Component: { prototype: { renderVals(): Record<string, unknown> } } & (new (props: { screen?: string }) => { state: Record<string, unknown> })

const cueMap = cueMapJson as unknown as CueMap
const bindings = bindingsJson.bindings as unknown as Binding[]
const root = document.getElementById('app')
if (!root) throw new Error('ui-audio: the mockup has no #app element')

const isProbe = new URLSearchParams(location.search).get('sfx') === 'probe'

// Must be in place before the mockup renders what we want to see: it learns which elements got click handlers.
const tracked = trackHandlers()

const bank = new CueBank(cueMap, { resolveUrl: (url) => new URL(url, import.meta.url).href })

// The real app's four channels, plus 'ui' for the editor's own chrome. Channels are created on demand, so
// nothing in the audio package changes; the proposal is only that chrome gets its own bus, so a published
// museum can leave it out and a teacher can mute it without touching the museum's music.
const channel = { volume: 1, muted: false }
const system = new AudioSystem({
  backend: isProbe ? new FakeAudioBackend() : new WebAudioBackend(),
  resolver: bank,
  settings: { master: 1, channels: { ui: { ...channel }, sfx: { ...channel }, bgm: { ...channel }, ambient: { ...channel }, narration: { ...channel } } },
})
bank.bind(system)

const director = new UiSoundDirector(bank, system, bindings, root)
director.tracked = tracked

if (isProbe) {
  director.dryRun = true
  director.start(Component)
  serveProbe(director, Component, root, tracked)
} else {
  applyOverrides(bank)
  watchOverrides(bank, cueMap)
  director.start(Component)

  const map = new ScreenMap(director, root, tracked)
  const probe = new ProbeClient()
  const overlay = new TagOverlay(map, bank)
  document.body.classList.add('sfx-ready')
  const board = mountSoundboard({ bank, system, director, overlay, map, probe, bindingsKey: scanKey(JSON.stringify(bindingsJson)) })
  watchLive(director, map, probe, board.setVerifying)

  Object.assign(window, { vsSfx: { bank, system, director, map, probe } })
}
