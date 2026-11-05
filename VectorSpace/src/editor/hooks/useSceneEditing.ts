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
import { DEFAULT_ROOM_SURFACES } from '../../content/roomSurfaces'
import { ProjectData, type EnvironmentDefinition, type RoomSurfaces, type RoomCell, SceneData, SceneObject, makeScene } from '../../project/model'
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
  updateEditorTransform,
  type EditorCommandBuilder,
} from '../editorOperations'
import { addEditorClickRule, removeEditorRule, type ClickRuleChoice } from '../ruleEditorOperations'
import { grandparentId, previousSibling } from '../sceneTree'
import { freeCell, isAllowedCell, roomAt, roomCell } from '../roomLayout'
import { unlockNewObjects } from '../teacherTools'

type SceneEditingInputs = {
  project: ProjectData
  scene: SceneData
  selected: SceneObject | null
  setSelectedId: (id: string | null) => void
  commit: (label: string, next: ProjectData) => void
  runCommand: (build: EditorCommandBuilder) => unknown
  viewportRef: RefObject<ViewportHandle | null>
  // true for an object may not move, turn, resize, delete or re-parent; absent = nothing is locked
  isLocked?: (objectId: string) => boolean
  // called instead of the edit when it hits a locked object
  onLocked?: (object: SceneObject) => void
  // true for a object may turn and resize but not move; absent = nothing is pinned
  isPinned?: (objectId: string) => boolean
  // called instead of the move when it hits a pinned thing
  onPinned?: (object: SceneObject) => void
}

export function useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef, isLocked, onLocked, isPinned, onPinned }: SceneEditingInputs) {
  // refuses an edit to a locked object, and says so; true when the edit may go ahead
  const allowed = (objectId: string) => {
    if (!isLocked?.(objectId)) return true
    const object = scene.objects.find((item) => item.id === objectId)
    if (object) onLocked?.(object)
    return false
  }
  // refuses a move of a pinned thing, and says so; true when it may move
  const movable = (objectId: string) => {
    if (!isPinned?.(objectId)) return true
    const object = scene.objects.find((item) => item.id === objectId)
    if (object) onPinned?.(object)
    return false
  }
  const setEnvironment = (environmentId: string) => {
    commit('Change environment', updateEditorScene(project, project.activeSceneId, { environmentId }).project)
  }
  const captureStartView = () => {
    const pose = viewportRef.current?.getCameraPose()
    if (!pose) return
    commit('Set start view', updateEditorScene(project, project.activeSceneId, { startCamera: pose }).project)
  }
  const addObject = (asset: AssetDefinition, at?: [number, number, number], replaceId?: string) => {
    const start = replaceId && allowed(replaceId) ? removeEditorObject(project, scene.id, replaceId).project : project
    const result = createEditorObject(start, scene.id, asset.kind, asset.assetId)
    let next = result.project
    const made = result.objectId ? next.scenes.find((item) => item.id === scene.id)?.objects.find((item) => item.id === result.objectId) : undefined
    if (at && made) {
      next = updateEditorTransform(next, scene.id, made.id, { position: [at[0], made.transform.position[1], at[2]] }).project
    }
    commit(replaceId ? 'Swap object' : 'Create object', next)
    setSelectedId(result.objectId ?? null)
  }
  const updateSelected = (changes: Partial<SceneObject['transform']>) => {
    if (!selected || !allowed(selected.id)) return
    // a pinned thing keeps its place: drop a position change, keep the rest
    if (changes.position && !movable(selected.id)) {
      const { position: _kept, ...rest } = changes
      changes = rest
      if (Object.keys(changes).length === 0) return
    }
    const builder = transformEditorObjectCommand(scene.id, selected.id, changes)
    if (builder) runCommand(builder)
  }
  const moveObject = (id: string, position: [number, number, number]) => {
    if (!allowed(id) || !movable(id)) return
    runCommand(moveEditorObjectCommand(scene.id, id, position))
  }
  const scaleObject = (id: string, scale: [number, number, number]) => {
    if (!allowed(id)) return
    runCommand(scaleEditorObjectCommand(scene.id, id, scale))
  }
  const rotateObject = (id: string, rotation: [number, number, number], position?: [number, number, number]) => {
    if (!allowed(id)) return
    // turning about an off-centre pivot would shift a pinned thing, so it turns in place
    runCommand(position && !isPinned?.(id)
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
    if (!selected || !allowed(selected.id)) return
    commit('Delete object', removeEditorObject(project, scene.id, selected.id).project)
    setSelectedId(null)
  }
  const duplicateSelected = () => {
    if (!selected) return
    const result = duplicateEditorObject(project, scene.id, selected.id)
    // a copy of a locked thing is the copier's own, so it comes out unlocked
    commit('Duplicate object', unlockNewObjects(project, result.project, scene.id))
    setSelectedId(result.objectId ?? null)
  }
  const reparentObjectTo = (objectId: string, parentId: string | null) => {
    if (!allowed(objectId)) return
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

  // Adds a room of the selected environment in an empty cell of the rooms map (one of the
  // five allowed cells)
  const addScene = (cell: RoomCell, environment: EnvironmentDefinition) => {
    // after a delete, scenes.length + 1 can name a scene that still exists, so skip taken ids
    let number = project.scenes.length + 1
    while (project.scenes.some((item) => item.id === `scene-${number}`)) number += 1
    // pin the first room where the map shows it, so adding at the origin can't move it
    const base = project.scenes[0] ? withStoredCell(project, project.scenes[0]) : project
    if (!isAllowedCell(cell) || roomAt(base, cell)) return
    const room = { ...makeScene(`scene-${number}`, environment.name), environmentId: environment.id, layout: cell }
    // createScene makes the new scene active; switch back in the same undo step
    commit('Create scene', selectEditorScene(createEditorScene(base, room).project, scene.id).project)
  }
  const renameScene = (sceneId: string, name: string) => {
    const trimmed = name.trim()
    const current = project.scenes.find((item) => item.id === sceneId)
    if (!trimmed || !current || current.name === trimmed) return
    commit('Rename scene', updateEditorScene(project, sceneId, { name: trimmed }).project)
  }
  // Changes a room's wall and/or floor style (from "Your rooms"); the other one keeps its style.
  const setSceneSurfaces = (sceneId: string, change: Partial<RoomSurfaces>) => {
    const current = project.scenes.find((item) => item.id === sceneId)
    if (!current) return
    const surfaces: RoomSurfaces = { ...DEFAULT_ROOM_SURFACES, ...current.surfaces, ...change }
    commit('Change room style', updateEditorScene(project, sceneId, { surfaces }).project)
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
    setSelectedEnabled, addScene, removeScene, moveSceneInOrder, renameScene, setSceneSurfaces,
  }
}
