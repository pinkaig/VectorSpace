/**
 * In-page measurement harness, injected with page.addInitScript so the app
 * needs no perf hooks.
 *
 * - Counts WebGL draw calls per canvas (patched before the app creates its
 *   context). A frame only "counts" as drawn if the main canvas issued draws,
 *   so edit mode's on-demand renderer can't pass vacuously on idle rAF ticks.
 * - Samples requestAnimationFrame intervals as frame times.
 * - Optionally drives the orbit camera with alternating synthetic wheel events
 *   so edit mode redraws every frame without hover-picking cost.
 */
export interface PerfSample {
  frameMs: number[]
  /** Draw calls on the main (largest) canvas, aligned with frameMs. */
  draws: number[]
}

export const harnessInit = () => {
  const counts = new Map<HTMLCanvasElement, number>()
  const bump = (gl: { canvas: unknown }) => {
    const canvas = gl.canvas as HTMLCanvasElement
    counts.set(canvas, (counts.get(canvas) ?? 0) + 1)
  }
  for (const Ctx of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const original = (Ctx.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[name]
      if (!original) continue
      ;(Ctx.prototype as unknown as Record<string, unknown>)[name] = function (this: { canvas: unknown }, ...args: unknown[]) {
        bump(this)
        return original.apply(this, args)
      }
    }
  }

  const mainCanvas = () =>
    [...counts.keys()].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]

  let running = false
  let ticks: { t: number; snapshot: Map<HTMLCanvasElement, number> }[] = []

  ;(window as unknown as { __perf: unknown }).__perf = {
    start(opts: { wheel: boolean }) {
      ticks = []
      running = true
      let n = 0
      const loop = (t: number) => {
        if (!running) return
        ticks.push({ t, snapshot: new Map(counts) })
        if (opts.wheel) {
          const canvas = mainCanvas()
          const direction = Math.floor(n++ / 10) % 2 === 0 ? -1 : 1
          canvas?.dispatchEvent(new WheelEvent('wheel', { deltaY: direction * 100, bubbles: true, cancelable: true }))
        }
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    stop(): PerfSample {
      running = false
      const main = mainCanvas()
      const frameMs: number[] = []
      const draws: number[] = []
      for (let i = 1; i < ticks.length; i++) {
        frameMs.push(ticks[i].t - ticks[i - 1].t)
        draws.push((ticks[i].snapshot.get(main) ?? 0) - (ticks[i - 1].snapshot.get(main) ?? 0))
      }
      return { frameMs, draws }
    },
  }
}
