/**
 * @file        useUserAudio.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       The imported audio library and its import notice.
 *
 * @responsibility
 * Loads the stored audio imports once per mount, imports and deletes clips, and holds
 * the token that makes the audio list re-render plus the outcome of the last import.
 *
 * @inputs
 * The current project (to refuse deleting a clip a rule still plays).
 *
 * @outputs
 * audioCatalogToken, audioNotice, setAudioNotice, importAudioFiles and deleteUserAudio.
 *
 * @boundary
 * audioAssetCatalog itself is mutated in place by userAudio.ts; this hook only bumps a
 * token so the panels read it again. It does not own the catalog.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useEffect, useState } from 'react'
import type { ProjectData } from '../../project/model'
import { audioAssetCatalog, countAudioAssetUses, type AudioAssetDefinition } from '../../content/audioAssets'
import { addUserAudio, isUserAudioAsset, loadUserAudio, removeUserAudio } from '../../content/userAudio'

export function useUserAudio(project: ProjectData) {
  // Bumped whenever userAudio.ts's IndexedDB-backed catalog changes (load, import,
  // delete) — audioAssetCatalog is mutated in place (see userAudio.ts), so this just
  // forces the audio sub-list and rule-authoring dropdown to re-render against it.
  const [audioCatalogToken, setAudioCatalogToken] = useState(0)
  const [audioNotice, setAudioNotice] = useState<{ tone: 'error' | 'success' | 'info'; lines: string[] } | null>(null)

  useEffect(() => {
    loadUserAudio()
      .then(() => setAudioCatalogToken((value) => value + 1))
      .catch((error) => setAudioNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not load imported audio'] }))
  }, [])

  /**
   * Imports every .ogg/.mp3/.wav in `files` (selected via the Import Audio button or
   * dropped into the Assets panel). addUserAudio() does the real work — existing-name
   * and duplicate-content checks (mirroring importModelFiles' guards for models) plus
   * a playability check (actually decoding the bytes with the Web Audio API) that has
   * no model equivalent, since a GLB either parses or it doesn't at load time, while a
   * corrupt or mislabelled audio file would otherwise sit in the library looking fine
   * until a rule tries to play it. Accepted clips are stored in IndexedDB so they
   * survive a reload; audioAssetCatalog is mutated in place by addUserAudio, so bumping
   * audioCatalogToken is enough to make the dropdown and this panel pick them up.
   */
  const importAudioFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return
    try {
      const { added, skipped } = await addUserAudio(
        Array.from(files),
        audioAssetCatalog.map((asset) => asset.label),
        audioAssetCatalog.filter((asset) => !isUserAudioAsset(asset.assetId)).map((asset) => ({ label: asset.label, url: asset.url })),
      )
      if (added.length > 0) setAudioCatalogToken((value) => value + 1)
      const lines = [
        ...(added.length > 0 ? [`Added ${added.map((asset) => asset.label).join(', ')}`] : []),
        ...skipped.map((item) => `Skipped ${item.fileName}: ${item.reason}`),
      ]
      setAudioNotice({ tone: skipped.length > 0 ? 'error' : 'success', lines })
    } catch (error) {
      setAudioNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not import these audio files'] })
    }
  }
  const deleteUserAudio = async (asset: AudioAssetDefinition) => {
    // Same reasoning as deleteUserAsset: removing a sound a rule still plays would
    // leave that rule with nothing to play, so it's refused until the rule is removed.
    const uses = countAudioAssetUses(project, asset.assetId)
    if (uses > 0) {
      setAudioNotice({ tone: 'error', lines: [`Can't remove ${asset.label}: ${uses} rule action${uses === 1 ? '' : 's'} still play${uses === 1 ? 's' : ''} it. Remove that interaction first.`] })
      return
    }
    await removeUserAudio(asset.assetId)
    setAudioCatalogToken((value) => value + 1)
  }

  return { audioCatalogToken, audioNotice, setAudioNotice, importAudioFiles, deleteUserAudio }
}
