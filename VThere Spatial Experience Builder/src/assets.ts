import { AssetKind } from './model'

export interface AssetDefinition {
  kind: AssetKind
  label: string
  detail: string
  category: 'primitive'
  searchableText: string
}

export const assetCatalog: AssetDefinition[] = [
  { kind: 'cube', label: 'Display block', detail: 'A clean pedestal form', category: 'primitive', searchableText: 'cube display block pedestal primitive' },
  { kind: 'sphere', label: 'Ornament', detail: 'Soft rounded exhibit', category: 'primitive', searchableText: 'sphere ornament rounded primitive' },
  { kind: 'cylinder', label: 'Column', detail: 'Tall architectural form', category: 'primitive', searchableText: 'cylinder column architectural primitive' },
]

export const filterAssets = (query: string): AssetDefinition[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return assetCatalog
  return assetCatalog.filter((asset) => asset.searchableText.includes(normalized))
}
