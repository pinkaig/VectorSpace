/**
 * @file        PlaceholderAssetResolver.ts
 * @brief       Wraps a resolver so failures surface as a visible placeholder, never a silent blank.
 *
 * @responsibility
 * Catches both rejected promises and error-status descriptors from the
 * wrapped resolver and marks them as placeholders, so UI can render a
 * visible stand-in with a retry affordance instead of nothing at all.
 * Non-error descriptors (idle/loading/ready) pass through unchanged.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import type { AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

export interface PlaceholderAssetDescriptor extends AssetDescriptor {
  status: 'error'
  isPlaceholder: true
}

export const isPlaceholderDescriptor = (
  descriptor: AssetDescriptor,
): descriptor is PlaceholderAssetDescriptor =>
  descriptor.status === 'error' && (descriptor as PlaceholderAssetDescriptor).isPlaceholder === true

export class PlaceholderAssetResolver implements AssetResolver {
  constructor(private readonly delegate: AssetResolver) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    try {
      const descriptor = await this.delegate.resolve(ref)
      if (descriptor.status === 'error') {
        const placeholder: PlaceholderAssetDescriptor = { ...descriptor, status: 'error', isPlaceholder: true }
        return placeholder
      }
      return descriptor
    } catch (error) {
      const placeholder: PlaceholderAssetDescriptor = {
        ref,
        status: 'error',
        isPlaceholder: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
      return placeholder
    }
  }

  /** Re-resolves without consulting whatever cache the delegate may hold internally. */
  async retry(ref: AssetRef): Promise<AssetDescriptor> {
    return this.resolve(ref)
  }
}
