/**
 * @file        assetInventory.ts
 * @brief       One row per asset: what exists, where it is, and how it is being used.
 *
 * @responsibility
 * The accounting surface the Asset Manager was missing. Answers "what assets
 * exist, what state are they in, which of them is in the engine, and how many
 * objects use each" from the sources that actually know, joined here:
 *   - the local catalog (assetResolution) — what can be resolved at all;
 *   - the chain's descriptor cache (assetResolution) — what the manager resolved;
 *   - engineAssetRegistry — what the 3D engine really loaded;
 *   - the project — how many objects are placed from each asset.
 *
 * Deliberately NOT sourced from assetResolution's per-object descriptor store:
 * that store is keyed by object id, so it counts placements, not assets, and
 * reporting its size as an asset count is the exact accounting error this file
 * exists to remove.
 *
 * This module joins; it owns nothing. It lives apart from assetResolution.ts
 * because it reads assets.ts, which registers into assetResolution.ts — putting
 * the join there would close that import cycle.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import type { AssetRefKind, ProjectData } from '../project/model'
import type { AssetStatus, AssetTier } from '../../packages/assets/src/index'
import { assetCatalog } from './assets'
import { listCachedDescriptors, listLocalCatalog } from './assetResolution'
import { listEngineAssets, type EngineLoadState } from './engineAssetRegistry'
import { isUserAsset } from './userAssets'

/** Where the manager believes an asset's bytes come from. */
export type AssetSource = 'primitive' | 'bundled' | 'imported' | 'environment' | 'unknown'

export interface AssetInventoryRow {
  /** An assetId, or `env:<environmentId>` for a room, which has no assetId. */
  id: string
  kind: AssetRefKind | 'environment' | 'unknown'
  source: AssetSource
  /** The chain's last resolved status, absent when the manager has never resolved it. */
  status?: AssetStatus
  tier?: AssetTier
  url?: string
  contentType?: string
  /** Only ever what a source already knew; nothing here measures bytes. */
  sizeBytes?: number
  /** True when the 3D engine holds, or is fetching, a payload for this asset. */
  inEngine: boolean
  engineState?: EngineLoadState
  engineErrorMessage?: string
  /** Above one means the same asset was fetched again rather than reused. */
  engineLoadCount?: number
  lastAccessedAt?: number
  /** Objects placed from this asset across every scene. Absent when no project was given. */
  placements?: number
}

const bundledAssetIds = new Set(assetCatalog.map((asset) => asset.assetId))

const sourceFor = (id: string, kind: AssetInventoryRow['kind']): AssetSource => {
  if (kind === 'environment') return 'environment'
  if (id === `primitive-${kind}`) return 'primitive'
  if (isUserAsset(id)) return 'imported'
  if (bundledAssetIds.has(id)) return 'bundled'
  return 'unknown'
}

/** Objects placed from each assetId, across every scene — the same count countAssetUses gives. */
const placementsByAssetId = (project: ProjectData): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const scene of project.scenes) {
    for (const object of scene.objects) counts.set(object.assetId, (counts.get(object.assetId) ?? 0) + 1)
  }
  return counts
}

/**
 * One row per asset. `project` is optional: without it every column except
 * `placements` is still answerable, which is what a debug view opened outside
 * a loaded project needs.
 */
export const assetInventory = (project?: ProjectData): AssetInventoryRow[] => {
  const rows = new Map<string, AssetInventoryRow>()

  // A later source must not blank a field an earlier one filled, so undefined
  // patch values are dropped rather than spread over what is already known.
  const upsert = (id: string, patch: Partial<AssetInventoryRow>) => {
    const existing = rows.get(id)
    const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
    const merged = { id, inEngine: false, ...existing, ...given } as AssetInventoryRow
    merged.kind = merged.kind ?? 'unknown'
    merged.source = sourceFor(id, merged.kind)
    rows.set(id, merged)
  }

  // What can be resolved at all, whether or not anything has asked for it yet.
  // No kind is claimed here: the catalog is kind-agnostic, and the descriptor
  // below is what actually knows which kind an assetId was resolved as.
  for (const entry of listLocalCatalog()) {
    upsert(entry.assetId, { url: entry.url, contentType: entry.contentType })
  }

  // What the manager has actually resolved, which is where a status comes from.
  for (const descriptor of listCachedDescriptors()) {
    upsert(descriptor.ref.assetId, {
      kind: descriptor.ref.kind,
      status: descriptor.status,
      tier: descriptor.tier,
      url: descriptor.url ?? undefined,
      contentType: descriptor.contentType,
      sizeBytes: descriptor.sizeBytes,
    })
  }

  // What the engine really holds — the half the manager was blind to.
  for (const record of listEngineAssets()) {
    upsert(record.id, {
      kind: record.kind === 'environment' ? 'environment' : 'model',
      url: record.url,
      inEngine: true,
      engineState: record.state,
      engineErrorMessage: record.errorMessage,
      engineLoadCount: record.loadCount,
      lastAccessedAt: record.lastAccessedAt,
    })
  }

  if (project) {
    const counts = placementsByAssetId(project)
    for (const [assetId, placements] of counts) upsert(assetId, { placements })
    // an asset the inventory already knows but the project never places still reports 0
    for (const row of rows.values()) if (row.placements === undefined) row.placements = counts.get(row.id) ?? 0
  }

  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id))
}
