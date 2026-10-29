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
import { ProjectData, type RoomCell, SceneData, SceneObject, makeScene } from '../../project/model'
import { AssetDefinition } from '../../content/assets'
import type { ViewportHandle } from '../../viewport/Viewport'
import {
  createEditorObject,
  createEditorScene,
  duplicateEditorObject,
  moveEditorObjectCommand,
  removeEditorObject,
  removeEditorScene,
  moveEditorScene,
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
import { freeCell, isAllowedCell, roomAt, roomCell } from '../roomLayout'

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
  // Rooms from before the map existed have no stored cell: store the one roomCell infers
  // (or a free one), so it stays put; part of the caller's undo step.
  const withStoredCell = (from: ProjectData, room: SceneData): ProjectData =>
    room.layout ? from : updateEditorScene(from, room.id, { layout: roomCell(from, room) ?? freeCell(from) }).project

  // Adds a room in an empty cell of the rooms map (one of the five allowed cells).
  // Stays in the current room; the new one shows up where the "+" was.
  const addScene = (cell: RoomCell) => {
    // after a delete, scenes.length + 1 can name a scene that still exists, so skip taken ids
    let number = project.scenes.length + 1
    while (project.scenes.some((item) => item.id === `scene-${number}`)) number += 1
    // pin the first room where the map shows it, so adding at the origin can't move it
    const base = project.scenes[0] ? withStoredCell(project, project.scenes[0]) : project
    if (!isAllowedCell(cell) || roomAt(base, cell)) return
    const room = { ...makeScene(`scene-${number}`, `Room ${project.scenes.length + 1}`), layout: cell }
    // createScene makes the new scene active; switch back in the same undo step
    commit('Create scene', selectEditorScene(createEditorScene(base, room).project, scene.id).project)
  }
  const renameScene = (sceneId: string, name: string) => {
    const trimmed = name.trim()
    const current = project.scenes.find((item) => item.id === sceneId)
    if (!trimmed || !current || current.name === trimmed) return
    commit('Rename scene', updateEditorScene(project, sceneId, { name: trimmed }).project)
  }
  // Moves a room earlier (-1) or later (+1) in the visit order.
  const moveSceneInOrder = (sceneId: string, step: -1 | 1) => {
    const index = project.scenes.findIndex((item) => item.id === sceneId)
    const target = index + step
    if (index < 0 || target < 0 || target >= project.scenes.length) return
    // the first room's origin cell is implicit until stored, so store it before it can move
    const base = withStoredCell(project, project.scenes[0])
    commit('Reorder scenes', moveEditorScene(base, sceneId, target).project)
  }
  const removeScene = (sceneId: string) => {
    if (project.scenes.length === 1) return
    commit('Delete scene', removeEditorScene(project, sceneId).project)
    setSelectedId(null)
  }

  return {
    setEnvironment, captureStartView, addObject, updateSelected, moveObject, scaleObject, rotateObject,
    renameSelected, setSelectedAssetId, deleteSelected, duplicateSelected, reparentObjectTo,
    indentObject, outdentObject, setSelectedVisible, addSelectedClickRule, removeRuleById,
    setSelectedEnabled, addScene, removeScene, moveSceneInOrder, renameScene,
  }
}
