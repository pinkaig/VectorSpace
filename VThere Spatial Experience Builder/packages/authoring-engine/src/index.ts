/**
 * @file        index.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Renderer-independent command timeline for editor history.
 *
 * @responsibility
 * Stores immutable past and future snapshots and provides commit, undo, and
 * redo operations without depending on React, Three.js, or persistence.
 *
 * @inputs
 * Generic state values, a clone function, labels, and a history limit.
 *
 * @outputs
 * CommandTimeline snapshots with current state and undo/redo capabilities.
 *
 * @members
 * HistoryEntry, CommandTimeline, createCommandTimeline, object operations
 * (create, duplicate, remove, reparent, transform, rename, visible, enabled),
 * scene operations, commit, undo, and redo, plus the re-exported command path
 * (executeCommand, transform commands, and the shared object access helpers).
 *
 * @boundary
 * This file is the package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports such as
 * `@vthere/authoring-engine/commands` do not resolve. Anything consumers need
 * must be re-exported here.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/authoring-engine.md
 */
import {
  AssetKind,
  ProjectData,
  SceneObject,
  cloneProject,
  makeObject,
} from '@vthere/project'
import {
  ObjectOperationError,
  ObjectTargetInput,
  collectSubtreeIds,
  requireObject,
  requireScene,
} from './objectAccess'
import { composeWorldTransform, localTransformForNewParent, type WorldTransform } from './transformMath'

const identityWorldTransform: WorldTransform = {
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
}

export { ObjectOperationError, collectSubtreeIds, requireObject, requireScene } from './objectAccess'
export type { ObjectTargetInput } from './objectAccess'
export * from './commands/types'
export * from './commands/transformCommands'
export * from './commands/commandService'
export { composeWorldTransform, localTransformForNewParent } from './transformMath'
export type { Quaternion, Vector3, WorldTransform } from './transformMath'

export interface HistoryEntry<T> {
  label: string
  state: T
}

export interface CommandTimeline<T> {
  readonly current: T
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly past: readonly HistoryEntry<T>[]
  readonly future: readonly HistoryEntry<T>[]
  commit(label: string, state: T): CommandTimeline<T>
  undo(): CommandTimeline<T>
  redo(): CommandTimeline<T>
}

export const createCommandTimeline = <T>(
  initialState: T,
  clone: (state: T) => T,
  limit = 40,
): CommandTimeline<T> => {
  const past: HistoryEntry<T>[] = []
  const future: HistoryEntry<T>[] = []
  let current = clone(initialState)

  const timeline: CommandTimeline<T> = {
    get current() { return clone(current) },
    get canUndo() { return past.length > 0 },
    get canRedo() { return future.length > 0 },
    get past() { return past.map((entry) => ({ ...entry, state: clone(entry.state) })) },
    get future() { return future.map((entry) => ({ ...entry, state: clone(entry.state) })) },
    commit(label, state) {
      past.push({ label, state: clone(current) })
      if (past.length > limit) past.shift()
      future.length = 0
      current = clone(state)
      return timeline
    },
    undo() {
      const entry = past.pop()
      if (!entry) return timeline
      future.push({ label: entry.label, state: clone(current) })
      current = clone(entry.state)
      return timeline
    },
    redo() {
      const entry = future.pop()
      if (!entry) return timeline
      past.push({ label: entry.label, state: clone(current) })
      current = clone(entry.state)
      return timeline
    },
  }

  return timeline
}

export interface ObjectIdFactory {
  nextId: (project: ProjectData, sceneId: string) => string
}

export interface CreateObjectInput {
  sceneId: string
  assetKind: AssetKind
  name?: string
}

export interface ObjectOperationResult {
  project: ProjectData
  objectId?: string
  removedObject?: SceneObject
  originalIndex?: number
}

export interface UpdateObjectInput extends ObjectTargetInput {
  changes: Partial<SceneObject['transform']>
}

export interface RenameObjectInput extends ObjectTargetInput {
  name: string
}

export interface SetObjectAssetIdInput extends ObjectTargetInput {
  assetId: string
}

export interface ObjectFlagInput extends ObjectTargetInput {
  value: boolean
}

export interface ReparentObjectInput extends ObjectTargetInput {
  /** New parent object ID, or null to make the object top-level. */
  parentId: string | null
}

export interface SceneUpdateInput {
  sceneId: string
}

export const createObject = (
  project: ProjectData,
  input: CreateObjectInput,
  idFactory: ObjectIdFactory,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const scene = requireScene(next, input.sceneId)
  const object = makeObject(input.assetKind, scene.objects.length)
  object.id = idFactory.nextId(next, input.sceneId)
  if (input.name) object.name = input.name
  scene.objects.push(object)
  return { project: next, objectId: object.id }
}

export const duplicateObject = (
  project: ProjectData,
  input: ObjectTargetInput,
  idFactory: ObjectIdFactory,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { scene, object } = requireObject(next, input)
  const subtreeIds = collectSubtreeIds(scene.objects, object.id)
  const idMap = new Map<string, string>()
  for (const item of scene.objects) {
    if (subtreeIds.has(item.id)) idMap.set(item.id, idFactory.nextId(next, input.sceneId))
  }
  const copies: SceneObject[] = []
  for (const item of scene.objects) {
    if (!subtreeIds.has(item.id)) continue
    const copy: SceneObject = {
      ...item,
      id: idMap.get(item.id) as string,
      transform: {
        position: [...item.transform.position],
        rotation: [...item.transform.rotation],
        scale: [...item.transform.scale],
      },
    }
    if (item.id === object.id) {
      // the copied root sits beside the original, under the same parent
      copy.name = `${item.name} Copy`
    } else if (item.parentId !== undefined) {
      // descendants follow their copied parent, not the original one
      copy.parentId = idMap.get(item.parentId) ?? item.parentId
    }
    copies.push(copy)
  }
  scene.objects.push(...copies)
  return { project: next, objectId: idMap.get(object.id) }
}

export const removeObject = (
  project: ProjectData,
  input: ObjectTargetInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { scene, object, index } = requireObject(next, input)
  // removing an object removes its whole subtree so no child is left orphaned
  const subtreeIds = collectSubtreeIds(scene.objects, object.id)
  scene.objects = scene.objects.filter((item) => !subtreeIds.has(item.id))
  return {
    project: next,
    removedObject: object,
    originalIndex: index,
  }
}

export const reparentObject = (
  project: ProjectData,
  input: ReparentObjectInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { scene, object } = requireObject(next, input)
  // Composed from the hierarchy as it stands before the move, so the object's
  // world pose is preserved by recomputing its local transform below.
  const childWorld = composeWorldTransform(scene.objects, object.id)
  if (input.parentId === null) {
    delete object.parentId
    object.transform = localTransformForNewParent(childWorld, identityWorldTransform)
    return { project: next, objectId: object.id }
  }
  if (input.parentId === object.id) throw new ObjectOperationError(`Object "${object.id}" cannot be its own parent`)
  const parent = scene.objects.find((item) => item.id === input.parentId)
  if (!parent) throw new ObjectOperationError(`Parent object "${input.parentId}" was not found`)
  // walking up from the new parent must never reach the object being moved,
  // otherwise the hierarchy would contain a cycle
  let ancestor: SceneObject | undefined = parent
  while (ancestor) {
    if (ancestor.id === object.id) throw new ObjectOperationError(`Parenting "${object.id}" under "${input.parentId}" would create a cycle`)
    const parentId: string | undefined = ancestor.parentId
    ancestor = parentId === undefined ? undefined : scene.objects.find((item) => item.id === parentId)
  }
  const newParentWorld = composeWorldTransform(scene.objects, input.parentId)
  object.transform = localTransformForNewParent(childWorld, newParentWorld)
  object.parentId = input.parentId
  return { project: next, objectId: object.id }
}

export const updateObjectTransform = (
  project: ProjectData,
  input: UpdateObjectInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { object } = requireObject(next, input)
  object.transform = { ...object.transform, ...input.changes }
  return { project: next, objectId: object.id }
}

export const renameObject = (
  project: ProjectData,
  input: RenameObjectInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { object } = requireObject(next, input)
  object.name = input.name
  return { project: next, objectId: object.id }
}

export const setObjectAssetId = (
  project: ProjectData,
  input: SetObjectAssetIdInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { object } = requireObject(next, input)
  object.assetId = input.assetId
  return { project: next, objectId: object.id }
}

export const setObjectVisible = (project: ProjectData, input: ObjectFlagInput): ObjectOperationResult => {
  const next = cloneProject(project)
  const { object } = requireObject(next, input)
  object.visible = input.value
  return { project: next, objectId: object.id }
}

export const setObjectEnabled = (project: ProjectData, input: ObjectFlagInput): ObjectOperationResult => {
  const next = cloneProject(project)
  const { object } = requireObject(next, input)
  object.enabled = input.value
  return { project: next, objectId: object.id }
}

export const updateScene = (
  project: ProjectData,
  input: SceneUpdateInput,
  changes: Partial<Pick<ProjectData['scenes'][number], 'name' | 'environmentId' | 'startCamera'>>,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const scene = requireScene(next, input.sceneId)
  Object.assign(scene, changes)
  return { project: next }
}

export const createScene = (
  project: ProjectData,
  scene: ProjectData['scenes'][number],
): ObjectOperationResult => {
  const next = cloneProject(project)
  if (next.scenes.some((item) => item.id === scene.id)) {
    throw new ObjectOperationError(`Scene "${scene.id}" already exists`)
  }
  next.scenes.push({
    ...scene,
    objects: scene.objects.map((object) => ({
      ...object,
      transform: {
        position: [...object.transform.position],
        rotation: [...object.transform.rotation],
        scale: [...object.transform.scale],
      },
    })),
  })
  next.activeSceneId = scene.id
  return { project: next }
}

export const setActiveScene = (
  project: ProjectData,
  sceneId: string,
): ObjectOperationResult => {
  const next = cloneProject(project)
  requireScene(next, sceneId)
  next.activeSceneId = sceneId
  return { project: next }
}