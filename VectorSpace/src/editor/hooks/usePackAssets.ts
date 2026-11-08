/**
 * @file        usePackAssets.ts
 * @brief       Loads the signed-in user's published cloud asset packs.
 */
import { useEffect, useState } from 'react'
import { apiUrl, type GetToken } from '../../api/client'
import { createLibraryApi, type MyPack } from '../../api/library'
import {
  packManifestToCatalog,
  registerPackModels,
  type AssetDefinition,
  type PackManifest,
} from '../../content/assets'

type PackNotice = { tone: 'error'; lines: string[] } | null

const isManifest = (value: unknown): value is PackManifest => {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<PackManifest>
  return typeof manifest.slug === 'string'
    && typeof manifest.title === 'string'
    && Array.isArray(manifest.assets)
}

const unavailablePack = (pack: MyPack, reason: string): AssetDefinition => ({
  kind: 'model',
  assetId: `pack:${pack.slug}:unavailable`,
  label: pack.title,
  detail: `Unavailable: ${reason}`,
  category: 'model',
  categories: ['exhibits'],
  searchableText: `${pack.title.toLowerCase()} unavailable`,
  unavailable: true,
})

export function usePackAssets(getToken: GetToken, onAssetsLoaded: () => void): {
  packAssets: AssetDefinition[]
  packNotice: PackNotice
  /** Ask again, after a failed load. */
  reloadPacks: () => void
} {
  const [attempt, setAttempt] = useState(0)
  const [packAssets, setPackAssets] = useState<AssetDefinition[]>([])
  const [packNotice, setPackNotice] = useState<PackNotice>(null)

  useEffect(() => {
    if (!apiUrl) return
    let current = true
    const load = async () => {
      try {
        const packs = await createLibraryApi(getToken).myPacks()
        const results = await Promise.all(packs.map(async (pack) => {
          try {
            const response = await fetch(pack.manifestUrl)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const value: unknown = await response.json()
            if (!isManifest(value)) throw new Error('invalid manifest')
            return packManifestToCatalog(value)
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'could not read manifest'
            return [unavailablePack(pack, reason)]
          }
        }))
        if (!current) return
        const assets = results.flat()
        registerPackModels(assets)
        setPackAssets(assets)
        onAssetsLoaded()
        const failed = assets.filter((asset) => asset.unavailable)
        setPackNotice(failed.length > 0
          ? { tone: 'error', lines: failed.map((asset) => `${asset.label}: ${asset.detail}`) }
          : null)
      } catch (error) {
        if (!current) return
        setPackAssets([])
        setPackNotice({
          tone: 'error',
          lines: [error instanceof Error ? error.message : 'Could not load cloud asset packs'],
        })
      }
    }
    void load()
    return () => { current = false }
  }, [getToken, onAssetsLoaded, attempt])

  return { packAssets, packNotice, reloadPacks: () => setAttempt((value) => value + 1) }
}
