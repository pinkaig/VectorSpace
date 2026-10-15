/**
 * @file        useUserAssets.ts
 * @author      Goh Pin Kai
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       The imported 3D model library and its import notice.
 *
 * @responsibility
 * Loads the stored imports once per mount, imports and deletes models, and holds the
 * list the Assets panel shows (built-in plus imported) and the outcome of the last import.
 *
 * @inputs
 * The current project (to refuse deleting a model still in use) and a bumpSync callback.
 *
 * @outputs
 * userAssets, visibleAssets, assetNotice, setAssetNotice, importModelFiles,
 * keepOriginalModel and deleteUserAsset.
 *
 * @boundary
 * Does not touch the project: a model only becomes part of it when an object is placed.
 * isFileDrag stays in EditorPage because it only inspects a drag event.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useEffect, useState } from 'react'
import type { ProjectData } from '../../project/model'
import { AssetDefinition, assetCatalog, countAssetUses } from '../../content/assets'
import { addUserAssets, loadUserAssets, removeUserAsset, type OptimisedImport } from '../../content/userAssets'

export function useUserAssets(project: ProjectData, bumpSync: () => void) {
  const [userAssets, setUserAssets] = useState<AssetDefinition[]>([])
  // Outcome of the last import. `info` is shown while an import is still running;
  // `optimised` lists imports that were shrunk to fit the real-time budget, each offering
  // to keep the original instead.
  const [assetNotice, setAssetNotice] = useState<{ tone: 'error' | 'success' | 'info'; lines: string[]; optimised?: OptimisedImport[] } | null>(null)
  const visibleAssets = [...assetCatalog, ...userAssets]

  useEffect(() => {
    loadUserAssets()
      .then((assets) => {
        setUserAssets(assets)
        // Imported models only get a URL once registered here; any already-placed
        // instance skipped by an earlier sync needs the viewport to retry now.
        bumpSync()
      })
      .catch((error) => setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not load imported assets'] }))
  }, [])

  const importModelFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return
    try {
      // Any number of .glb files, and .gltf files with their .bin/texture files, in one go.
      // Names already in the library (built-in or imported) and repeat content are skipped.
      // Models over the real-time budget are optimised on import
      const { added, skipped, optimised, unoptimised } = await addUserAssets(
        Array.from(files),
        visibleAssets.map((asset) => asset.label),
        assetCatalog.flatMap((asset) => (asset.modelUrl ? [{ label: asset.label, url: asset.modelUrl }] : [])),
        (message) => setAssetNotice({ tone: 'info', lines: [message] }),
      )
      if (added.length > 0) setUserAssets((prev) => [...prev, ...added])
      const lines = [
        ...(added.length > 0 ? [`Added ${added.map((asset) => asset.label).join(', ')}`] : []),
        ...unoptimised.map((item) => `Imported ${item.fileName} as-is, over the real-time budget: ${item.reason}`),
        ...skipped.map((item) => `Skipped ${item.fileName}: ${item.reason}`),
      ]
      setAssetNotice({ tone: skipped.length > 0 || unoptimised.length > 0 ? 'error' : 'success', lines, optimised })
    } catch (error) {
      setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not import these files'] })
    }
  }
  // Replaces an optimised import with its original files. Only offered in the import
  // notice: the original is held in memory until then, not stored alongside.
  const keepOriginalModel = async (item: OptimisedImport) => {
    try {
      const original = await item.keepOriginal()
      setUserAssets((prev) => prev.map((asset) => (asset.assetId === original.assetId ? original : asset)))
      bumpSync()
      setAssetNotice((notice) => notice && {
        ...notice,
        lines: [...notice.lines, `Kept the original ${original.label}`],
        optimised: notice.optimised?.filter((entry) => entry !== item),
      })
    } catch (error) {
      setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : `Could not restore the original ${item.asset.label}`] })
    }
  }
  const deleteUserAsset = async (asset: AssetDefinition) => {
    // Removing an asset that placed objects still use would leave them with no model
    // ("Asset unavailable"), so it is refused until those objects are deleted.
    const uses = countAssetUses(project, asset.assetId)
    if (uses > 0) {
      setAssetNotice({ tone: 'error', lines: [`Can't remove ${asset.label}: ${uses} object${uses === 1 ? '' : 's'} in the project use${uses === 1 ? 's' : ''} it. Delete ${uses === 1 ? 'that object' : 'those objects'} first.`] })
      return
    }
    await removeUserAsset(asset.assetId)
    setUserAssets((prev) => prev.filter((item) => item.assetId !== asset.assetId))
  }

  return { userAssets, visibleAssets, assetNotice, setAssetNotice, importModelFiles, keepOriginalModel, deleteUserAsset }
}
