/**
 * @file        AssetGate.tsx
 * @brief       Holds a viewer back until the project's cloud models are ready.
 *
 * @responsibility
 * Wraps anything that draws a project (the editor's viewport, Play, a visitor's page, a teacher's
 * walk). While the asset manager is asking the server where the project's pack models live and
 * downloading them, the children are not mounted, so the scene never flashes empty or full of
 * error placeholders. If something cannot be got, it names what failed and why, and offers Try
 * again (for a dropped connection) and Open without them (so a removed model never traps anyone).
 * A project with no pack models passes straight through. Once the children are showing they stay
 * mounted for good: a pack model added later is fetched quietly in the background by the viewport.
 *
 * @inputs
 * `project`: the ProjectData the children draw. `children`: the viewer.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProjectData } from '../project/model'
import { collectPackAssetIds, isProjectReady, prepareProjectAssets, resetFailedAssets, type PrepareFailure, type PrepareProgress } from './prepareAssets'
import './AssetGate.css'

export function AssetGate({ project, children }: { project: ProjectData; children: ReactNode }) {
  const idsKey = useMemo(() => collectPackAssetIds(project).join('|'), [project])
  // nothing to wait for: no pack models, or every one is already addressed and downloaded
  const [released, setReleased] = useState(() => idsKey === '' || isProjectReady(project))
  const [progress, setProgress] = useState<PrepareProgress | null>(null)
  const [failures, setFailures] = useState<PrepareFailure[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (released) return
    let current = true
    setFailures([])
    void prepareProjectAssets(project, { onProgress: (next) => { if (current) setProgress(next) } }).then((failed) => {
      if (!current) return
      if (failed.length === 0) setReleased(true)
      else setFailures(failed)
    })
    return () => { current = false }
    // the project is read once per try: the gate decides on what was open when it started
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [released, attempt])

  if (released) return <>{children}</>

  if (failures.length > 0) {
    const retryable = failures.some((failure) => failure.retryable)
    return (
      <div className="asset-gate" role="alert">
        <div className="asset-gate-card">
          <h2 className="asset-gate-title">Some 3D models could not be loaded</h2>
          <ul className="asset-gate-list">
            {failures.map((failure) => (
              <li key={failure.assetId}><strong>{failure.name}</strong> {failure.reason}</li>
            ))}
          </ul>
          <div className="asset-gate-actions">
            {retryable && (
              <button type="button" className="asset-gate-button" onClick={() => { resetFailedAssets(failures); setAttempt((value) => value + 1) }}>
                Try again
              </button>
            )}
            <button type="button" className="asset-gate-button asset-gate-button-quiet" onClick={() => setReleased(true)}>
              Open without them
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="asset-gate" role="status">
      <div className="asset-gate-card">
        <h2 className="asset-gate-title">Getting the 3D models…</h2>
        {progress && <p className="asset-gate-text">{progress.done} of {progress.total} ready</p>}
      </div>
    </div>
  )
}
