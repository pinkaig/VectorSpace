/**
 * @file        probe.ts
 * @brief       Finds out what each control really plays by pressing it in a hidden copy of the mockup.
 *
 * @responsibility
 * The binding table can only predict a click. A step pill is bound to the
 * default button click, but pressing it changes the step, and the step has its
 * own sound that replaces the click. Working that out from the table alone
 * would mean re-deriving the mockup's logic, and getting it wrong. So instead
 * the answer is measured: a hidden copy of the page (`?sfx=probe`) is put in the
 * same state as the one on screen, every control is pressed in turn with the
 * director running dry (it reports what it would play and plays nothing), and
 * the state is put back between presses.
 *
 * Two halves in one file, since they share a message format:
 * - `serveProbe` runs inside the hidden frame and answers requests.
 * - `ProbeClient` lives on the real page, owns a frame, and asks.
 * `watchLive` ties the client to the page, so the debug view stays right as
 * the person clicks around.
 *
 * Safe because the mockup has no side effects outside its own state: no
 * network, navigation, storage or timers. Pressing every button cannot change
 * anything but the hidden copy.
 */
import type { UiSoundDirector, TraceEvent } from './director'
import type { ProbeItem, ScreenDef, ScreenScan } from './inventory'
import { controlsIn, describe, labelOf, type ScreenMap } from './surfaces'

interface ProbeRequest {
  type: 'vs-sfx-probe'
  id: number
  /** Probe from this exact state (the live page's)... */
  state?: Record<string, unknown>
  /** ...or from this `?screen=` preset, with these values changed. */
  screen?: string
  patch?: Record<string, unknown>
}

interface ProbeResponse {
  type: 'vs-sfx-probe-result'
  id: number
  signature: string
  items: ProbeItem[]
}

const READY = 'vs-sfx-probe-ready'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Lets a press finish: the mockup's render is a microtask, and the director decides about the click on a timeout after it. */
const settle = () => sleep(0)

/** Same text the live page builds from its own controls, so the two lists can be checked as the same screen. */
export const signatureOf = (items: Array<Pick<ProbeItem, 'kind' | 'label'>>): string => items.map((item) => `${item.kind}:${item.label}`).join('\u0001')

// ---- inside the hidden frame ----------------------------------------------------------------------

type Mockup = new (props: { screen?: string }) => { state: Record<string, unknown> }

export function serveProbe(director: UiSoundDirector, component: Mockup, root: HTMLElement, tracked: Set<Element>): void {
  let latest = 0

  const measure = async (id: number): Promise<ProbeItem[] | null> => {
    const base = structuredClone(director.state ?? {})
    const baseJson = JSON.stringify(base)
    const controls = controlsIn(root, tracked, director.clickSelector)
    const infos = controls.map((element) => describe(director, element))
    const traces: TraceEvent[] = []
    const stop = director.onTrace((event) => traces.push(event))
    const items: ProbeItem[] = []
    let moved = false
    for (let index = 0; index < controls.length; index += 1) {
      if (id !== latest) {
        stop()
        return null
      }
      const info = infos[index]
      // Menus and fields are not pressed: a menu plays on change, a field on nothing, and the table already says so.
      const predicted = { ...info, heard: info.click ? [info.click] : [] }
      if (info.kind === 'field' || info.kind === 'menu') {
        items.push(predicted)
        continue
      }
      if (moved) {
        director.loadState(base)
        await settle()
        moved = false
      }
      const fresh = controlsIn(root, tracked, director.clickSelector)[index]
      if (!fresh || labelOf(fresh) !== info.label) {
        items.push(predicted)
        continue
      }
      traces.length = 0
      fresh.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      await settle()
      moved = JSON.stringify(director.state) !== baseJson
      items.push({ ...info, heard: [...new Set(traces.flatMap((event) => (event.cueId ? [event.cueId] : [])))] })
    }
    stop()
    director.loadState(base)
    return items
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const request = event.data as ProbeRequest | null
    if (request?.type !== 'vs-sfx-probe') return
    latest = request.id
    void (async () => {
      director.loadState(request.state ?? { ...new component({ screen: request.screen }).state, ...request.patch })
      await sleep(30)
      const items = await measure(request.id)
      if (!items) return
      const response: ProbeResponse = { type: 'vs-sfx-probe-result', id: request.id, signature: signatureOf(items), items }
      ;(event.source as Window | null)?.postMessage(response, '*')
    })()
  })
  void sleep(30).then(() => window.parent.postMessage({ type: READY }, '*'))
}

// ---- on the real page -----------------------------------------------------------------------------

export class ProbeClient {
  private readonly frame: HTMLIFrameElement
  private readonly ready: Promise<void>
  private nextId = 1
  private readonly waiting = new Map<number, (response: ProbeResponse | null) => void>()
  private onMessage: ((event: MessageEvent) => void) | null = null

  constructor() {
    this.frame = document.createElement('iframe')
    this.frame.setAttribute('aria-hidden', 'true')
    this.frame.tabIndex = -1
    // Laid out at the mockup's real size but parked off screen, so its controls have real shapes and cost nothing to look at.
    this.frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1440px;height:900px;border:0;visibility:hidden;pointer-events:none'
    this.ready = new Promise((resolve) => {
      this.onMessage = (event: MessageEvent) => {
        if (event.source !== this.frame.contentWindow) return
        const data = event.data as ProbeResponse | { type: string }
        if (data.type === READY) resolve()
        if (data.type === 'vs-sfx-probe-result') {
          const response = data as ProbeResponse
          this.waiting.get(response.id)?.(response)
          this.waiting.delete(response.id)
        }
      }
      window.addEventListener('message', this.onMessage)
    })
    this.frame.src = `${location.pathname}?sfx=probe`
    document.body.append(this.frame)
  }

  /** Resolves with what was heard, or null if a newer request took over before this one finished. */
  async probe(request: { state?: Record<string, unknown>; screen?: string; patch?: Record<string, unknown> }): Promise<ProbeResponse | null> {
    await this.ready
    for (const resolve of this.waiting.values()) resolve(null)
    this.waiting.clear()
    const id = this.nextId++
    return new Promise((resolve) => {
      this.waiting.set(id, resolve)
      const message: ProbeRequest = { type: 'vs-sfx-probe', id, ...request }
      this.frame.contentWindow?.postMessage(message, '*')
    })
  }

  dispose(): void {
    for (const resolve of this.waiting.values()) resolve(null)
    if (this.onMessage) window.removeEventListener('message', this.onMessage)
    this.frame.remove()
  }
}

/** Keeps the live page's debug view honest: after every real change of state, re-measures what each control plays. */
export function watchLive(director: UiSoundDirector, map: ScreenMap, client: ProbeClient, onBusy: (busy: boolean) => void): void {
  let last = ''
  let timer = 0
  let inFlight = 0
  director.watchRenders(({ state }) => {
    const json = JSON.stringify(state)
    if (json === last) return
    last = json
    window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      inFlight += 1
      onBusy(true)
      const response = await client.probe({ state })
      inFlight -= 1
      if (inFlight === 0) onBusy(false)
      if (response) map.setHeard(response.signature, response.items.map((item) => item.heard))
    }, 120)
  })
}

/** Presses every control on each screen in turn, a few frames at a time, and returns what each played. */
export async function scanScreens(screens: ReadonlyArray<ScreenDef>, onProgress: (done: number) => void, workers = 3): Promise<ScreenScan[]> {
  const results = new Map<string, ScreenScan>()
  const queue = [...screens]
  let done = 0
  const run = async () => {
    const client = new ProbeClient()
    try {
      for (let screen = queue.shift(); screen; screen = queue.shift()) {
        const response = await client.probe({ screen: screen.id, patch: screen.patch })
        if (response) results.set(screen.name, { id: screen.id, name: screen.name, items: response.items })
        done += 1
        onProgress(done)
      }
    } finally {
      client.dispose()
    }
  }
  await Promise.all(Array.from({ length: workers }, run))
  return screens.flatMap((screen) => results.get(screen.name) ?? [])
}
