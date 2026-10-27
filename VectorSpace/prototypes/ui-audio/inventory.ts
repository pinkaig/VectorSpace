/**
 * @file        inventory.ts
 * @brief       The full list of controls across every screen, and the sound each one makes.
 *
 * @responsibility
 * Answers "which components play this cue" for the whole mockup, not just the
 * screen on display. The probe frame visits every screen preset, presses each
 * control on it, and records what played (see probe.ts); this file holds the
 * screen list, turns those scans into per-cue lists for the board, exports the
 * lot as CSV for the audio designer, and keeps the last scan in localStorage
 * so it is not repeated on every reload.
 *
 * Pure functions over plain data, so they run under vitest without a browser.
 */
import type { SurfaceKind } from './surfaces'

/** The mockup's `?screen=` presets, with the words a designer would use. Aliases (`react`, `play`) are left out. */
export interface ScreenDef {
  id: string
  name: string
  /** State values to change from the preset, to reach a moment the presets skip over. */
  patch?: Record<string, unknown>
}

export const SCREENS: ReadonlyArray<ScreenDef> = [
  { id: 'signin', name: 'Sign in' },
  { id: 'home', name: 'Student home' },
  { id: 'tutorial', name: 'Editor: welcome tips' },
  { id: 'brief', name: 'Editor: Mission brief' },
  { id: 'loading', name: 'Editor: loading popup' },
  { id: 'place', name: 'Step 1: picking an item' },
  { id: 'adjust', name: 'Step 1: item placed' },
  { id: 'views', name: 'Step 1: top view' },
  { id: 'rooms', name: 'Step 1: Your rooms', patch: { roomAdded: false } },
  { id: 'error', name: 'Step 1: error popup' },
  { id: 'info', name: 'Step 2: add a fact card' },
  { id: 'infolinked', name: 'Step 2: fact card linked' },
  { id: 'reacttip', name: 'Step 3: reactions tip' },
  { id: 'rulepick', name: 'Step 3: choosing WHEN' },
  { id: 'rule', name: 'Step 3: a reaction' },
  { id: 'publish', name: 'Step 4: Share your museum' },
  { id: 'playtap', name: 'Play: tap to go' },
  { id: 'playwalk', name: 'Play: walk' },
  { id: 'playtour', name: 'Play: tour' },
  { id: 'playtour', name: 'Play: tour, card closed', patch: { playCard: false } },
  { id: 'preview', name: 'Student: preview' },
  { id: 'thome', name: 'Teacher home' },
  { id: 'tnew', name: 'Teacher: new project' },
  { id: 'tassigned', name: 'Teacher: assigned banner' },
  { id: 'tsetup', name: 'Teacher: setup' },
  { id: 'treview', name: 'Teacher: Review' },
  { id: 'tresults', name: 'Teacher: Results' },
  { id: 'aover', name: 'Admin: Overview' },
  { id: 'aperm', name: 'Admin: Permissions' },
  { id: 'aacc', name: 'Admin: Accounts' },
  { id: 'aenv', name: 'Admin: Environments' },
]

/** One control, as the probe frame saw it. */
export interface ProbeItem {
  label: string
  kind: SurfaceKind
  /** What the binding table predicted a press plays. */
  click: string | null
  clickBy: string | null
  hover: string | null
  /** What a simulated press actually played. Empty means silent. */
  heard: string[]
}

export interface ScreenScan {
  id: string
  name: string
  items: ProbeItem[]
}

/** A control that makes a given cue play, with every screen it appears on. */
export interface CueControl {
  label: string
  kind: SurfaceKind
  /** `press` when pressing or choosing it plays the cue; `hover` when only pointing at it does. */
  role: 'press' | 'hover'
  screens: string[]
}

/** Which controls play each cue, across every scanned screen. Text fields are skipped: they are silent by design. */
export function controlsByCue(scans: ScreenScan[]): Map<string, CueControl[]> {
  const byCue = new Map<string, Map<string, CueControl>>()
  const add = (cueId: string, item: ProbeItem, role: CueControl['role'], screen: string) => {
    const controls = byCue.get(cueId) ?? new Map<string, CueControl>()
    const key = `${role}|${item.kind}|${item.label}`
    const existing = controls.get(key)
    if (existing) {
      if (!existing.screens.includes(screen)) existing.screens.push(screen)
    } else {
      controls.set(key, { label: item.label, kind: item.kind, role, screens: [screen] })
    }
    byCue.set(cueId, controls)
  }
  for (const scan of scans) {
    for (const item of scan.items) {
      if (item.kind === 'field') continue
      for (const cueId of item.heard) add(cueId, item, 'press', scan.name)
      if (item.hover) add(item.hover, item, 'hover', scan.name)
    }
  }
  return new Map([...byCue].map(([cueId, controls]) => [cueId, [...controls.values()].sort((a, b) => b.screens.length - a.screens.length || a.label.localeCompare(b.label))]))
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** One row per control per screen: the sheet to hand the audio designer. */
export function toCsv(scans: ScreenScan[], tierOf: (cueId: string) => number | undefined): string {
  const rows = [['screen', 'control', 'type', 'plays when pressed', 'tier', 'plays on hover', 'binding rule']]
  for (const scan of scans) {
    for (const item of scan.items) {
      const tiers = item.heard.map((cueId) => tierOf(cueId)).filter((tier): tier is number => tier !== undefined)
      rows.push([scan.name, item.label, item.kind, item.heard.length ? item.heard.join(' + ') : 'silent', tiers.length ? `P${Math.min(...tiers)}` : '', item.hover ?? '', item.clickBy ?? ''])
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

/** Small stable hash of what a scan depends on, so a saved scan is dropped when bindings.json changes. */
export function scanKey(bindingsJson: string): string {
  let hash = 5381
  for (const char of bindingsJson + JSON.stringify(SCREENS)) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0
  return String(hash)
}

const STORE = 'vs-ui-audio-inventory:v1'

export function loadScans(key: string): ScreenScan[] | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE) ?? 'null') as { key: string; scans: ScreenScan[] } | null
    return saved?.key === key ? saved.scans : null
  } catch {
    return null
  }
}

export function saveScans(key: string, scans: ScreenScan[]): void {
  try {
    window.localStorage.setItem(STORE, JSON.stringify({ key, scans }))
  } catch {
    // Storage can be blocked; the scan still works for this page load.
  }
}
