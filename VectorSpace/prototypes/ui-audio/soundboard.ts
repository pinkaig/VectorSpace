/**
 * @file        soundboard.ts
 * @brief       The panel for hearing, swapping and exporting every cue in the app.
 *
 * @responsibility
 * The plug-and-play surface, in two views over the same sounds:
 * - "On this screen": every control the page offers right now, numbered to
 *   match the outlines on the page, with the sound each one really plays.
 *   Hovering a row outlines the control; a sound name jumps to its cue.
 * - "Sounds": one row per cue, the moment it marks, the explicit list of
 *   components that play it, the sound it plays, and controls to audition it,
 *   point it at another library sound, drop in a file of your own, or change
 *   its loudness. Cues are shared on purpose (change one sound, every control
 *   in the group follows) and each row lists the controls it covers, so the
 *   sharing is visible rather than assumed.
 * Also the mixer (master and per-channel volume and mute, which are
 * AudioSystem's own controls), the debug outlines, a ticker of what just played
 * and what caused it, and export of the edited map back to cue-map.json.
 *
 * Plain DOM, not React: it has to sit beside a page that is not React and
 * survive that page rebuilding itself on every click.
 */
import type { AudioSystem, CueBank, CueDef } from '../../packages/audio/src/index'
import type { Binding } from './conditions'
import type { TraceEvent, UiSoundDirector } from './director'
import { SCREENS, controlsByCue, loadScans, saveScans, toCsv, type ScreenScan } from './inventory'
import type { TagOverlay } from './overlay'
import { clearOverrides } from './overrides'
import { scanScreens, type ProbeClient } from './probe'
import { playsOf, type ScreenMap, type Surface } from './surfaces'

interface BoardDeps {
  bank: CueBank
  system: AudioSystem
  director: UiSoundDirector
  overlay: TagOverlay
  map: ScreenMap
  probe: ProbeClient
  /** Identifies the binding table the saved scan was made with. */
  bindingsKey: string
}

export interface Board {
  /** Shows that the probe frame is working out what each control plays. */
  setVerifying(busy: boolean): void
}

const TIER_LABEL: Record<number, string> = { 1: 'P1 must have', 2: 'P2 polish', 3: 'P3 nice to have' }
const TRIGGER_LABEL: Record<Binding['on'], string> = { click: 'press', change: 'menu', hover: 'hover', key: 'key', state: 'happens', while: 'loop', manual: 'code' }
const SILENT = '__silent__'
const VARIANTS = '__variants__'
const UPLOAD = '__upload__'
const TICKER_LENGTH = 8
const HERE_LIMIT = 6
const BOARD_WIDTH = 400

type Child = Node | string | false | null | undefined

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Record<string, unknown>> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    else if (key === 'class') element.className = String(value)
    else if (key in element) (element as unknown as Record<string, unknown>)[key] = value
    else element.setAttribute(key, String(value))
  }
  for (const child of children) if (child) element.append(child)
  return element
}

interface TickerLine {
  at: number
  text: string
  cueId: string | null
  /** undefined: waiting to hear whether the cue played; null: it was silent on purpose; string: the sound that played. */
  sound?: string | null
  dropped?: boolean
}

export function mountSoundboard(deps: BoardDeps): Board {
  const { bank, system, director, overlay, map, bindingsKey } = deps
  const filters = { tier: 0, group: '', search: '', placeholdersOnly: false }
  const previewing = new Set<string>()
  const ticker: TickerLine[] = []
  const here = new Map<string, HTMLElement>()
  let view: 'screen' | 'cues' = 'screen'
  let groupBySound = false
  let verifying = false
  let customCount = 0
  let selfEdit = false
  let scans: ScreenScan[] | null = loadScans(bindingsKey)
  let scanning: string | null = null
  let stopWatching: (() => void) | null = null

  const list = h('div', { class: 'sfx-list' })
  const screenList = h('div', { class: 'sfx-list' })
  const screenSummary = h('div', { class: 'sfx-summary' })
  const scanBar = h('div', { class: 'sfx-scan' })
  const tickerBox = h('div', { class: 'sfx-ticker' })
  const status = h('span', { class: 'sfx-status' })
  const mixer = h('div', { class: 'sfx-mixer' })

  // ---- mixer: AudioSystem's own controls, nothing added -------------------------------------
  const slider = (value: number, onInput: (value: number) => void, max = 1) =>
    h('input', { type: 'range', min: 0, max, step: 0.01, value, onInput: (event: Event) => onInput(Number((event.target as HTMLInputElement).value)) })

  const renderMixer = () => {
    const snapshot = system.store.getSnapshot()
    mixer.replaceChildren(
      h('label', { class: 'sfx-mix-row' }, h('b', {}, 'Master'), slider(snapshot.master.volume, (value) => system.setMaster(value)), h('input', { type: 'checkbox', checked: snapshot.master.muted, title: 'Mute', onChange: (event: Event) => system.muteMaster((event.target as HTMLInputElement).checked) })),
      ...snapshot.channels.map((channel) =>
        h('label', { class: 'sfx-mix-row' }, h('span', {}, channel.id), slider(channel.volume, (value) => system.setChannelVolume(channel.id, value)), h('input', { type: 'checkbox', checked: channel.muted, title: 'Mute', onChange: (event: Event) => system.muteChannel(channel.id, (event.target as HTMLInputElement).checked) })),
      ),
    )
  }

  // ---- shared bits -----------------------------------------------------------------------------
  const isPlaceholder = (cue: CueDef) => cue.sounds.some((soundId) => bank.soundList().find((sound) => sound.id === soundId)?.def.placeholder)

  /** A sound name as a button: tinted by priority, and a click takes you to its row to change it. */
  const cueChip = (cueId: string) => {
    const tier = bank.getCue(cueId)?.tier
    return h('button', { class: `sfx-chip-cue sfx-chip-t${tier ?? 0}`, title: 'Go to this sound to change it', onClick: () => showCue(cueId) }, cueId)
  }

  const showCue = (cueId: string) => {
    filters.tier = 0
    filters.group = ''
    filters.search = ''
    filters.placeholdersOnly = false
    syncFilterControls()
    setView('cues')
    renderList()
    const row = list.querySelector<HTMLElement>(`[data-cue="${CSS.escape(cueId)}"]`)
    row?.scrollIntoView({ block: 'center' })
    row?.classList.add('sfx-flash')
    window.setTimeout(() => row?.classList.remove('sfx-flash'), 1200)
  }

  // ---- "On this screen" ------------------------------------------------------------------------
  const screenRow = (surface: Surface) => {
    const plays = playsOf(surface)
    const instead = surface.heard && surface.click && plays.length > 0 && !plays.includes(surface.click) ? surface.click : null
    const play = plays.length > 0 && h('button', { class: 'sfx-play sfx-play-sm', title: 'Hear it', onClick: () => director.preview(plays[0]) }, '▶')
    return h('div', { class: 'sfx-srow', onMouseenter: () => overlay.setHighlight(surface.index), onMouseleave: () => overlay.setHighlight(null) },
      h('i', { class: 'sfx-n' }, String(surface.n)),
      h('div', { class: 'sfx-smain' },
        h('div', { class: 'sfx-sname' }, surface.label, surface.kind !== 'button' && h('em', {}, surface.kind)),
        h('div', { class: 'sfx-chips' },
          ...plays.map((cueId) => cueChip(cueId)),
          plays.length === 0 && h('span', { class: `sfx-pill ${surface.kind === 'field' ? 'sfx-pill-t3' : 'sfx-pill-silent'}` }, surface.kind === 'field' ? 'silent by design' : 'silent'),
          surface.hover && h('span', { class: 'sfx-hov' }, 'hover ', cueChip(surface.hover))),
        instead && h('div', { class: 'sfx-note' }, `instead of ${instead}: this press changes something that has its own sound`)),
      play)
  }

  const renderScreen = () => {
    const surfaces = map.surfaces
    const distinct = new Set(surfaces.flatMap((surface) => playsOf(surface)))
    const silent = surfaces.filter((surface) => surface.kind !== 'field' && playsOf(surface).length === 0).length
    const unverified = surfaces.some((surface) => surface.heard === undefined && surface.kind !== 'field')
    screenSummary.replaceChildren(
      h('div', {}, h('b', {}, `${surfaces.length} controls`), ` on this screen · ${distinct.size} different sounds · `, h('span', { class: silent ? 'sfx-bad' : '' }, `${silent} silent`)),
      h('div', { class: 'sfx-verify' }, verifying ? 'Checking what each press plays…' : unverified ? 'Sounds shown are predicted from the rules (names end in ?).' : 'Checked by pressing every control in a hidden copy of this screen.'),
      h('label', { class: 'sfx-check' }, h('input', { type: 'checkbox', checked: groupBySound, onChange: (event: Event) => { groupBySound = (event.target as HTMLInputElement).checked; renderScreen() } }), 'Group by sound'))

    if (!groupBySound) {
      screenList.replaceChildren(...surfaces.map(screenRow))
    } else {
      const groups = new Map<string, Surface[]>()
      for (const surface of surfaces) {
        const key = playsOf(surface).join(' + ') || 'silent'
        groups.set(key, [...(groups.get(key) ?? []), surface])
      }
      const ordered = [...groups].sort((a, b) => b[1].length - a[1].length)
      screenList.replaceChildren(...ordered.flatMap(([key, members]) => [
        h('h3', { class: 'sfx-group' }, `${key}  ·  ${members.length}`),
        ...members.map(screenRow),
      ]))
    }
    if (surfaces.length === 0) screenList.append(h('p', { class: 'sfx-empty' }, 'Nothing clickable is reachable here.'))
    updateHere()
  }

  const renderScanBar = () => {
    if (scanning) {
      scanBar.replaceChildren(h('div', { class: 'sfx-verify' }, scanning))
      return
    }
    const total = scans?.reduce((sum, scan) => sum + scan.items.length, 0) ?? 0
    scanBar.replaceChildren(
      h('div', { class: 'sfx-verify' }, scans ? `Full list: ${total} controls across ${scans.length} screens. It also fills in the lists on each sound.` : `Every other screen too: presses each control on all ${SCREENS.length} screens to list every component and its sound.`),
      h('div', { class: 'sfx-actions' },
        h('button', { onClick: () => void runScan() }, scans ? 'Scan again' : `Scan all ${SCREENS.length} screens`),
        scans && h('button', { onClick: downloadCsv }, 'Download component list (CSV)')))
  }

  const runScan = async () => {
    scanning = `Scanning screen 0 of ${SCREENS.length}…`
    renderScanBar()
    const result = await scanScreens(SCREENS, (done) => { scanning = `Scanning screen ${done} of ${SCREENS.length}…`; renderScanBar() })
    scanning = null
    scans = result
    saveScans(bindingsKey, result)
    renderScanBar()
    renderList()
  }

  const downloadCsv = () => {
    if (!scans) return
    save(new Blob([toCsv(scans, (cueId) => bank.getCue(cueId)?.tier)], { type: 'text/csv' }), 'ui-sound-components.csv')
  }

  // ---- "Sounds": cue rows ----------------------------------------------------------------------
  const soundOptions = (cue: CueDef) => {
    const options: HTMLOptionElement[] = []
    if (cue.sounds.length > 1) options.push(h('option', { value: VARIANTS, selected: true }, `${cue.sounds.length} variants (${cue.sounds.join(', ')})`))
    options.push(h('option', { value: SILENT, selected: cue.sounds.length === 0 }, '(silent)'))
    for (const { id, def } of bank.soundList()) {
      options.push(h('option', { value: id, selected: cue.sounds.length === 1 && cue.sounds[0] === id }, `${def.placeholder ? '* ' : ''}${id}`))
    }
    options.push(h('option', { value: UPLOAD }, 'Use my own file...'))
    return options
  }

  const applyFile = async (cue: CueDef, file: File) => {
    const soundId = `custom-${(customCount += 1)}-${file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const channel = bank.soundList().find((sound) => sound.id === cue.sounds[0])?.def.channel ?? 'ui'
    bank.addSound(soundId, { channel, volume: 1, note: file.name }, { bytes: await file.arrayBuffer(), name: file.name })
    bank.assign(cue.id, [soundId])
    director.preview(cue.id)
  }

  const togglePreview = (cue: CueDef, button: HTMLButtonElement) => {
    if (!cue.loop) {
      director.preview(cue.id)
      return
    }
    if (previewing.delete(cue.id)) {
      bank.stopCue(cue.id, 250)
      button.textContent = '▶'
    } else {
      previewing.add(cue.id)
      button.textContent = '■'
      director.preview(cue.id)
    }
  }

  /** The explicit list of what plays this cue: every rule that points at it, in words, then every control a scan found. */
  const usedBy = (cue: CueDef, byCue: ReturnType<typeof controlsByCue> | null) => {
    const rules = director.bindingsFor(cue.id)
    const seen = byCue?.get(cue.id) ?? []
    const hereBox = h('div', { class: 'sfx-here' })
    here.set(cue.id, hereBox)
    return h('div', { class: 'sfx-uses' },
      h('div', { class: 'sfx-uses-head' }, rules.length > 1 ? `Shared by ${rules.length} rules (change the sound here and all follow)` : 'Plays when'),
      h('ul', {}, ...(rules.length ? rules.map((rule) => h('li', {}, h('span', { class: `sfx-trig sfx-trig-${rule.on}` }, TRIGGER_LABEL[rule.on]), rule.component)) : [h('li', {}, 'No trigger')])),
      hereBox,
      seen.length > 0 && h('details', { class: 'sfx-seen' },
        h('summary', {}, `${seen.length} control${seen.length === 1 ? '' : 's'} across all screens`),
        h('div', { class: 'sfx-seen-list' }, ...seen.map((control) => h('span', { class: `sfx-seen-chip${control.role === 'hover' ? ' hover' : ''}`, title: control.screens.join(', ') }, control.label, control.screens.length > 1 && h('small', {}, ` ×${control.screens.length}`))))))
  }

  const row = (cue: CueDef, byCue: ReturnType<typeof controlsByCue> | null) => {
    const placeholder = isPlaceholder(cue)
    const fileInput = h('input', { type: 'file', accept: 'audio/*', hidden: true, onChange: (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) void applyFile(cue, file)
    } })
    const play = h('button', { class: 'sfx-play', title: 'Preview this cue', onClick: () => togglePreview(cue, play) }, '▶')
    const select = h('select', { class: 'sfx-sound', onChange: (event: Event) => {
      const value = (event.target as HTMLSelectElement).value
      if (value === UPLOAD) {
        fileInput.click()
        return
      }
      if (value === VARIANTS) return
      bank.assign(cue.id, value === SILENT ? [] : [value])
      if (value !== SILENT) director.preview(cue.id)
    } }, ...soundOptions(cue))
    const gain = cue.gain ?? 1
    const gainLabel = h('span', { class: 'sfx-gain-label' }, `x${gain.toFixed(2)}`)
    const gainSlider = h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: gain, title: 'Cue loudness multiplier', onInput: (event: Event) => {
      const value = Number((event.target as HTMLInputElement).value)
      gainLabel.textContent = `x${value.toFixed(2)}`
      selfEdit = true
      bank.updateCue(cue.id, { gain: value })
      selfEdit = false
    } })

    const element = h('div', { class: 'sfx-row', 'data-cue': cue.id,
      onMouseenter: () => overlay.setFocusCue(cue.id),
      onMouseleave: () => overlay.setFocusCue(null),
      onDragover: (event: Event) => { event.preventDefault(); element.classList.add('sfx-drop') },
      onDragleave: () => element.classList.remove('sfx-drop'),
      onDrop: (event: Event) => {
        event.preventDefault()
        element.classList.remove('sfx-drop')
        const file = (event as DragEvent).dataTransfer?.files[0]
        if (file) void applyFile(cue, file)
      } },
    play,
    h('div', { class: 'sfx-main' },
      h('div', { class: 'sfx-title' }, h('code', {}, cue.id), h('span', { class: `sfx-pill sfx-pill-t${cue.tier}` }, TIER_LABEL[cue.tier]), placeholder && h('span', { class: 'sfx-pill sfx-pill-ph' }, 'placeholder'), cue.sounds.length === 0 && h('span', { class: 'sfx-pill sfx-pill-silent' }, 'silent')),
      h('div', { class: 'sfx-label' }, cue.label),
      cue.note && h('div', { class: 'sfx-note' }, cue.note),
      usedBy(cue, byCue),
      h('div', { class: 'sfx-controls' }, select, h('label', { class: 'sfx-gain' }, gainSlider, gainLabel), fileInput)))
    return element
  }

  /** Fills each row's "on this screen" line from what the page offers right now. */
  const updateHere = () => {
    const byCue = new Map<string, Surface[]>()
    for (const surface of map.surfaces) for (const cueId of new Set([...playsOf(surface), ...(surface.hover ? [surface.hover] : [])])) byCue.set(cueId, [...(byCue.get(cueId) ?? []), surface])
    for (const [cueId, box] of here) {
      const members = byCue.get(cueId) ?? []
      if (members.length === 0) {
        box.replaceChildren()
        continue
      }
      const shown = members.slice(0, HERE_LIMIT)
      box.replaceChildren(
        h('span', { class: 'sfx-here-head' }, 'On this screen:'),
        ...shown.map((surface) => h('span', { class: 'sfx-here-chip', onMouseenter: () => overlay.setHighlight(surface.index), onMouseleave: () => overlay.setHighlight(null) }, h('i', {}, String(surface.n)), surface.label)),
        ...(members.length > shown.length ? [h('span', { class: 'sfx-here-more' }, `+${members.length - shown.length} more`)] : []))
    }
  }

  const renderList = () => {
    const needle = filters.search.trim().toLowerCase()
    const byCue = scans ? controlsByCue(scans) : null
    const groups = new Map<string, HTMLElement[]>()
    here.clear()
    for (const cue of bank.cueList()) {
      if (filters.tier && cue.tier !== filters.tier) continue
      if (filters.group && cue.group !== filters.group) continue
      if (filters.placeholdersOnly && !isPlaceholder(cue)) continue
      const components = director.bindingsFor(cue.id).map((binding) => binding.component).join(' ')
      const seen = (byCue?.get(cue.id) ?? []).map((control) => control.label).join(' ')
      if (needle && !`${cue.id} ${cue.label} ${components} ${seen}`.toLowerCase().includes(needle)) continue
      groups.set(cue.group, [...(groups.get(cue.group) ?? []), row(cue, byCue)])
    }
    list.replaceChildren(...[...groups].flatMap(([group, rows]) => [h('h3', { class: 'sfx-group' }, `${group} (${rows.length})`), ...rows]))
    if (groups.size === 0) list.append(h('p', { class: 'sfx-empty' }, 'No cues match.'))
    updateHere()
  }

  // ---- header, options, filters, footer ------------------------------------------------------
  const tierButtons = [0, 1, 2, 3].map((tier) =>
    h('button', { class: 'sfx-chip', onClick: () => {
      filters.tier = tier
      syncFilterControls()
      renderList()
    } }, tier === 0 ? 'All' : `P${tier}`))

  const groupSelect = h('select', { class: 'sfx-group-select', onChange: (event: Event) => {
    filters.group = (event.target as HTMLSelectElement).value
    renderList()
  } }, h('option', { value: '' }, 'All groups'), ...[...new Set(bank.cueList().map((cue) => cue.group))].map((group) => h('option', { value: group }, group)))

  const searchBox = h('input', { class: 'sfx-search', type: 'search', placeholder: 'Search sounds, components and controls', onInput: (event: Event) => { filters.search = (event.target as HTMLInputElement).value; renderList() } })
  const placeholderCheck = h('input', { type: 'checkbox', onChange: (event: Event) => { filters.placeholdersOnly = (event.target as HTMLInputElement).checked; renderList() } })

  function syncFilterControls() {
    tierButtons.forEach((button, index) => button.classList.toggle('on', index === filters.tier))
    groupSelect.value = filters.group
    searchBox.value = filters.search
    placeholderCheck.checked = filters.placeholdersOnly
  }

  const check = (label: string, checked: boolean, onChange: (checked: boolean) => void) =>
    h('label', { class: 'sfx-check' }, h('input', { type: 'checkbox', checked, onChange: (event: Event) => onChange((event.target as HTMLInputElement).checked) }), label)

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    h('a', { href: url, download: name }).click()
    URL.revokeObjectURL(url)
  }
  const download = () => save(new Blob([JSON.stringify(bank.toJSON(), null, 2)], { type: 'application/json' }), 'cue-map.json')

  const clickChecks = check('Outline clickable (D)', true, (on) => overlay.setClicks(on))
  const hoverChecks = check('Outline hover (H)', false, (on) => overlay.setHovers(on))

  const tabButtons = {
    screen: h('button', { class: 'sfx-tabbtn', onClick: () => setView('screen') }, 'On this screen'),
    cues: h('button', { class: 'sfx-tabbtn', onClick: () => setView('cues') }, 'Sounds'),
  }
  const screenPane = h('div', { class: 'sfx-pane' }, screenSummary, screenList, scanBar)
  const cuesPane = h('div', { class: 'sfx-pane' },
    h('div', { class: 'sfx-filters' }, ...tierButtons, groupSelect, searchBox, h('label', { class: 'sfx-check' }, placeholderCheck, 'Placeholders')),
    list)

  function setView(next: 'screen' | 'cues') {
    view = next
    screenPane.hidden = next !== 'screen'
    cuesPane.hidden = next !== 'cues'
    tabButtons.screen.classList.toggle('on', next === 'screen')
    tabButtons.cues.classList.toggle('on', next === 'cues')
  }

  const problems = bank.problems()
  const board = h('aside', { id: 'sfx-board', class: 'sfx-board' },
    h('header', { class: 'sfx-head' }, h('h2', {}, 'Sound board'), status, h('button', { class: 'sfx-x', title: 'Hide (B)', onClick: () => toggle(false) }, '✕')),
    problems.length > 0 && h('div', { class: 'sfx-problems' }, h('b', {}, 'cue-map.json needs attention'), ...problems.map((problem) => h('div', {}, problem))),
    h('details', { class: 'sfx-section' }, h('summary', {}, 'Mixer (AudioSystem buses)'), mixer),
    h('div', { class: 'sfx-options' },
      check('Sounds on', true, (on) => { director.enabled = on; if (!on) bank.cueList().forEach((cue) => bank.stopCue(cue.id)) }),
      check('Hover sounds', true, (on) => { director.hoverEnabled = on }),
      clickChecks, hoverChecks),
    h('nav', { class: 'sfx-tabs' }, tabButtons.screen, tabButtons.cues),
    screenPane, cuesPane,
    h('footer', { class: 'sfx-foot' }, tickerBox,
      h('div', { class: 'sfx-actions' },
        h('button', { onClick: () => void navigator.clipboard.writeText(JSON.stringify(bank.toJSON(), null, 2)).catch(download) }, 'Copy cue-map.json'),
        h('button', { onClick: download }, 'Download'),
        h('button', { onClick: () => { clearOverrides(); location.reload() } }, 'Reset my changes'))))

  const tab = h('button', { id: 'sfx-tab', class: 'sfx-tab', title: 'Show the sound board (B)', onClick: () => toggle(true) }, 'Sound board')

  const toggle = (open: boolean) => {
    document.body.classList.toggle('sfx-open', open)
    document.documentElement.style.setProperty('--sfx-inset', open ? `${BOARD_WIDTH}px` : '0px')
    fit()
    // The page is measured only while someone wants the numbers.
    if (open && !stopWatching) {
      stopWatching = map.onChange(() => renderScreen())
      map.invalidate()
    }
    if (!open && stopWatching) {
      stopWatching()
      stopWatching = null
    }
  }

  // The mockup scales a fixed 1440x900 stage to the window; with the board open it must scale to what is left.
  const fit = () => {
    const inset = document.body.classList.contains('sfx-open') ? BOARD_WIDTH : 0
    document.documentElement.style.setProperty('--sfx-fit', String(Math.min((innerWidth - inset) / 1440, innerHeight / 900)))
  }
  window.addEventListener('resize', fit)

  const typing = (event: Event) => event.target instanceof Element && event.target.closest('input, textarea, select')
  document.addEventListener('keydown', (event) => {
    if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === 'b') toggle(!document.body.classList.contains('sfx-open'))
    // Shortcuts for the debug outlines, so they can be flipped while the pointer is on the page.
    if (key === 'd') clickChecks.querySelector('input')?.click()
    if (key === 'h') hoverChecks.querySelector('input')?.click()
  })

  // ---- live updates --------------------------------------------------------------------------
  const clock = () => {
    const now = new Date()
    return `${now.toLocaleTimeString([], { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`
  }
  const renderTicker = () => tickerBox.replaceChildren(
    h('b', {}, 'Just played (what caused it → sound)'),
    ...ticker.map((line) => h('div', { class: line.cueId === null ? 'sfx-t-silent' : line.dropped ? 'sfx-t-dropped' : '' },
      line.cueId === null ? line.text : `${line.text} · ${line.sound === undefined ? (line.dropped ? 'not played (cooldown or locked)' : '…') : (line.sound ?? '(silent)')}`)))
  const pushLine = (line: TickerLine) => {
    ticker.unshift(line)
    ticker.length = Math.min(ticker.length, TICKER_LENGTH)
    renderTicker()
    // Cooldowns and the pre-unlock rule can swallow a cue; say so instead of leaving the line hanging.
    if (line.cueId !== null) window.setTimeout(() => { if (line.sound === undefined) { line.dropped = true; renderTicker() } }, 150)
  }
  // Controls and keys are quoted, since they are what a person touched; state values are not, since they are what changed.
  const causeText = (event: TraceEvent) => `${clock()}  ${event.trigger} ${event.detail && !['state', 'while'].includes(event.trigger) ? `"${event.detail}"` : event.detail}`.trimEnd()
  director.onTrace((event) => pushLine({ at: Date.now(), cueId: event.cueId, text: event.cueId === null ? `${causeText(event)} → no sound` : `${causeText(event)} → ${event.cueId}` }))
  bank.onPlay((event) => {
    const line = ticker.find((candidate) => candidate.cueId === event.cueId && Date.now() - candidate.at < 2000 && (candidate.sound === undefined || candidate.dropped))
    if (!line) return
    line.sound = event.soundId
    line.dropped = false
    renderTicker()
  })
  system.store.subscribe((snapshot) => {
    const playing = snapshot.voices.filter((voice) => voice.status === 'playing').length
    status.textContent = snapshot.unlocked ? `${snapshot.contextState} · ${playing} playing` : 'locked: click anywhere'
    status.classList.toggle('ok', snapshot.unlocked)
  })
  bank.onChange(() => { if (!selfEdit) renderList() })

  document.body.append(board, tab)
  renderMixer()
  system.store.subscribe(() => { if (!mixer.contains(document.activeElement)) renderMixer() })
  renderTicker()
  renderList()
  renderScreen()
  renderScanBar()
  syncFilterControls()
  setView(view)
  status.textContent = 'locked: click anywhere'
  toggle(true)

  return {
    setVerifying(busy) {
      verifying = busy
      renderScreen()
    },
  }
}
