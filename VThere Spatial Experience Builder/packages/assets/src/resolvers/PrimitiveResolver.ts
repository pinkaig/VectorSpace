/**
 * @file        PrimitiveResolver.ts
 * @brief       Resolves the built-in cube/sphere/cylinder primitives.
 *
 * @responsibility
 * Serves the hardcoded primitive kinds instantly, with no network or disk
 * access. These are the only assets guaranteed to resolve synchronously in
 * practice, so scenes can always place *something* even offline.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/asset-manager.md
 */
import type { AssetRefKind } from '@vthere/project'
import { errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../AssetDescriptor'
import type { AssetRef } from '../AssetRef'
import type { AssetResolver } from '../AssetResolver'

const PRIMITIVE_KINDS: readonly AssetRefKind[] = ['cube', 'sphere', 'cylinder']

export class PrimitiveResolver implements AssetResolver {
  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (!PRIMITIVE_KINDS.includes(ref.kind)) {
      return errorAssetDescriptor(ref, `PrimitiveResolver cannot resolve asset kind "${ref.kind}"`)
    }
    return readyAssetDescriptor(ref, { contentType: `model/primitive+${ref.kind}` })
  }
}
