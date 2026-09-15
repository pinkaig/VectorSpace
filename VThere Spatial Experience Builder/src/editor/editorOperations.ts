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
  createObject,
  createScene,
  duplicateObject,
  removeObject,
  renameObject,
  setActiveScene,
  setObjectEnabled,
  setObjectVisible,
  updateObjectTransform,
  updateScene,
  type ObjectOperationResult,
} from '@vthere/authoring-engine'
import type { AssetKind, ProjectData, SceneObject } from '../model'

export const createObjectIdFactory = () => ({
  nextId: (_project: ProjectData, sceneId: string) => `${sceneId}-object-${crypto.randomUUID()}`,
})

export const createEditorObject = (project: ProjectData, sceneId: string, assetKind: AssetKind): ObjectOperationResult =>
  createObject(project, { sceneId, assetKind }, createObjectIdFactory())

export const duplicateEditorObject = (project: ProjectData, sceneId: string, objectId: string): ObjectOperationResult =>
  duplicateObject(project, { sceneId, objectId }, createObjectIdFactory())

export const removeEditorObject = (project: ProjectData, sceneId: string, objectId: string): ObjectOperationResult =>
  removeObject(project, { sceneId, objectId })

export const updateEditorTransform = (
  project: ProjectData,
  sceneId: string,
  objectId: string,
  changes: Partial<SceneObject['transform']>,
): ObjectOperationResult => updateObjectTransform(project, { sceneId, objectId, changes })

export const renameEditorObject = (project: ProjectData, sceneId: string, objectId: string, name: string): ObjectOperationResult =>
  renameObject(project, { sceneId, objectId, name })

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
