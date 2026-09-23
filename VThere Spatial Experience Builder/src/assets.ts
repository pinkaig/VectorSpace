import { AssetKind } from './model'
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

export const assetCatalog: AssetDefinition[] = [
  { kind: 'cube', assetId: 'primitive-cube', label: 'Display block', detail: 'A clean pedestal form', category: 'primitive', searchableText: 'cube display block pedestal primitive' },
  { kind: 'sphere', assetId: 'primitive-sphere', label: 'Ornament', detail: 'Soft rounded exhibit', category: 'primitive', searchableText: 'sphere ornament rounded primitive' },
  { kind: 'cylinder', assetId: 'primitive-cylinder', label: 'Column', detail: 'Tall architectural form', category: 'primitive', searchableText: 'cylinder column architectural primitive' },
]

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

export const filterAssets = (query: string, catalog: readonly AssetDefinition[] = assetCatalog): AssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return [...catalog]
  return catalog.filter((asset) => asset.searchableText.includes(normalized))
}
