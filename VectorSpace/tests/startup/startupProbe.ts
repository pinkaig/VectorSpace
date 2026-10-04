/**
 * In-page startup probe, injected with page.addInitScript so the app needs no
 * hooks. It only wraps web-platform APIs (WebGL draws, AudioContext,
 * decodeAudioData) and reads Performance entries; it never touches app code.
 *
 * All timestamps are performance.now() values, i.e. ms since navigation start,
 * so they are directly comparable with Performance entries.
 *
 * Must stay self-contained: it is serialised into the page, so no imports and
 * no references to outer-scope values.
 */
export interface RawTimeline {
  domContentLoadedMs: number | null
  loadMs: number | null
  firstContentfulPaintMs: number | null
  /** First draw call issued on any canvas (editor gizmo canvases included). */
  firstDrawMs: number | null
  audioContexts: { at: number; state: string }[]
  decodes: { start: number; end: number; bytes: number; ok: boolean }[]
  pendingDecodes: number
  audioResources: { start: number; end: number; transferSize: number }[]
  scriptTransferBytes: number
  longTasks: { start: number; duration: number }[]
  /** Set by the spec once the app's own UI is usable; not recorded in-page. */
  interactiveMs: number | null
}

export interface StartupProbe {
  snapshot(): RawTimeline
}

export const startupProbeInit = () => {
  let firstDrawMs: number | null = null
  const audioContexts: RawTimeline['audioContexts'] = []
  const decodes: RawTimeline['decodes'] = []
  let pendingDecodes = 0
  const longTasks: RawTimeline['longTasks'] = []

  // First WebGL draw.
  for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const proto = Ctx.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
      const original = proto[name]
      if (!original) continue
      proto[name] = function (this: unknown, ...args: unknown[]) {
        if (firstDrawMs === null) firstDrawMs = performance.now()
        return original.apply(this, args)
      }
    }
  }

  // AudioContext construction (the app creates one per validated file).
  const OriginalAudioContext = window.AudioContext
  if (OriginalAudioContext) {
    window.AudioContext = class extends OriginalAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        audioContexts.push({ at: performance.now(), state: this.state })
      }
    }
  }

  // Decode timing. Promise form only; the app does not use the callback form.
  const decodeProto = BaseAudioContext.prototype as unknown as {
    decodeAudioData: (data: ArrayBuffer, ...rest: unknown[]) => Promise<AudioBuffer>
  }
  const originalDecode = decodeProto.decodeAudioData
  decodeProto.decodeAudioData = function (this: unknown, data: ArrayBuffer, ...rest: unknown[]) {
    const start = performance.now()
    const bytes = data.byteLength // read before decode detaches the buffer
    pendingDecodes++
    const result = originalDecode.call(this, data, ...rest)
    const finish = (ok: boolean) => {
      pendingDecodes--
      decodes.push({ start, end: performance.now(), bytes, ok })
    }
    result.then(() => finish(true), () => finish(false))
    return result
  }

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    // longtask unsupported: leave the list empty rather than failing the run.
  }

  const probe: StartupProbe = {
    snapshot() {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      return {
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
        loadMs: nav?.loadEventEnd || null,
        firstContentfulPaintMs: fcp?.startTime ?? null,
        firstDrawMs,
        audioContexts: [...audioContexts],
        decodes: [...decodes],
        pendingDecodes,
        audioResources: resources
          .filter((r) => r.name.includes('/audio/'))
          .map((r) => ({ start: r.startTime, end: r.responseEnd, transferSize: r.transferSize })),
        scriptTransferBytes: resources.filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js')).reduce((n, r) => n + r.transferSize, 0),
        longTasks: [...longTasks],
        interactiveMs: null,
      }
    },
  }
  ;(window as unknown as { __startup: StartupProbe }).__startup = probe
}
