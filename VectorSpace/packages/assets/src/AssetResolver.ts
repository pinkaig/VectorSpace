/**
 * @file        AssetResolver.ts
 * @brief       The pluggable interface every asset origin implements.
 *
 * @responsibility
 * Defines the one contract (`resolve`) that lets calling code treat a
 * primitive, a local dev catalog, and a remote media backend identically.
 * Swapping which resolver backs an AssetKind must never require a caller
 * change; that guarantee is what AssetRef/AssetDescriptor/AssetResolver
 * together exist to provide.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Manager
 * Links point at the project wiki; migration is still in progress.
 */
import type { AssetDescriptor } from './AssetDescriptor'
import type { AssetRef } from './AssetRef'

export interface AssetResolver {
  resolve(ref: AssetRef): Promise<AssetDescriptor>
}
