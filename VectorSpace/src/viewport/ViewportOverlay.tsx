/**
 * @file        ViewportOverlay.tsx
 * @brief       React presentation for environment loading and viewport hints.
 *
 * @responsibility
 * Displays loading progress, recoverable environment errors, retry controls,
 * and interaction hints. It does not load assets or own Three.js resources.
 *
 * @inputs
 * EnvStatus values and a retry callback supplied by the viewport boundary.
 *
 * @outputs
 * React overlay elements above the Three.js canvas.
 *
 * @documentation
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import type { EnvStatus } from './renderTypes'

interface ViewportOverlayProps {
  status: EnvStatus
  onRetry: () => void
}

export function ViewportOverlay({ status, onRetry }: ViewportOverlayProps) {
  if (status.state === 'ready') return null
  return (
    <div className="viewport-overlay">
      {status.state === 'loading' ? (
        <>
          <div className="spinner" />
          <p>Loading environment...</p>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(status.progress * 100)}%` }} /></div>
        </>
      ) : (
        <>
          <p className="overlay-error">Could not load this environment.</p>
          <p className="overlay-detail">{status.message}</p>
          <button className="button subtle" onClick={onRetry}>Retry</button>
        </>
      )}
    </div>
  )
}

export function ViewportHint({ text }: { text: string | null }) {
  return text ? <div className="viewport-hint">{text}</div> : null
}

// only in Run Simulation only: a fixed center-screen aim reference for mouse-look, since the
// cursor is hidden while pointer-locked (in interactionController file, funtion: onPointerLockChange).
// `ring` is play mode's Walk: a small hollow circle instead of the cross.
export function ViewportCrosshair({ ring = false }: { ring?: boolean }) {
  return <div className={ring ? 'viewport-crosshair ring' : 'viewport-crosshair'} />
}
