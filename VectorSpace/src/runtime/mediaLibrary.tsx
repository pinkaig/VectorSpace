/**
 * @file        mediaLibrary.tsx
 * @author      Weian Ching
 * @brief       Tells MediaView where a project's media library lives.
 *
 * @responsibility
 * MediaView only knows a media reference ({ kind, assetId }). This context
 * turns that into a descriptor. The default is the media library kept in this
 * browser (src/content/localMediaLibrary.ts), checked by ContentGuardResolver;
 * an id it does not know resolves to an error, so MediaView shows its
 * "unavailable" fallback with the caption, never a blank box. A page that has
 * opened a server project can instead wrap its tree in
 * MediaLibraryProvider, which resolves through
 * Caching -> ContentGuard -> RemoteMediaResolver (the same guard order as
 * src/content/assetResolution.ts).
 *
 * @documentation
 * docs/handover/image-video-work-package.md steps B5 and B6.
 */
import { createContext, useMemo, type ReactNode } from 'react'
import {
  CachingAssetResolver,
  ContentGuardResolver,
  RemoteMediaResolver,
  type AssetDescriptor,
  type AssetRef,
} from '../../packages/assets/src/index'
import { LocalMediaResolver } from '../content/localMediaLibrary'

export type ResolveMedia = (ref: AssetRef) => Promise<AssetDescriptor>

// no caching layer: a local blob: URL never expires, and approvals must show at once
const localGuarded = new ContentGuardResolver(new LocalMediaResolver())
export const resolveLocalMedia: ResolveMedia = (ref) => localGuarded.resolve(ref)

export const MediaLibraryContext = createContext<ResolveMedia>(resolveLocalMedia)

/** The resolve function for one server project; exported so it can be tested without React. */
export const createMediaLibrary = (options: { projectId: string; baseUrl?: string; getToken?: () => Promise<string | null> }): ResolveMedia => {
  const resolver = new CachingAssetResolver(new ContentGuardResolver(new RemoteMediaResolver(options)))
  return (ref) => resolver.resolve(ref)
}

export function MediaLibraryProvider({ projectId, baseUrl, getToken, children }: {
  projectId: string
  baseUrl?: string
  getToken?: () => Promise<string | null>
  children: ReactNode
}) {
  const resolve = useMemo(() => createMediaLibrary({ projectId, baseUrl, getToken }), [projectId, baseUrl, getToken])
  return <MediaLibraryContext.Provider value={resolve}>{children}</MediaLibraryContext.Provider>
}
