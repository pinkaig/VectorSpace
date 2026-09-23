/**
 * @file        AssetStatusBadge.tsx
 * @brief       React presentation for the selected object's asset resolution state.
 *
 * @responsibility
 * Shows loading/ready/error feedback for whichever object is currently
 * selected, with a retry affordance on error. Renders nothing for an
 * unselected viewport, an idle descriptor, or a ready one — ready is the
 * silent default, matching ViewportOverlay's pattern for environment status.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import type { AssetDescriptor } from './assetResolution'

interface AssetStatusBadgeProps {
  descriptor: AssetDescriptor | undefined
  onRetry: () => void
}

export function AssetStatusBadge({ descriptor, onRetry }: AssetStatusBadgeProps) {
  if (!descriptor || descriptor.status === 'idle' || descriptor.status === 'ready') return null
  if (descriptor.status === 'loading') {
    return (
      <div className="asset-status-badge asset-status-loading">
        <div className="spinner" />
        <span>Resolving asset…</span>
      </div>
    )
  }
  return (
    <div className="asset-status-badge asset-status-error">
      <span className="overlay-error">Asset unavailable</span>
      <span className="overlay-detail">{descriptor.errorMessage}</span>
      <button className="button subtle" onClick={onRetry}>Retry</button>
    </div>
  )
}
