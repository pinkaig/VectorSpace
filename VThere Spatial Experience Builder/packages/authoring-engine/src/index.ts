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
 * HistoryEntry, CommandTimeline, createCommandTimeline, object operations,
 * commit, undo, and redo.
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

export interface ObjectTargetInput {
  sceneId: string
  objectId: string
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

export interface ObjectFlagInput extends ObjectTargetInput {
  value: boolean
}

export interface SceneUpdateInput {
  sceneId: string
}

export class ObjectOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ObjectOperationError'
  }
}

const requireScene = (project: ProjectData, sceneId: string) => {
  const scene = project.scenes.find((item) => item.id === sceneId)
  if (!scene) throw new ObjectOperationError(`Scene "${sceneId}" was not found`)
  return scene
}

const requireObject = (project: ProjectData, input: ObjectTargetInput) => {
  const scene = requireScene(project, input.sceneId)
  const index = scene.objects.findIndex((item) => item.id === input.objectId)
  if (index < 0) throw new ObjectOperationError(`Object "${input.objectId}" was not found`)
  return { scene, object: scene.objects[index], index }
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
  const copy: SceneObject = {
    ...object,
    id: idFactory.nextId(next, input.sceneId),
    name: `${object.name} Copy`,
    transform: {
      position: [...object.transform.position],
      rotation: [...object.transform.rotation],
      scale: [...object.transform.scale],
    },
  }
  scene.objects.push(copy)
  return { project: next, objectId: copy.id }
}

export const removeObject = (
  project: ProjectData,
  input: ObjectTargetInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const { scene, object, index } = requireObject(next, input)
  scene.objects.splice(index, 1)
  return {
    project: next,
    removedObject: object,
    originalIndex: index,
  }
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