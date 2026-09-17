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
  visible: boolean
  enabled: boolean
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
    id: 'env-empty',
    name: 'Empty',
    kind: 'procedural',
    proceduralId: 'empty',
    description: 'No walls or floor — just the grid, for working against a blank scene.',
  },
  {
    id: 'env-riverside-warehouse',
    name: 'Riverside Warehouse',
    kind: 'procedural',
    proceduralId: 'riverside-warehouse',
    description: 'An open warehouse shell facing the water, standing in for the Singapore River trade site. Placeholder environment.',
  },
  {
    id: 'env-gallery-hall',
    name: 'Gallery Hall',
    kind: 'procedural',
    proceduralId: 'gallery-hall',
    description: 'A bright rectangular gallery room with a skylight band. Placeholder environment.',
  },
]

export const defaultEnvironmentId =
  environmentLibrary.find((item) => item.proceduralId !== 'empty')?.id ?? environmentLibrary[0].id

export const findEnvironment = (environmentId: string): EnvironmentDefinition =>
  environmentLibrary.find((item) => item.id === environmentId) ??
  environmentLibrary.find((item) => item.id === defaultEnvironmentId) ??
  environmentLibrary[0]

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
  visible: true,
  enabled: true,
  transform: {
    position: [0, restingHeight[assetKind], 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
})

/**
 * PSEUDO-CODE: responsibilities retained by this project package.
 *
 * This is documentation only. The executable lifecycle operations live in
 * `packages/authoring-engine`. This package remains the canonical, serializable
 * project contract and must not become a mutable object registry.
 *
 * ProjectData:
 *   owns project identity, schemaVersion, scene ordering, and active scene ID
 *   contains every authored SceneObject exactly once
 *   is safe to clone, serialize, migrate, validate, and restore
 *
 * SceneObject:
 *   owns persistent object identity, display name, asset identity, asset kind,
 *   and transform data
 *   may gain visible, enabled, or parentId only through an approved schema
 *   migration; these fields are not added by this pseudocode
 *
 * Project package pure helpers:
 *   makeScene(sceneId, name)
 *     -> create a valid empty scene with default environment and camera
 *
 *   makeObject(assetKind, displayIndex)
 *     -> create default primitive data for an authoring command to insert
 *
 *   cloneProject(project)
 *     -> return a defensive snapshot copy for history or editing
 *
 *   findScene(project, sceneId)
 *     -> read-only lookup; return a scene or an explicit missing-scene result
 *
 *   findObject(project, sceneId, objectId)
 *     -> read-only lookup; return an object or an explicit missing-object result
 *
 * Authoring-engine boundary:
 *   input = { projectSnapshot, operation, dependencies }
 *   result = authoringEngine.apply(input)
 *   result.projectSnapshot = a new validated ProjectData value
 *   result.historyData = undo/redo information for the command timeline
 *
 *   create / duplicate / remove / transform / rename operations
 *     -> belong to `packages/authoring-engine`
 *     -> never mutate this package's global state because none exists
 *
 * Persistence and renderer boundaries:
 *   serializer.save(projectSnapshot)
 *   viewport.observe(projectSnapshot)
 *   runtime.load(validatedProjectSnapshot)
 *
 * None of those adapters may become the authority for object meaning. They
 * observe or restore ProjectData; the authoring engine creates the next
 * snapshot, and the project package defines its shape.
 */

