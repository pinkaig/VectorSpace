/**
 * @file        AssetCache.ts
 * @brief       In-memory descriptor cache keyed by AssetRef, TTL-aware.
 *
 * @responsibility
 * Avoids re-resolving the same asset on every call. A ready descriptor with
 * `expiresAt` is evicted once that time passes (signed URLs go stale); a
 * ready descriptor with no `expiresAt` is cached indefinitely; error/loading
 * descriptors are never cached, so a failed or in-flight resolve is retried
 * on the next call rather than being stuck.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import type { AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'

const cacheKey = (ref: AssetRef): string => `${ref.kind}:${ref.assetId}`

export class AssetCache {
  private readonly entries = new Map<string, AssetDescriptor>()

  constructor(private readonly now: () => number = () => Date.now()) {}

  get(ref: AssetRef): AssetDescriptor | undefined {
    const key = cacheKey(ref)
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry
  }

  set(ref: AssetRef, descriptor: AssetDescriptor): void {
    if (descriptor.status !== 'ready') return
    this.entries.set(cacheKey(ref), descriptor)
  }

  invalidate(ref: AssetRef): void {
    this.entries.delete(cacheKey(ref))
  }

  clear(): void {
    this.entries.clear()
  }
}
