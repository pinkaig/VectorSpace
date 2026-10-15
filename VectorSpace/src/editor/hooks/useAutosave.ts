/**
 * @file        useAutosave.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       Saving the project to the browser and staging it for sync.
 *
 * @responsibility
 * Owns the save-status text, the sync status, persist/save, the 750 ms autosave, the
 * write-on-leave for an edit still waiting, and the sync-status subscription.
 *
 * @inputs
 * The current project and where the page's first project came from.
 *
 * @outputs
 * savedAt, persistenceState, syncStatus, syncStatusLabel, persist, save and the two
 * status setters (the file operations write their outcome through them).
 *
 * @boundary
 * Writes only. Loading the project is serializer.ts's job, once per mount in EditorPage.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useEffect, useRef, useState } from 'react'
import type { ProjectData } from '../../project/model'
import { loadProjectWithSource, saveProject } from '../../project/serializer'
import {
  getProjectSyncStatus,
  stageProjectSync,
  subscribeProjectSync,
  type ProjectSyncStatus,
} from '../../project/projectSync'

const syncStatusLabel: Record<ProjectSyncStatus, string> = {
  idle: 'Synced',
  pending: 'Syncing to server…',
  conflict: 'Sync conflict; local edits kept',
  failed: 'Sync failed, will retry',
}

export function useAutosave(project: ProjectData, initialSource: ReturnType<typeof loadProjectWithSource>['source']) {
  const [savedAt, setSavedAt] = useState(
    initialSource === 'default'
      ? 'New local project'
      : `Loaded ${initialSource} from this browser`,
  )
  const [persistenceState, setPersistenceState] = useState(
    initialSource === 'default'
      ? 'No local draft found; using clean project'
      : `Loaded from browser localStorage ${initialSource}`,
  )
  const [syncStatus, setSyncStatus] = useState<ProjectSyncStatus>(getProjectSyncStatus())
  /**
   * Dual write: Tier 1 (serializer.ts's localStorage save) happens synchronously
   * first so a reload never loses an edit even if sync never completes; Tier 2
   * (packages/sync's queue) is then staged for background delivery. Save status
   * text reflects Tier 1; sync status is tracked separately via syncStatus.
   */
  const persist = (nextProject: ProjectData, label: string) => {
    const result = saveProject(nextProject)
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setSavedAt(result === 'failed' ? 'Save failed' : `${label} ${time}`)
    setPersistenceState(result === 'saved' ? 'Primary + backup ready' :
      result === 'saved-with-backup' ? 'Backup copy only' : 'Export JSON now')
    if (result !== 'failed') stageProjectSync(nextProject)
  }
  // true from the moment an autosave is scheduled until it runs
  const savePendingRef = useRef(false)
  useEffect(() => {
    savePendingRef.current = true
    const timer = window.setTimeout(() => {
      savePendingRef.current = false
      persist(project, 'Autosaved')
    }, 750)
    return () => window.clearTimeout(timer)
  }, [project])
  // The autosave above is cancelled when this page unmounts, so an edit made in the last
  // 750 ms before leaving /editor would never reach storage. If one was still waiting,
  // this writes the latest project on the way out; leaving with nothing pending writes
  // and syncs nothing. persist only uses setters and module functions, so the first
  // render's copy is safe to keep.
  const latestProjectRef = useRef(project)
  latestProjectRef.current = project
  useEffect(() => () => {
    if (savePendingRef.current) persist(latestProjectRef.current, 'Saved')
  }, [])
  useEffect(() => subscribeProjectSync(setSyncStatus), [])
  const save = () => persist(project, 'Saved')

  return { savedAt, setSavedAt, persistenceState, setPersistenceState, syncStatus, syncStatusLabel, persist, save }
}
