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

/**
 * Future extension contract for object lifecycle state.
 *
 * Keep the canonical project snapshot in ProjectData and treat these properties
 * as schema-level evolution notes rather than an immediate runtime feature.
 * This preserves compatibility while documenting the intended direction.
 */
export interface ObjectLifecycleState {
  id: string
  visible: boolean
  enabled: boolean
  status: 'draft' | 'active' | 'hidden' | 'deleted'
  parentId?: string
  groupId?: string
}

/**
 * PSEUDO-CODE: object lifecycle operations.
 *
 * This is intentionally expressed as design guidance, not as active logic,
 * so that implementation can be staged and validated against the existing
 * architecture before introducing mutation rules.
 *
 * createObject(project, sceneId, assetKind):
 *   scene = project.scenes.find(s => s.id === sceneId)
 *   if (!scene) throw InvalidSceneError
 *
 *   objectId = generateStableObjectId()
 *   object = {
 *     id: objectId,
 *     name: readableName(assetKind),
 *     assetKind,
 *     assetId: assetIdFor(assetKind),
 *     visible: true,
 *     enabled: true,
 *     status: 'active',
 *     transform: defaultTransform(assetKind),
 *   }
 *
 *   scene.objects.push(object)
 *   return { project, objectId }
 *
 * duplicateObject(project, sceneId, sourceObjectId):
 *   clone = deepClone(sourceObject)
 *   clone.id = generateStableObjectId()
 *   clone.name = duplicateName(sourceObject.name)
 *   clone.visible = sourceObject.visible
 *   clone.enabled = sourceObject.enabled
 *   clone.parentId = sourceObject.parentId
 *   clone.groupId = sourceObject.groupId
 *   scene.objects.push(clone)
 *   return { project, objectId: clone.id }
 *
 * removeObject(project, sceneId, objectId):
 *   const next = scene.objects.filter(obj => obj.id !== objectId)
 *   if (next.length === scene.objects.length) throw ObjectNotFoundError
 *   scene.objects = next
 *   return { project, removedObjectId: objectId }
 */

/**
 * COMMENTED CLASS-STYLE DESIGN SKETCH
 *
 * This is not a runtime implementation yet. It is meant to capture the shape of
 * a future lifecycle service that sits above the canonical project snapshot and
 * keeps mutation rules in one place.
 *
 * class ObjectLifecycleService {
 *   constructor(private readonly project: ProjectData) {}
 *
 *   createObject(sceneId: string, assetKind: AssetKind): ObjectOperationResult {
 *     const scene = this.requireScene(sceneId)
 *     const object = this.makeObject(assetKind)
 *     scene.objects.push(object)
 *     return { project: this.project, objectId: object.id }
 *   }
 *
 *   duplicateObject(sceneId: string, objectId: string): ObjectOperationResult {
 *     const source = this.requireObject(sceneId, objectId)
 *     const clone = structuredClone(source)
 *     clone.id = generateStableObjectId()
 *     clone.name = this.uniqueDuplicateName(source.name)
 *     this.requireScene(sceneId).objects.push(clone)
 *     return { project: this.project, objectId: clone.id }
 *   }
 *
 *   removeObject(sceneId: string, objectId: string): ObjectOperationResult {
 *     const scene = this.requireScene(sceneId)
 *     const index = scene.objects.findIndex(obj => obj.id === objectId)
 *     if (index < 0) throw new Error('Object not found')
 *     const [removed] = scene.objects.splice(index, 1)
 *     return { project: this.project, objectId: removed.id }
 *   }
 *
 *   setVisible(sceneId: string, objectId: string, visible: boolean): ProjectData {
 *     const object = this.requireObject(sceneId, objectId)
 *     object.visible = visible
 *     return this.project
 *   }
 *
 *   setEnabled(sceneId: string, objectId: string, enabled: boolean): ProjectData {
 *     const object = this.requireObject(sceneId, objectId)
 *     object.enabled = enabled
 *     return this.project
 *   }
 * }
 *
 * Why this shape is safer than a one-off singleton manager:
 * - it keeps state mutation policy close to the domain model;
 * - it can be pure, testable, and easily wrapped by commands/history;
 * - it avoids hidden global app state that can drift from the saved project;
 * - it can be replaced or extended without rewriting the full renderer stack.
 */