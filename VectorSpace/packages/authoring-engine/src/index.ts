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
 * attachment operations (add, remove, update, reorder — host-addressed),
 * scene operations, commit, undo, and redo, plus the re-exported command path
 * (executeCommand, transform commands, and the shared object access helpers).
 *
 * @boundary
 * This file is the package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports such as
 * `@vectorspace/authoring-engine/commands` do not resolve. Anything consumers need
 * must be re-exported here.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 */
import {
  AssetKind,
  Attachment,
  AudioAttachment,
  InteractionRule,
  ProjectData,
  SceneObject,
  TextAttachment,
  TextPresentation,
  ZoneDefinition,
  cloneProject,
  makeObject,
} from '@vectorspace/project'
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
export * from './ruleOperations'
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
  // attachment ids share one project-wide id space (objects and zones alike),
  // so they come from the same injected factory as object ids
  nextAttachmentId: (project: ProjectData, sceneId: string) => string
}

export interface CreateObjectInput {
  sceneId: string
  assetKind: AssetKind
  name?: string
  // Overrides the default `primitive-${assetKind}` id makeObject() would otherwise assign —
  // required for a `model` asset, where assetId identifies which GLB source to load.
  assetId?: string
}

export interface ObjectOperationResult {
  project: ProjectData
  objectId?: string
  removedObject?: SceneObject
  originalIndex?: number
  removedRules?: InteractionRule[]
  attachmentId?: string
  removedAttachment?: Attachment
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
  const object = makeObject(input.assetKind, scene.objects.length, input.assetId)
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
    if (item.attachments !== undefined) {
      // the { ...item } spread shares the attachments array by reference and
      // would collide ids project-wide; every copy needs its own records
      copy.attachments = item.attachments.map((attachment) => ({
        ...cloneValue(attachment),
        id: idFactory.nextAttachmentId(next, input.sceneId),
      }))
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
  // a rule referencing a removed object would fail validateRules on the next
  // load, so it must be dropped alongside the object it targets
  let removedRules: InteractionRule[] | undefined
  if (Array.isArray(next.rules)) {
    removedRules = next.rules.filter((rule) => rule.objectId !== undefined && subtreeIds.has(rule.objectId))
    if (removedRules.length > 0) {
      next.rules = next.rules.filter((rule) => !(rule.objectId !== undefined && subtreeIds.has(rule.objectId)))
    } else {
      removedRules = undefined
    }
  }
  return {
    project: next,
    removedObject: object,
    originalIndex: index,
    removedRules,
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
      // never share an attachments array with the caller's scene value
      ...(object.attachments === undefined ? {} : { attachments: cloneValue(object.attachments) }),
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

// ---- attachment operations -------------------------------------------------
// An attachment lives on its host (SceneObject or ZoneDefinition), so these
// ops address a host rather than duplicating four functions per host type.
// See https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Attachment-Integration section 4.
// Links point at the project wiki; migration is still in progress.

export interface AttachmentHost {
  kind: 'object' | 'zone'
  id: string
}

/** An attachment before it has an id — the factory assigns one on add. */
export type AttachmentDraft = Omit<AudioAttachment, 'id'> | Omit<TextAttachment, 'id'>

export interface AddAttachmentInput {
  sceneId: string
  host: AttachmentHost
  attachment: AttachmentDraft
}

export interface AttachmentTargetInput {
  sceneId: string
  host: AttachmentHost
  attachmentId: string
}

export interface UpdateAttachmentInput extends AttachmentTargetInput {
  // id and kind are immutable; presentation applies to text attachments only
  changes: { name?: string; assetId?: string; presentation?: TextPresentation }
}

export interface ReorderAttachmentsInput {
  sceneId: string
  host: AttachmentHost
  orderedIds: string[]
}

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const requireHost = (project: ProjectData, sceneId: string, host: AttachmentHost): SceneObject | ZoneDefinition => {
  const scene = requireScene(project, sceneId)
  if (host.kind === 'object') {
    const object = scene.objects.find((item) => item.id === host.id)
    if (!object) throw new ObjectOperationError(`Object "${host.id}" was not found`)
    return object
  }
  const zone = scene.zones?.find((item) => item.id === host.id)
  if (!zone) throw new ObjectOperationError(`Zone "${host.id}" was not found`)
  return zone
}

const requireAttachment = (record: SceneObject | ZoneDefinition, attachmentId: string): { list: Attachment[]; index: number } => {
  const list = record.attachments ?? []
  const index = list.findIndex((item) => item.id === attachmentId)
  if (index < 0) throw new ObjectOperationError(`Attachment "${attachmentId}" was not found`)
  return { list, index }
}

export const addAttachment = (
  project: ProjectData,
  input: AddAttachmentInput,
  idFactory: ObjectIdFactory,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const record = requireHost(next, input.sceneId, input.host)
  const attachment = { ...cloneValue(input.attachment), id: idFactory.nextAttachmentId(next, input.sceneId) } as Attachment
  record.attachments = [...(record.attachments ?? []), attachment]
  return { project: next, attachmentId: attachment.id }
}

export const removeAttachment = (
  project: ProjectData,
  input: AttachmentTargetInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const record = requireHost(next, input.sceneId, input.host)
  const { list, index } = requireAttachment(record, input.attachmentId)
  const [removed] = list.splice(index, 1)
  // back to "absent when none", so an untouched-looking host serialises small
  if (list.length === 0) delete record.attachments
  return { project: next, removedAttachment: removed }
}

export const updateAttachment = (
  project: ProjectData,
  input: UpdateAttachmentInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const record = requireHost(next, input.sceneId, input.host)
  const { list, index } = requireAttachment(record, input.attachmentId)
  const attachment = list[index]
  if (input.changes.name !== undefined) attachment.name = input.changes.name
  if (input.changes.assetId !== undefined) attachment.assetId = input.changes.assetId
  if (input.changes.presentation !== undefined) {
    if (attachment.kind !== 'text') throw new ObjectOperationError(`Attachment "${attachment.id}" is not a text attachment and has no presentation`)
    attachment.presentation = cloneValue(input.changes.presentation)
  }
  return { project: next, attachmentId: attachment.id }
}

export const reorderAttachments = (
  project: ProjectData,
  input: ReorderAttachmentsInput,
): ObjectOperationResult => {
  const next = cloneProject(project)
  const record = requireHost(next, input.sceneId, input.host)
  const list = record.attachments ?? []
  const byId = new Map(list.map((item) => [item.id, item]))
  if (input.orderedIds.length !== list.length || new Set(input.orderedIds).size !== input.orderedIds.length || !input.orderedIds.every((id) => byId.has(id))) {
    throw new ObjectOperationError('reorderAttachments requires a permutation of the host\'s attachment ids')
  }
  record.attachments = input.orderedIds.map((id) => byId.get(id) as Attachment)
  return { project: next }
}