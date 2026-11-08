/**
 * @file        PackDirectory.ts
 * @brief       The asset manager's way of asking the server where cloud pack assets live.
 *
 * @responsibility
 * A scene stores a pack asset only as an id ("pack:<slug>:<asset id>"). The address is the
 * server's to give, so before a scene can show it the manager has to ask. This class is that
 * asking, kept apart from any one screen so every viewer (editor, Play, a visitor's page, a
 * teacher's walk) gets the same behaviour:
 *   - batching: ids asked for in the same moment go out as one request, not one per object;
 *   - dedupe: an id already known, or already being asked for, is not asked again;
 *   - retry: a request that fails (offline, a cold server, a 5xx) is tried again with a growing
 *     pause before the manager gives up;
 *   - two kinds of "no": `missing` is the server saying the asset is gone, which is final and
 *     remembered; `unreachable` is the server not answering, which is not remembered, so the
 *     next ask tries afresh. A screen can then say "removed" or "couldn't reach the server".
 *
 * @inputs
 * A `fetchBatch` function injected by the app (the package never imports the app's API client).
 *
 * @outputs
 * `need(ids)` resolves with one outcome per id. It never rejects.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */

export interface PackDirectoryEntry {
  id: string
  url: string
  contentType: string
  sizeBytes?: number
  title?: string
  attribution?: string | null
}

export interface PackBatchAnswer {
  found: readonly PackDirectoryEntry[]
  /** Ids the server will not serve (removed, never published, malformed). Final. */
  missing: readonly string[]
}

export type PackOutcome =
  | { status: 'found'; entry: PackDirectoryEntry }
  | { status: 'missing' }
  | { status: 'unreachable'; message: string }

export interface PackDirectoryOptions {
  /** One round trip for a list of ids. A rejection means "could not reach the server". */
  fetchBatch: (ids: string[]) => Promise<PackBatchAnswer>
  /** Most ids per request; the server caps a request, so the directory splits beyond it. */
  maxBatch?: number
  /** Tries per request before reporting `unreachable`. */
  attempts?: number
  /** First pause between tries, doubled each time. */
  baseDelayMs?: number
  /** How long to collect ids into one request. */
  windowMs?: number
  /** A rejection that retrying cannot fix (a 4xx other than a timeout) can end the tries early. */
  isTransient?: (error: unknown) => boolean
  sleep?: (ms: number) => Promise<void>
}

/** True for the id a scene keeps for an asset that lives in a cloud pack. */
export const isPackAssetId = (assetId: string): boolean => assetId.startsWith('pack:')

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : 'Could not reach the server')

export class PackDirectory {
  private readonly known = new Map<string, PackDirectoryEntry>()
  private readonly gone = new Set<string>()
  private readonly waiting = new Map<string, Array<(outcome: PackOutcome) => void>>()
  private readonly listeners = new Set<(entry: PackDirectoryEntry) => void>()
  private timer: ReturnType<typeof setTimeout> | undefined

  private readonly maxBatch: number
  private readonly attempts: number
  private readonly baseDelayMs: number
  private readonly windowMs: number
  private readonly isTransient: (error: unknown) => boolean
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly options: PackDirectoryOptions) {
    this.maxBatch = options.maxBatch ?? 200
    this.attempts = options.attempts ?? 3
    this.baseDelayMs = options.baseDelayMs ?? 400
    this.windowMs = options.windowMs ?? 10
    this.isTransient = options.isTransient ?? (() => true)
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** The address of an asset already known, without asking. */
  peek(id: string): PackDirectoryEntry | undefined {
    return this.known.get(id)
  }

  /** Record addresses learned elsewhere (a pack manifest the palette already read). */
  seed(entries: readonly PackDirectoryEntry[]): void {
    entries.forEach((entry) => {
      this.known.set(entry.id, entry)
      this.gone.delete(entry.id)
    })
  }

  /** Called once for every address the directory learns, so a viewer can redraw. */
  onLearned(listener: (entry: PackDirectoryEntry) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Drop what is remembered about an id, including a "gone", so the next `need` asks again. */
  forget(id: string): void {
    this.known.delete(id)
    this.gone.delete(id)
  }

  /** Ask for several assets. Resolves with every id's outcome; never rejects. */
  async need(ids: readonly string[]): Promise<Map<string, PackOutcome>> {
    const outcomes = new Map<string, PackOutcome>()
    const pending: Array<Promise<void>> = []
    for (const id of new Set(ids)) {
      const entry = this.known.get(id)
      if (entry) { outcomes.set(id, { status: 'found', entry }); continue }
      if (this.gone.has(id)) { outcomes.set(id, { status: 'missing' }); continue }
      pending.push(this.enqueue(id).then((outcome) => { outcomes.set(id, outcome) }))
    }
    await Promise.all(pending)
    return outcomes
  }

  private enqueue(id: string): Promise<PackOutcome> {
    return new Promise((resolve) => {
      const callbacks = this.waiting.get(id)
      if (callbacks) callbacks.push(resolve)
      else this.waiting.set(id, [resolve])
      this.timer ??= setTimeout(() => { void this.flush() }, this.windowMs)
    })
  }

  private async flush(): Promise<void> {
    this.timer = undefined
    const batch = [...this.waiting.keys()]
    const callbacks = new Map(this.waiting)
    this.waiting.clear()
    const chunks: string[][] = []
    for (let i = 0; i < batch.length; i += this.maxBatch) chunks.push(batch.slice(i, i + this.maxBatch))
    await Promise.all(chunks.map((chunk) => this.ask(chunk, callbacks)))
  }

  private async ask(ids: string[], callbacks: Map<string, Array<(outcome: PackOutcome) => void>>): Promise<void> {
    const settle = (id: string, outcome: PackOutcome) => callbacks.get(id)?.forEach((resolve) => resolve(outcome))
    let lastError: unknown
    for (let attempt = 0; attempt < this.attempts; attempt += 1) {
      try {
        const answer = await this.options.fetchBatch(ids)
        const byId = new Map(answer.found.map((entry) => [entry.id, entry]))
        ids.forEach((id) => {
          const entry = byId.get(id)
          if (entry) {
            this.known.set(id, entry)
            this.gone.delete(id)
            settle(id, { status: 'found', entry })
            this.listeners.forEach((listener) => listener(entry))
          } else {
            // not in `found`: the server did not serve it, whether or not it listed it in `missing`
            this.gone.add(id)
            settle(id, { status: 'missing' })
          }
        })
        return
      } catch (error) {
        lastError = error
        if (!this.isTransient(error) || attempt === this.attempts - 1) break
        await this.sleep(this.baseDelayMs * 2 ** attempt)
      }
    }
    ids.forEach((id) => settle(id, { status: 'unreachable', message: messageOf(lastError) }))
  }
}
