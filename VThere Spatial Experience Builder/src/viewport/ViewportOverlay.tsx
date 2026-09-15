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
