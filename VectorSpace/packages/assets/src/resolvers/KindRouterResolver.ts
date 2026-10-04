/**
 * @file        KindRouterResolver.ts
 * @brief       Routes an AssetRef to the resolver that owns its kind.
 *
 * @responsibility
 * Table-driven routing on ref.kind, replacing the app-local FallbackResolver
 * while keeping its `primitive-<kind>` rule: only an assetId shaped like the
 * canonical primitive id goes to the primitive resolver, so a broken assetId
 * still fails visibly through the catalog route. Inline text goes to the
 * project-data resolver; every other kind (3D models and file-backed media)
 * goes to the catalog route, which Stage 3 extends with session object URLs
 * and remote media without touching this router.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Attachment-Integration section 6.1
 * Links point at the project wiki; migration is still in progress.
 */
import type { AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

export interface KindRoutes {
  /** cube/sphere/cylinder built-ins, addressed as `primitive-<kind>`. */
  primitives: AssetResolver
  /** Inline text from ProjectData.textAssets. */
  inlineText: AssetResolver
  /** Everything file-backed: 3D models and audio/image/video media. */
  catalog: AssetResolver
}

export class KindRouterResolver implements AssetResolver {
  constructor(private readonly routes: KindRoutes) {}

  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (ref.assetId === `primitive-${ref.kind}`) return this.routes.primitives.resolve(ref)
    if (ref.kind === 'text') return this.routes.inlineText.resolve(ref)
    return this.routes.catalog.resolve(ref)
  }
}
