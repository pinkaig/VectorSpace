/**
 * @file        RemoteMediaResolver.ts
 * @brief       Resolves assets from the backend media API (skeleton).
 *
 * @responsibility
 * Reserves the call shape (`GET /projects/{projectId}/media/{assetId}` ->
 * signed URL) that Stage 3's MediaRepository will implement. The body is
 * intentionally unimplemented: this resolver exists so callers can wire the
 * remote origin in today, then get real behavior for free once Stage 3
 * lands, with no caller-side change.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import { errorAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

export interface RemoteMediaResolverOptions {
  projectId: string
  fetchImpl?: typeof fetch
}

export class RemoteMediaResolver implements AssetResolver {
  constructor(private readonly options: RemoteMediaResolverOptions) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    try {
      throw new Error(
        `RemoteMediaResolver.resolve is not implemented (project "${this.options.projectId}", asset "${ref.assetId}"); ` +
          'backend media endpoints land in Stage 3.',
      )
    } catch (error) {
      return errorAssetDescriptor(ref, error instanceof Error ? error.message : String(error))
    }
  }
}
