/**
 * @file        assets.ts
 * @author      Goh Pin Kai
 * @date        2026-10-04
 * @brief       Bundled model catalogue and asset URL resolution.
 *
 * @responsibility
 * Builds the catalogue of bundled 3D models from Vite's glob import, resolves
 * an asset id to a loadable URL, and provides catalogue search and usage
 * counting for the editor's asset panel.
 *
 * @inputs
 * Asset ids, a search query, and ProjectData when counting uses.
 *
 * @outputs
 * AssetDefinition values, resolved URLs, URL modifiers, and use counts.
 *
 * @members
 * AssetDefinition, assetCatalog, resolveModelUrl, resolveModelUrlModifier,
 * countAssetUses, filterAssets.
 *
 * @boundary
 * Owns the bundled catalogue only. User-imported assets belong to
 * userAssets.ts, and URL registration to viewport/assetResolution.ts.
 *
 * @dependencies
 * ./model, ./userAssets, ./viewport/assetResolution.
 *
 * @status
 * Current implementation, used by the M1 build.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import { AssetKind, type ProjectData } from '../project/model'
import { getUserModelUrlModifier } from './userAssets'
import { registerLocalAsset, resolveLocalAssetUrl } from '../content/assetResolution'
import { registerPlaceholderModels } from './placeholderModels'

// ── CATALOGUE CATEGORIES ──
// The catalogue's tabs, left to right. Each asset lists the tabs it shows under
// (AssetDefinition.categories), so one asset can be in more than one.
// To add a tab: add its id to CatalogueCategoryId and a row to catalogueCategories.
export type CatalogueCategoryId = 'exhibits' | 'signs' | 'misc' | 'zones'

export interface CatalogueCategory {
  id: CatalogueCategoryId
  label: string     // the tab's text
  singular: string  // one item of it, e.g. "Sign"
  tone?: 'zone'     // a different chip colour (CSS: .chip.tone-zone); absent = the normal chip
}

export const catalogueCategories: CatalogueCategory[] = [
  { id: 'exhibits', label: 'Exhibits', singular: 'Exhibit' },
  { id: 'signs', label: 'Signs', singular: 'Sign' },
  { id: 'misc', label: 'Misc', singular: 'Misc' },
  { id: 'zones', label: 'Zones and markers', singular: 'Zone or marker', tone: 'zone' },
]

export interface AssetDefinition {
  kind: AssetKind
  assetId: string
  label: string
  detail: string
  category: 'primitive' | 'model'
  // the catalogue tabs it shows under (see catalogueCategories above); can be more than one
  categories: CatalogueCategoryId[]
  searchableText: string
  // Present only for `model` assets — the GLB source cloneModel() instances are loaded from.
  modelUrl?: string
}

// Models shipped with the app. Vite bundles every src/assets/*.glb and maps its path to
// the built (hashed) URL — dropping a new .glb into that folder adds it to the library.
const bundledModelUrls = import.meta.glob<string>('./assets/*.glb', { query: '?url', import: 'default', eager: true })

// './assets/Display_Case.glb' -> 'Display Case'
const labelFromPath = (path: string): string =>
  path.replace(/^.*\//, '').replace(/\.glb$/i, '').replace(/[_-]+/g, ' ').trim()

// CATEGORIES for the built-in models, by file name (lower case, no .glb).
// A new model in src/content/assets/ should get a line here; one without a line shows under Misc.
const BUNDLED_CATEGORIES: Record<string, CatalogueCategoryId[]> = {
  sign: ['signs'],
  arrow: ['signs'],
  pedestal: ['misc'],
  stanchion: ['misc'],
}
const UNTAGGED_CATEGORIES: CatalogueCategoryId[] = ['misc']

// The primitive (cube/sphere/cylinder) placeholders are no longer offered here, but
// objects already saved with them still render — syncArtefacts keeps drawing them.
export const assetCatalog: AssetDefinition[] = Object.entries(bundledModelUrls)
  .map(([path, url]): AssetDefinition => {
    const label = labelFromPath(path)
    return {
      kind: 'model',
      // Stable across builds (the file name, not the hashed URL) so saved projects keep resolving.
      assetId: `bundled-model-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      detail: 'Built-in model',
      category: 'model',
      categories: BUNDLED_CATEGORIES[label.toLowerCase()] ?? UNTAGGED_CATEGORIES,
      searchableText: `${label.toLowerCase()} model`,
      modelUrl: url,
    }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

// Built-in catalog models register with the shared local catalog (the same one the asset
// resolver chain reads), so rendering and load-status/pickability agree on one URL source.
assetCatalog.forEach((asset) => {
  if (asset.modelUrl) registerLocalAsset(asset.assetId, { url: asset.modelUrl })
})

// three.js stand-ins for models not made yet, temporary placeholder
registerPlaceholderModels()

// The single place renderer code resolves a model SceneObject's assetId to a URL.
export const resolveModelUrl = (assetId: string): string | undefined => resolveLocalAssetUrl(assetId)

// Only ever set for a multi-file glTF asset imported through the UI (a .gltf plus separate
// .bin/texture files) — the built-in catalog and single-file .glb imports never need one.
// See userAssets.ts for why this rewrite is necessary.
export const resolveModelUrlModifier = (assetId: string): ((url: string) => string) | undefined =>
  getUserModelUrlModifier(assetId)

// How many objects, across every scene of the project, are placed from `assetId`. An asset
// in use can't be removed from the library, or those objects would lose their model.
export const countAssetUses = (project: ProjectData, assetId: string): number =>
  project.scenes.reduce((total, scene) => total + scene.objects.filter((object) => object.assetId === assetId).length, 0)

// The assets under one catalogue tab
export const assetsInCategory = (categoryId: CatalogueCategoryId, catalog: readonly AssetDefinition[] = assetCatalog): AssetDefinition[] =>
  catalog.filter((asset) => asset.categories.includes(categoryId))

export const filterAssets =(query: string, catalog: readonly AssetDefinition[] = assetCatalog): AssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}
