/**
 * @file        PackAssetResolver.ts
 * @brief       Resolves cloud-pack assets by asking the server through a PackDirectory.
 *
 * @responsibility
 * Sits in front of another resolver (the app's local catalogue). An id that is not a pack id goes
 * straight through, so bundled and imported assets behave exactly as before. A pack id is tried on
 * the local catalogue first (the palette may already have read its manifest), and only then
 * looked up on the server. The outcome is always a descriptor: ready with the address, or an
 * error whose message says whether the asset was removed or the server could not be reached.
 * Nothing here throws, and an error descriptor is never cached, so asking again really asks again.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'
import { isPackAssetId, type PackDirectory, type PackDirectoryEntry } from '../PackDirectory'

export const PACK_ASSET_REMOVED = 'This asset is no longer in its pack'

export class PackAssetResolver implements AssetResolver {
  constructor(
    private readonly primary: AssetResolver,
    private readonly directory: PackDirectory,
    /** Told each address the server gave, so the app can register it where the viewport reads. */
    private readonly onFound?: (entry: PackDirectoryEntry) => void,
  ) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (!isPackAssetId(ref.assetId)) return this.primary.resolve(ref)
    const local = await this.primary.resolve(ref)
    if (local.status === 'ready') return local
    const outcome = (await this.directory.need([ref.assetId])).get(ref.assetId)
    if (outcome?.status === 'found') {
      this.onFound?.(outcome.entry)
      return readyAssetDescriptor(ref, {
        contentType: outcome.entry.contentType,
        url: outcome.entry.url,
        sizeBytes: outcome.entry.sizeBytes,
      })
    }
    if (outcome?.status === 'unreachable') {
      return errorAssetDescriptor(ref, `Could not reach the server to find this asset (${outcome.message})`)
    }
    return errorAssetDescriptor(ref, PACK_ASSET_REMOVED)
  }
}
