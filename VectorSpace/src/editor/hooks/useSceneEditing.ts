/**
 * @file        useSceneEditing.ts
 * @author      Sherman Goh Wee Hao (editor operations, scene and object edits),
 *              Chloe Lau Rey En (move/scale commits, interaction rules),
 *              Goh Pin Kai (rotate commit, environment and start view)
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       Every edit the editor makes to the active scene, as one undoable step each.
 *
 * @responsibility
 * Turns a UI gesture into an editorOperations/ruleEditorOperations call and sends the
 * result through commit (or runCommand for transforms): environment, start view, add,
 * transform, rename, asset id, delete, duplicate, reparent, indent/outdent, visible,
 * enabled, click rules and new scene.
 *
 * @inputs
 * The project, active scene and selection, plus commit, runCommand, setSelectedId and
 * the viewport handle (only captureStartView reads it).
 *
 * @outputs
 * One function per gesture; EditorPage hands them to the panels as props.
 *
 * @boundary
 * Undo/redo live in useEditorHistory. Nothing here saves; autosave reacts to the
 * project changing.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import type { RefObject } from 'react'
import { ProjectData, SceneData, SceneObject, makeScene } from '../../project/model'
import { AssetDefinition } from '../../content/assets'
import type { ViewportHandle } from '../../viewport/Viewport'
import {
  createEditorObject,
  createEditorScene,
  duplicateEditorObject,
  moveEditorObjectCommand,
  removeEditorObject,
  renameEditorObject,
  reparentEditorObject,
  rotateEditorObjectAboutPivotCommand,
  rotateEditorObjectCommand,
  scaleEditorObjectCommand,
  selectEditorScene,
  setEditorObjectAssetId,
  setEditorObjectEnabled,
  setEditorObjectVisible,
  transformEditorObjectCommand,
  updateEditorScene,
  type EditorCommandBuilder,
} from '../editorOperations'
import { addEditorClickRule, removeEditorRule, type ClickRuleChoice } from '../ruleEditorOperations'
import { grandparentId, previousSibling } from '../sceneTree'

type SceneEditingInputs = {
  project: ProjectData
  scene: SceneData
  selected: SceneObject | null
  setSelectedId: (id: string | null) => void
  commit: (label: string, next: ProjectData) => void
  runCommand: (build: EditorCommandBuilder) => unknown
  viewportRef: RefObject<ViewportHandle | null>
}

export function useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef }: SceneEditingInputs) {
  const setEnvironment = (environmentId: string) => {
    commit('Change environment', updateEditorScene(project, project.activeSceneId, { environmentId }).project)
  }
  const captureStartView = () => {
    const pose = viewportRef.current?.getCameraPose()
    if (!pose) return
    commit('Set start view', updateEditorScene(project, project.activeSceneId, { startCamera: pose }).project)
  }
  const addObject = (asset: AssetDefinition) => {
    const result = createEditorObject(project, scene.id, asset.kind, asset.assetId)
    commit('Create object', result.project)
    setSelectedId(result.objectId ?? null)
  }
  const updateSelected = (changes: Partial<SceneObject['transform']>) => {
    if (!selected) return
    const builder = transformEditorObjectCommand(scene.id, selected.id, changes)
    if (builder) runCommand(builder)
  }
  const moveObject = (id: string, position: [number, number, number]) => {
    runCommand(moveEditorObjectCommand(scene.id, id, position))
  }
  const scaleObject = (id: string, scale: [number, number, number]) => {
    runCommand(scaleEditorObjectCommand(scene.id, id, scale))
  }
  const rotateObject = (id: string, rotation: [number, number, number], position?: [number, number, number]) => {
    runCommand(position
      ? rotateEditorObjectAboutPivotCommand(scene.id, id, rotation, position)
      : rotateEditorObjectCommand(scene.id, id, rotation))
  }
  const renameSelected = (name: string) => {
    if (!selected) return
    commit('Rename object', renameEditorObject(project, scene.id, selected.id, name).project)
  }
  const setSelectedAssetId = (assetId: string) => {
    if (!selected) return
    commit('Change asset ID', setEditorObjectAssetId(project, scene.id, selected.id, assetId).project)
  }
  const deleteSelected = () => {
    if (!selected) return
    commit('Delete object', removeEditorObject(project, scene.id, selected.id).project)
    setSelectedId(null)
  }
  const duplicateSelected = () => {
    if (!selected) return
    const result = duplicateEditorObject(project, scene.id, selected.id)
    commit('Duplicate object', result.project)
    setSelectedId(result.objectId ?? null)
  }
  const reparentObjectTo = (objectId: string, parentId: string | null) => {
    commit('Reparent object', reparentEditorObject(project, scene.id, objectId, parentId).project)
  }
  const indentObject = (objectId: string) => {
    const target = previousSibling(scene.objects, objectId)
    if (target) reparentObjectTo(objectId, target.id)
  }
  const outdentObject = (objectId: string) => {
    const object = scene.objects.find((item) => item.id === objectId)
    if (object?.parentId === undefined) return
    reparentObjectTo(objectId, grandparentId(scene.objects, objectId))
  }
  const setSelectedVisible = (value: boolean) => {
    if (!selected) return
    commit('Set object visibility', setEditorObjectVisible(project, scene.id, selected.id, value).project)
  }

  // adds a "when clicked" rule with the chosen action to the selected object as one undoable step
  const addSelectedClickRule = (choice: ClickRuleChoice) => {
    if (!selected) return
    commit('Add interaction rule', addEditorClickRule(project, scene.id, selected.id, choice).project)
  }

  // removes one interaction rule by its id as one undoable step
  const removeRuleById = (ruleId: string) => {
    commit('Remove interaction rule', removeEditorRule(project, ruleId).project)
  }

  const setSelectedEnabled = (value: boolean) => {
    if (!selected) return
    commit('Set object enabled state', setEditorObjectEnabled(project, scene.id, selected.id, value).project)
  }
  // Adds a room (scene) with the id it is given and keeps you in the room you are in. The rooms
  // popup's "+" passes the id of a side (e.g. 'room-right'), which is how a room remembers where
  // it is. An id already in use does nothing. One commit, so one Undo takes the room away again.
  const addScene = (sceneId: string) => {
    if (project.scenes.some((item) => item.id === sceneId)) return
    const created = createEditorScene(project, makeScene(sceneId, `Room ${project.scenes.length + 1}`)).project
    commit('Create scene', selectEditorScene(created, project.activeSceneId).project)
  }

  return {
    setEnvironment, captureStartView, addObject, updateSelected, moveObject, scaleObject, rotateObject,
    renameSelected, setSelectedAssetId, deleteSelected, duplicateSelected, reparentObjectTo,
    indentObject, outdentObject, setSelectedVisible, addSelectedClickRule, removeRuleById,
    setSelectedEnabled, addScene,
  }
}
