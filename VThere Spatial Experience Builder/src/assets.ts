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
import { AssetKind, type ProjectData } from './model'
import { getUserModelUrlModifier } from './userAssets'
import { registerLocalAsset, resolveLocalAssetUrl } from './viewport/assetResolution'

export interface AssetDefinition {
  kind: AssetKind
  assetId: string
  label: string
  detail: string
  category: 'primitive' | 'model'
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

export const filterAssets =(query: string, catalog: readonly AssetDefinition[] = assetCatalog): AssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}
