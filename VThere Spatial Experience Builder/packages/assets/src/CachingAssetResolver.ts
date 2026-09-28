/**
 * @file        CachingAssetResolver.ts
 * @brief       Wraps any AssetResolver with cache-then-resolve behavior.
 *
 * @responsibility
 * Serves a cached ready descriptor when one is live, otherwise delegates to
 * the wrapped resolver and caches a successful result. Implements
 * AssetResolver itself, so callers can swap a plain resolver for a cached
 * one (or swap the origin behind it) with no change to calling code — the
 * same swap-without-caller-change guarantee AssetResolver exists to provide.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import { AssetCache } from './AssetCache'
import type { AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'

export class CachingAssetResolver implements AssetResolver {
  // concurrent resolves of one kind:assetId share a single delegate call
  // instead of racing duplicate requests at the same origin
  private readonly inFlight = new Map<string, Promise<AssetDescriptor>>()

  constructor(
    private readonly delegate: AssetResolver,
    private readonly cache: AssetCache = new AssetCache(),
  ) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    const cached = this.cache.get(ref)
    if (cached) return cached

    const key = `${ref.kind}:${ref.assetId}`
    const pending = this.inFlight.get(key)
    if (pending) return pending

    const request = this.delegate
      .resolve(ref)
      .then((descriptor) => {
        this.cache.set(ref, descriptor)
        return descriptor
      })
      .finally(() => {
        this.inFlight.delete(key)
      })
    this.inFlight.set(key, request)
    return request
  }

  invalidate(ref: AssetRef): void {
    this.cache.invalidate(ref)
  }
}
