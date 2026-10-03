/**
 * @file        editorOperations.ts
 * @brief       Thin editor-policy adapters over the authoring engine.
 *
 * @responsibility
 * Supplies browser ID generation and editor-oriented operation names while
 * delegating immutable project transitions to @vthere/authoring-engine.
 *
 * @inputs
 * ProjectData snapshots, editor scene/object identifiers, asset kinds, and
 * inspector or viewport changes.
 *
 * @outputs
 * ObjectOperationResult values containing new immutable project snapshots.
 *
 * @boundary
 * This file must not become a second command engine, project store, renderer
 * cache, or persistence layer. Remove forwarding wrappers if no editor policy
 * remains beyond direct delegation.
 *
 * @documentation
 * Authoring boundary: docs/05-subsystems/authoring-engine.md
 */
import {
  createMoveCommand,
  createObject,
  createRotateAboutPivotCommand,
  createRotateCommand,
  createScaleCommand,
  createScene,
  duplicateObject,
  removeObject,
  renameObject,
  reparentObject,
  setActiveScene,
  setObjectAssetId,
  setObjectEnabled,
  setObjectVisible,
  updateObjectTransform,
  updateScene,
  type ObjectOperationResult,
  type ProjectCommand,
  type Vector3Tuple,
} from '@vthere/authoring-engine'
import type { AssetKind, ProjectData, SceneObject } from '../model'

/**
 * A builder rather than a finished command: the command service calls it with
 * live timeline state, so the captured undo value can never come from a stale
 * React closure. See commandService.executeCommand.
 */
export type EditorCommandBuilder = (project: ProjectData) => ProjectCommand

export const createObjectIdFactory = () => ({
  nextId: (_project: ProjectData, sceneId: string) => `${sceneId}-object-${crypto.randomUUID()}`,
  nextAttachmentId: (_project: ProjectData, sceneId: string) => `${sceneId}-attachment-${crypto.randomUUID()}`,
})

export const createEditorObject = (project: ProjectData, sceneId: string, assetKind: AssetKind, assetId?: string): ObjectOperationResult =>
  createObject(project, { sceneId, assetKind, assetId }, createObjectIdFactory())

export const duplicateEditorObject = (project: ProjectData, sceneId: string, objectId: string): ObjectOperationResult =>
  duplicateObject(project, { sceneId, objectId }, createObjectIdFactory())

export const removeEditorObject = (project: ProjectData, sceneId: string, objectId: string): ObjectOperationResult =>
  removeObject(project, { sceneId, objectId })

/** `parentId: null` detaches the object to top-level. Cycle/self-parent checks live in reparentObject. */
export const reparentEditorObject = (
  project: ProjectData,
  sceneId: string,
  objectId: string,
  parentId: string | null,
): ObjectOperationResult => reparentObject(project, { sceneId, objectId, parentId })

export const updateEditorTransform = (
  project: ProjectData,
  sceneId: string,
  objectId: string,
  changes: Partial<SceneObject['transform']>,
): ObjectOperationResult => updateObjectTransform(project, { sceneId, objectId, changes })

export const moveEditorObjectCommand = (sceneId: string, objectId: string, position: Vector3Tuple): EditorCommandBuilder =>
  (project) => createMoveCommand(project, { sceneId, objectId }, position)

export const rotateEditorObjectCommand = (sceneId: string, objectId: string, rotation: Vector3Tuple): EditorCommandBuilder =>
  (project) => createRotateCommand(project, { sceneId, objectId }, rotation)

export const rotateEditorObjectAboutPivotCommand = (
  sceneId: string,
  objectId: string,
  rotation: Vector3Tuple,
  position: Vector3Tuple,
): EditorCommandBuilder =>
  (project) => createRotateAboutPivotCommand(project, { sceneId, objectId }, rotation, position)

export const scaleEditorObjectCommand = (sceneId: string, objectId: string, scale: Vector3Tuple): EditorCommandBuilder =>
  (project) => createScaleCommand(project, { sceneId, objectId }, scale)

/**
 * The Inspector edits one transform channel at a time, so an inspector change is
 * routed to the matching transform command rather than to a generic partial
 * update. This is what makes a cleared numeric field a rejected edit instead of
 * a NaN written into the project.
 */
export const transformEditorObjectCommand = (
  sceneId: string,
  objectId: string,
  changes: Partial<SceneObject['transform']>,
): EditorCommandBuilder | null => {
  if (changes.position) return moveEditorObjectCommand(sceneId, objectId, changes.position)
  if (changes.rotation) return rotateEditorObjectCommand(sceneId, objectId, changes.rotation)
  if (changes.scale) return scaleEditorObjectCommand(sceneId, objectId, changes.scale)
  return null
}

export const renameEditorObject = (project: ProjectData, sceneId: string, objectId: string, name: string): ObjectOperationResult =>
  renameObject(project, { sceneId, objectId, name })

export const setEditorObjectAssetId = (project: ProjectData, sceneId: string, objectId: string, assetId: string): ObjectOperationResult =>
  setObjectAssetId(project, { sceneId, objectId, assetId })

export const setEditorObjectVisible = (project: ProjectData, sceneId: string, objectId: string, value: boolean): ObjectOperationResult =>
  setObjectVisible(project, { sceneId, objectId, value })

export const setEditorObjectEnabled = (project: ProjectData, sceneId: string, objectId: string, value: boolean): ObjectOperationResult =>
  setObjectEnabled(project, { sceneId, objectId, value })

export const updateEditorScene = (
  project: ProjectData,
  sceneId: string,
  changes: Partial<Pick<ProjectData['scenes'][number], 'name' | 'environmentId' | 'startCamera'>>,
): ObjectOperationResult => updateScene(project, { sceneId }, changes)

export const selectEditorScene = (project: ProjectData, sceneId: string): ObjectOperationResult =>
  setActiveScene(project, sceneId)

export const createEditorScene = (project: ProjectData, scene: ProjectData['scenes'][number]): ObjectOperationResult =>
  createScene(project, scene)
