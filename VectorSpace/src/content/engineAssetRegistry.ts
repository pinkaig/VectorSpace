/**
 * @file        engineAssetRegistry.ts
 * @brief       What the 3D engine has actually loaded, so the Asset Manager can account for it.
 *
 * @responsibility
 * The renderer loads GLB/glTF bytes through its own loaders — modelCache.ts for
 * placed models, environments.ts for rooms — and neither goes through the
 * resolver chain, so the manager's descriptor store has no idea what is really
 * in the engine. This registry is the reporting seam that closes that gap: the
 * loaders note every load here, and assetInventory() reads it.
 *
 * Reporting only, by design. Nothing here decides whether a load may proceed,
 * and no renderer behaviour depends on it, so adding a report can never make a
 * model fail to appear. Gating the renderer on a `ready` descriptor is a
 * separate and much larger change: it needs the viewport's artefact pass to be
 * re-run when a descriptor arrives, which today only onModelLoaded does.
 *
 * @ownership
 * Owns the load records and the url -> id index. Owns no bytes and no THREE
 * objects: the parsed templates still live in modelCache.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
export type EngineAssetKind = 'model' | 'environment'

export type EngineLoadState = 'loading' | 'loaded' | 'error'

export interface EngineAssetRecord {
  /** An assetId for a placed model, `env:<environmentId>` for a room. */
  id: string
  kind: EngineAssetKind
  /** The URL the bytes were fetched from. A blob: URL for an imported model, and a fresh one each session. */
  url: string
  state: EngineLoadState
  /** Set only when state is "error"; the loader's own message. */
  errorMessage?: string
  /**
   * How many times a load was requested for this id this session. Above one
   * means the parse cache missed and the same asset was fetched again — the
   * symptom an assetId-keyed model cache would remove.
   */
  loadCount: number
  startedAt: number
  settledAt?: number
  /** Last time the engine was handed this payload, whether by a load or a parse-cache hit. */
  lastAccessedAt: number
}

const records = new Map<string, EngineAssetRecord>()
// A load reports its assetId, but a parse-cache hit is only known by URL
// (getCachedModel takes nothing else), so uses can be attributed either way.
const idByUrl = new Map<string, string>()

/** The registry id for an environment, which has no assetId of its own. */
export const engineEnvironmentId = (environmentId: string): string => `env:${environmentId}`

const find = (key: string): EngineAssetRecord | undefined => {
  const direct = records.get(key)
  if (direct) return direct
  const id = idByUrl.get(key)
  return id ? records.get(id) : undefined
}

export const noteEngineLoadStarted = ({ id, kind, url }: { id: string; kind: EngineAssetKind; url: string }): void => {
  const now = Date.now()
  const existing = records.get(id)
  idByUrl.set(url, id)
  records.set(id, {
    id,
    kind,
    url,
    state: 'loading',
    loadCount: (existing?.loadCount ?? 0) + 1,
    startedAt: now,
    lastAccessedAt: now,
  })
}

export const noteEngineLoadSucceeded = (id: string): void => {
  const record = find(id)
  if (!record) return
  const now = Date.now()
  records.set(record.id, { ...record, state: 'loaded', errorMessage: undefined, settledAt: now, lastAccessedAt: now })
}

export const noteEngineLoadFailed = (id: string, errorMessage: string): void => {
  const record = find(id)
  if (!record) return
  records.set(record.id, { ...record, state: 'error', errorMessage, settledAt: Date.now() })
}

/** A parse-cache hit: no bytes were fetched, but the engine used this asset again. */
export const noteEngineAssetUsed = (idOrUrl: string): void => {
  const record = find(idOrUrl)
  if (!record) return
  records.set(record.id, { ...record, lastAccessedAt: Date.now() })
}

export const getEngineAsset = (id: string): EngineAssetRecord | undefined => records.get(id)

export const listEngineAssets = (): EngineAssetRecord[] => [...records.values()]

/**
 * Drops every record. The parsed templates in modelCache are untouched, so
 * this is for tests and for a future resetAssetState() that clears both.
 */
export const clearEngineAssetRegistry = (): void => {
  records.clear()
  idByUrl.clear()
}
