import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EnvironmentDefinition, findEnvironment } from './model'

export interface LoadedEnvironment {
  group: THREE.Group
  /** Releases geometries/materials/textures owned by this environment. */
  dispose: () => void
}

export interface EnvironmentLoadHandlers {
  onProgress?: (ratio: number) => void
}

const wallMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide })
const floorMaterial = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })

const box = (width: number, height: number, depth: number, material: THREE.Material, position: [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(...position)
  return mesh
}

/**
 * Stand-in environments used until VThere supplies the approved 2-4 GLB
 * environments (docs/asset-library-contract.md). Each mirrors the shape of a
 * real one: a floor, enclosing walls and a distinguishing feature, so the
 * loader / orbit / walk pipeline is exercised end to end.
 */
const proceduralBuilders: Record<string, () => THREE.Group> = {
  'gallery-hall': () => {
    const group = new THREE.Group()
    group.name = 'env-gallery-hall'
    const walls = wallMaterial(0x1c2a30)
    group.add(box(16, 0.2, 12, floorMaterial(0x121b20), [0, -0.1, 0]))
    group.add(box(16, 4, 0.2, walls, [0, 2, -6]))
    group.add(box(16, 4, 0.2, walls, [0, 2, 6]))
    group.add(box(0.2, 4, 12, walls, [-8, 2, 0]))
    group.add(box(0.2, 4, 12, walls, [8, 2, 0]))
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0xdfe9e2, emissive: 0x223a34, emissiveIntensity: 0.6 }))
    skylight.position.set(0, 3.9, 0)
    group.add(skylight)
    return group
  },
  'riverside-warehouse': () => {
    const group = new THREE.Group()
    group.name = 'env-riverside-warehouse'
    const walls = wallMaterial(0x2a2118)
    group.add(box(18, 0.2, 14, floorMaterial(0x1a1510), [0, -0.1, 0]))
    group.add(box(18, 5, 0.2, walls, [0, 2.5, -7]))
    group.add(box(0.2, 5, 14, walls, [-9, 2.5, 0]))
    group.add(box(0.2, 5, 14, walls, [9, 2.5, 0]))
    for (let index = -1; index <= 1; index += 1) {
      group.add(box(1.2, 5, 0.2, wallMaterial(0x3a2f22), [index * 5, 2.5, -6.9]))
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), new THREE.MeshStandardMaterial({ color: 0x1c3b46, roughness: 0.25, metalness: 0.1 }))
    water.rotation.x = -Math.PI / 2
    water.position.set(0, -0.05, 9)
    group.add(water)
    return group
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
      definition.url,
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
 * docs/asset-library-contract.md: loading, progress, error, retry, missing-asset.
 */
export const loadEnvironment = async (environmentId: string, handlers: EnvironmentLoadHandlers = {}): Promise<LoadedEnvironment> => {
  const definition = findEnvironment(environmentId)
  handlers.onProgress?.(0)
  const result = definition.kind === 'glb' ? await loadGlb(definition, handlers) : await loadProcedural(definition)
  handlers.onProgress?.(1)
  return result
}
