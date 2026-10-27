/**
 * @file       environments.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Manages 3D environment loading from GLB files and procedural
 *             builders, including asset URL resolution, loading progress,
 *             error handling, and resource cleanup.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EnvironmentDefinition, findEnvironment } from '../project/model'
import { engineEnvironmentId, noteEngineLoadFailed, noteEngineLoadStarted, noteEngineLoadSucceeded } from './engineAssetRegistry'

// Environment models shipped with the app. Vite bundles every src/env/*.glb and maps its
// path to the built (hashed) URL, so catalog entries can refer to 'env/room_1.glb'.
const bundledEnvironmentUrls = import.meta.glob<string>('./env/*.glb', { query: '?url', import: 'default', eager: true })

export const resolveEnvironmentUrl = (url: string): string => bundledEnvironmentUrls[`./${url}`] ?? url

export interface LoadedEnvironment {
  group: THREE.Group
  /** Releases geometries/materials/textures owned by this environment. 
   * works like c++ release, its a cleanup function
  */
  dispose: () => void
}

export interface EnvironmentLoadHandlers {
  onProgress?: (ratio: number) => void
}

/**
 * Procedural environments are built in code rather than loaded from a file.
 * Only 'empty' is left now that the placeholder rooms were replaced by the real
 * GLB environments in src/env.
 */
const proceduralBuilders: Record<string, () => THREE.Group> = {
  empty: () => {
    const group = new THREE.Group()
    group.name = 'env-empty'
    return group // no floor/walls — the viewport's own grid is the only reference
  },
}

export const listProceduralIds = (): string[] => Object.keys(proceduralBuilders)

const disposeGroup = (group: THREE.Group) => {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material.dispose())
    }
  })
}

const loadProcedural = async (definition: EnvironmentDefinition): Promise<LoadedEnvironment> => {
  const build = definition.proceduralId ? proceduralBuilders[definition.proceduralId] : undefined
  if (!build) throw new Error(`Missing procedural environment "${definition.proceduralId ?? definition.id}"`)
  const group = build()
  return { group, dispose: () => disposeGroup(group) }
}

// Room GLBs are loaded by this bare GLTFLoader rather than through the resolver
// chain, so every load is reported to engineAssetRegistry — otherwise the Asset
// Manager cannot see the largest files in the scene at all. Reporting only: the
// loading is unchanged, and a report never decides whether a room may load.
const loadGlb = (definition: EnvironmentDefinition, handlers: EnvironmentLoadHandlers): Promise<LoadedEnvironment> =>
  new Promise((resolve, reject) => {
    if (!definition.url) { reject(new Error(`Environment "${definition.id}" has no source URL`)); return }
    const url = resolveEnvironmentUrl(definition.url)
    const recordId = engineEnvironmentId(definition.id)
    noteEngineLoadStarted({ id: recordId, kind: 'environment', url })
    new GLTFLoader().load(
      url,
      (gltf) => {
        const group = new THREE.Group()
        group.add(gltf.scene)
        noteEngineLoadSucceeded(recordId)
        resolve({ group, dispose: () => disposeGroup(group) })
      },
      (event) => { if (event.lengthComputable) handlers.onProgress?.(event.loaded / event.total) },
      (error) => {
        const failure = error instanceof Error ? error : new Error('Failed to load environment file')
        noteEngineLoadFailed(recordId, failure.message)
        reject(failure)
      },
    )
  })
export const loadEnvironment = async (environmentId: string, handlers: EnvironmentLoadHandlers = {}): Promise<LoadedEnvironment> => {
  const definition = findEnvironment(environmentId)
  handlers.onProgress?.(0)
  const result = definition.kind === 'glb' ? await loadGlb(definition, handlers) : await loadProcedural(definition)
  handlers.onProgress?.(1)
  return result
}
