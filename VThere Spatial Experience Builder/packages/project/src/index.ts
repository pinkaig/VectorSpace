/**
 * @file        index.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Canonical shared project, scene, object, and transform model.
 *
 * @responsibility
 * Defines renderer-independent project data and creates safe default and
 * cloned project values for editor, serializer, and runtime consumers.
 *
 * @inputs
 * AssetKind and object index values for makeObject().
 *
 * @outputs
 * Typed project structures, defaultProject(), cloneProject(), and makeObject().
 *
 * @members
 * AssetKind, TransformData, SceneObject, SceneData, ProjectData,
 * defaultProject, cloneProject, and makeObject.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/project-serialization.md
 */
export type AssetKind = 'cube' | 'sphere' | 'cylinder'

export interface TransformData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: AssetKind
  transform: TransformData
}

/**
* `procedural` environments are created directly in the app. 
* `glb` environments are loaded from a URL. 
* Procedural environments are used as temporary placeholders until 
* the final environment assets are approved. 
* This allows loading, orbit mode, and walk mode to be tested now.
 */
export type EnvironmentKind = 'procedural' | 'glb'

export interface EnvironmentDefinition {
  id: string
  name: string
  kind: EnvironmentKind
  description: string
  proceduralId?: string
  url?: string
}

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

export const environmentLibrary: EnvironmentDefinition[] = [
  {
    id: 'env-gallery-hall',
    name: 'Gallery Hall',
    kind: 'procedural',
    proceduralId: 'gallery-hall',
    description: 'A bright rectangular gallery room with a skylight band. Placeholder environment.',
  },
  {
    id: 'env-riverside-warehouse',
    name: 'Riverside Warehouse',
    kind: 'procedural',
    proceduralId: 'riverside-warehouse',
    description: 'An open warehouse shell facing the water, standing in for the Singapore River trade site. Placeholder environment.',
  },
]

export const defaultEnvironmentId = environmentLibrary[0].id

export const findEnvironment = (environmentId: string): EnvironmentDefinition =>
  environmentLibrary.find((item) => item.id === environmentId) ?? environmentLibrary[0]

export const defaultCameraPose = (): CameraPose => ({ position: [7, 5.5, 8], target: [0, 0.7, 0] })

export interface SceneData {
  id: string
  name: string
  objects: SceneObject[]
  environmentId: string
  startCamera: CameraPose
}

export interface ProjectData {
  schemaVersion: 1
  id: string
  name: string
  scenes: SceneData[]
  activeSceneId: string
}

export const makeScene = (id: string, name: string): SceneData => ({
  id,
  name,
  objects: [],
  environmentId: defaultEnvironmentId,
  startCamera: defaultCameraPose(),
})

export const defaultProject = (): ProjectData => ({
  schemaVersion: 1,
  id: 'project-vthere-demo',
  name: 'Tide Lines Exhibition',
  activeSceneId: 'scene-gallery',
  scenes: [makeScene('scene-gallery', 'Gallery')],
})

export const cloneProject = (project: ProjectData): ProjectData =>
  JSON.parse(JSON.stringify(project)) as ProjectData

// half the height of each primitive's geometry, so a freshly placed object rests on the floor
const restingHeight: Record<AssetKind, number> = { cube: 0.55, sphere: 0.65, cylinder: 0.6 }

export const makeObject = (assetKind: AssetKind, index: number): SceneObject => ({
  id: `${assetKind}-${Date.now()}-${index}`,
  name: `${assetKind[0].toUpperCase()}${assetKind.slice(1)} ${index}`,
  assetId: `primitive-${assetKind}`,
  assetKind,
  transform: {
    position: [0, restingHeight[assetKind], 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
})