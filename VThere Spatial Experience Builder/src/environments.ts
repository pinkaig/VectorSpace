/// <reference types="vite/client" />
/**
 * @file        environments.ts
 * @author      Goh Pin Kai
 * @date        2026-10-04
 * @brief       Environment (room) loading, from glTF files and procedural builders.
 *
 * @responsibility
 * Resolves an environment id to either a bundled glTF/GLB file loaded via
 * GLTFLoader or a procedurally built scene, and reports progress and failure
 * through the supplied handlers.
 *
 * @inputs
 * An environment id and optional load handlers.
 *
 * @outputs
 * A LoadedEnvironment containing the Three.js object to add to the scene.
 *
 * @members
 * resolveEnvironmentUrl, LoadedEnvironment, EnvironmentLoadHandlers,
 * listProceduralIds, loadEnvironment.
 *
 * @boundary
 * Owns environment loading only. Scene composition and lifecycle belong to
 * viewport/environmentController.ts.
 *
 * @dependencies
 * three, three GLTFLoader, ./model.
 *
 * @status
 * Current implementation, used by the M1 build.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EnvironmentDefinition, findEnvironment } from './model'

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

const loadGlb = (definition: EnvironmentDefinition, handlers: EnvironmentLoadHandlers): Promise<LoadedEnvironment> =>
  new Promise((resolve, reject) => {
    if (!definition.url) { reject(new Error(`Environment "${definition.id}" has no source URL`)); return }
    new GLTFLoader().load(
      resolveEnvironmentUrl(definition.url),
      (gltf) => {
        const group = new THREE.Group()
        group.add(gltf.scene)
        resolve({ group, dispose: () => disposeGroup(group) })
      },
      (event) => { if (event.lengthComputable) handlers.onProgress?.(event.loaded / event.total) },
      (error) => reject(error instanceof Error ? error : new Error('Failed to load environment file')),
    )
  })

/**
 * Loads an environment by id, reporting progress and surfacing a recoverable
 * error rather than throwing into the render loop. Required states per
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Asset-Library-Contract: loading, progress, error, retry, missing-asset.
 * Links point at the project wiki; migration is still in progress.
 */
export const loadEnvironment = async (environmentId: string, handlers: EnvironmentLoadHandlers = {}): Promise<LoadedEnvironment> => {
  const definition = findEnvironment(environmentId)
  handlers.onProgress?.(0)
  const result = definition.kind === 'glb' ? await loadGlb(definition, handlers) : await loadProcedural(definition)
  handlers.onProgress?.(1)
  return result
}
