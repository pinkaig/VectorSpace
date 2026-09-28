/**
 * @file        ContentGuardResolver.ts
 * @brief       Enforces the media content-type allowlist and size caps after resolution.
 *
 * @responsibility
 * Checks every ready media descriptor against MEDIA_KIND_SPECS: an unlisted
 * content type or an over-cap sizeBytes becomes an error descriptor, so a
 * hostile or oversized file is caught in one place regardless of which
 * resolver produced it. An extension is never trusted — only the declared
 * content type. Non-media kinds (primitives, models) pass through untouched;
 * their contract is owned by their own resolvers. Keeps the chain-wide rule:
 * never reject, a failure is an error descriptor.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/attachment-integration.md section 6.1
 */
import { errorAssetDescriptor, type AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'
import type { AssetResolver } from './AssetResolver'
import { MEDIA_KIND_SPECS, isAllowedContentType, isMediaKind } from './mediaKinds'

export class ContentGuardResolver implements AssetResolver {
  constructor(private readonly delegate: AssetResolver) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    const descriptor = await this.delegate.resolve(ref)
    if (descriptor.status !== 'ready' || !isMediaKind(ref.kind)) return descriptor
    if (descriptor.contentType === undefined || !isAllowedContentType(ref.kind, descriptor.contentType)) {
      return errorAssetDescriptor(ref, `Content type "${descriptor.contentType ?? 'unknown'}" is not allowed for kind "${ref.kind}"`)
    }
    // an unknown size passes: the guard blocks what it can prove, and the
    // type package still applies its own budget when the bytes arrive
    if (descriptor.sizeBytes !== undefined && descriptor.sizeBytes > MEDIA_KIND_SPECS[ref.kind].maxBytes) {
      return errorAssetDescriptor(ref, `Asset "${ref.assetId}" is ${descriptor.sizeBytes} bytes, over the ${MEDIA_KIND_SPECS[ref.kind].maxBytes}-byte limit for kind "${ref.kind}"`)
    }
    return descriptor
  }
}
