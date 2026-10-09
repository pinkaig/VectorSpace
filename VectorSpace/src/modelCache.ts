/**
 * @file        modelCache.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       Loads and caches GLB/GLTF model templates for placeable assets.
 *
 *              Loads a GLTF scene once per URL and keeps the parsed template so every
 *              placed instance is cloned from it instead of re-fetching/re-parsing on
 *              every scene rebuild. Concurrent requests for the same URL share one load.
 *
 *              Callers (Viewport.tsx, ReferenceViewport.tsx) clone from the cached
 *              template via cloneModel() and must never mutate it directly, as its
 *              geometries and materials are shared across every clone.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */

/************************************************************************************/
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const defaultLoader = new GLTFLoader()
const cache = new Map<string, THREE.Group>()
const pending = new Map<string, Promise<THREE.Group>>()

export const getCachedModel = (url: string): THREE.Group | undefined => cache.get(url)

// `urlModifier`, when given, rewrites every resource URL this load requests (buffers,
// textures) — needed only for a multi-file glTF imported through the UI, where those
// resources live at separate blob URLs the .gltf's own relative references can't reach.
// See userAssets.ts / assets.ts's resolveModelUrlModifier() for where this comes from.
export const loadModel = (url: string, urlModifier?: (requestedUrl: string) => string): Promise<THREE.Group> => {
  const cached = cache.get(url)
  if (cached) return Promise.resolve(cached)
  const inFlight = pending.get(url)
  if (inFlight) return inFlight
  const loader = urlModifier ? new GLTFLoader(new THREE.LoadingManager().setURLModifier(urlModifier)) : defaultLoader
  const promise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => { cache.set(url, gltf.scene); resolve(gltf.scene) },
      undefined,
      (error) => reject(error instanceof Error ? error : new Error(`Failed to load model "${url}"`)),
    )
  })
  pending.set(url, promise)
  promise.finally(() => pending.delete(url))
  return promise
}

// Every node of the clone is flagged as sharing the cache template's geometry/materials,
// so per-rebuild disposal in syncObjects knows never to dispose them — other placed
// instances (and future ones) still reference the same cached buffers.
export const cloneModel = (template: THREE.Group): THREE.Group => {
  const instance = template.clone(true)
  instance.traverse((node) => { node.userData.sharedResources = true })
  return instance
}
