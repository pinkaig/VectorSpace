/**
 * @file        teacherTools.ts
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       The teacher's room tools on template setup: suggest a spot (a numbered pin on the
 *              floor with a short note), lock things (students can't move or delete them),
 *              add a starter object (every student's copy starts with it, locked) and remove a
 *              spot or a thing the teacher changed their mind about. Plain project
 *              edits, so they are saved with the template and copied to each student with it.
 *              Also the viewport markers for spots and locks, shared with the student editor.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ProjectData, SceneData, SceneObject, SuggestedSpot } from '../project/model'
import type { SceneMarker } from '../viewport/editing/sceneMarkers'
import { createEditorObject, removeEditorObject } from './editorOperations'

export const DEFAULT_SPOT_TEXT = 'Put an exhibit here'
export const SPOT_TEXT_MAX = 60

const round = (value: number) => Math.round(value * 100) / 100

const setSpots = (project: ProjectData, sceneId: string, change: (spots: SuggestedSpot[]) => SuggestedSpot[]): ProjectData => ({
  ...project,
  scenes: project.scenes.map((scene) => (scene.id === sceneId ? { ...scene, spots: change(scene.spots ?? []) } : scene)),
})

const mapObjects = (project: ProjectData, sceneId: string, change: (object: SceneObject) => SceneObject): ProjectData => ({
  ...project,
  scenes: project.scenes.map((scene) => (scene.id === sceneId ? { ...scene, objects: scene.objects.map(change) } : scene)),
})

/** SUGGEST A SPOT: a new numbered spot where the floor was clicked. */
export const addSpot = (project: ProjectData, sceneId: string, point: [number, number, number], text = DEFAULT_SPOT_TEXT): { project: ProjectData; spotId: string } => {
  const spot: SuggestedSpot = { id: `spot-${crypto.randomUUID()}`, position: [round(point[0]), 0, round(point[2])], text }
  return { project: setSpots(project, sceneId, (spots) => [...spots, spot]), spotId: spot.id }
}

export const setSpotText = (project: ProjectData, sceneId: string, spotId: string, text: string): ProjectData =>
  setSpots(project, sceneId, (spots) => spots.map((spot) => (spot.id === spotId ? { ...spot, text: text.slice(0, SPOT_TEXT_MAX) } : spot)))

/** Removes a spot; the ones after it move up a number. */
export const removeSpot = (project: ProjectData, sceneId: string, spotId: string): ProjectData =>
  setSpots(project, sceneId, (spots) => spots.filter((spot) => spot.id !== spotId))

// how close to a spot's centre a floor click counts as clicking that spot (its ring is 0.6 wide)
const SPOT_HIT_RADIUS = 0.8

/** The spot whose ring a floor click landed in, or null. The nearest wins when rings overlap. */
export const spotAt = (scene: SceneData, point: [number, number, number]): SuggestedSpot | null => {
  let best: SuggestedSpot | null = null
  let bestDistance = SPOT_HIT_RADIUS
  for (const spot of scene.spots ?? []) {
    const distance = Math.hypot(spot.position[0] - point[0], spot.position[2] - point[2])
    if (distance <= bestDistance) {
      best = spot
      bestDistance = distance
    }
  }
  return best
}

/** REMOVE: takes a thing out of the room, with anything parented to it and their reactions. */
export const removeThing = (project: ProjectData, sceneId: string, objectId: string): ProjectData =>
  removeEditorObject(project, sceneId, objectId).project

/**
 * A copy is never locked: it's the copier's own, not the teacher's, even when made from a locked
 * thing. Unlocks every object in `after` that wasn't in `before` (a copy brings its children too).
 */
export const unlockNewObjects = (before: ProjectData, after: ProjectData, sceneId: string): ProjectData => {
  const existing = new Set(before.scenes.find((scene) => scene.id === sceneId)?.objects.map((object) => object.id))
  return mapObjects(after, sceneId, (object) => {
    if (existing.has(object.id) || !object.locked) return object
    const { locked: _copied, ...rest } = object
    return rest
  })
}

/** LOCK THINGS: flips one object's lock. An unlocked object drops the field, keeping files small. */
export const toggleLock = (project: ProjectData, sceneId: string, objectId: string): ProjectData =>
  mapObjects(project, sceneId, (object) => {
    if (object.id !== objectId) return object
    if (object.locked) {
      const { locked: _unlocked, ...rest } = object
      return rest
    }
    return { ...object, locked: true }
  })

/** The starter objects a teacher can put in every student's room. */
export type StarterObject = {
  id: string
  label: string
  // the swatch in the picker
  swatch: string
  build: (project: ProjectData, sceneId: string) => { project: ProjectData; objectId?: string }
}

// a built-in catalogue model
const fromModel = (assetId: string) => (project: ProjectData, sceneId: string) => createEditorObject(project, sceneId, 'model', assetId)

export const STARTER_OBJECTS: StarterObject[] = [
  { id: 'pedestal', label: 'Pedestal', swatch: '#e9d3a9', build: fromModel('bundled-model-pedestal') },
  // no Bench.glb yet: this id is a three.js stand-in (content/placeholderModels.ts) until the
  // real model is dropped into src/content/assets/, which then replaces it everywhere
  { id: 'bench', label: 'Bench', swatch: '#c8915a', build: fromModel('bundled-model-bench') },
  { id: 'fact-board', label: 'Fact board', swatch: '#f4f6fb', build: fromModel('bundled-model-sign') },
]

/** ADD STARTER OBJECT: places one where the floor was clicked. It starts locked and named after its kind. */
export const addStarterObject = (project: ProjectData, sceneId: string, starter: StarterObject, point: [number, number, number]): ProjectData => {
  const result = starter.build(project, sceneId)
  if (!result.objectId) return project
  return mapObjects(result.project, sceneId, (object) =>
    object.id === result.objectId
      ? { ...object, name: starter.label, locked: true, transform: { ...object.transform, position: [round(point[0]), object.transform.position[1], round(point[2])] } }
      : object,
  )
}

/** The pins and lock badges for a room. Locks sit above their object's position. */
export const markersFor = (scene: SceneData, show: { spots: boolean; locks: boolean }): SceneMarker[] => {
  const markers: SceneMarker[] = []
  if (show.spots) {
    ;(scene.spots ?? []).forEach((spot, index) =>
      markers.push({ kind: 'spot', id: spot.id, number: index + 1, text: spot.text, position: spot.position }),
    )
  }
  if (show.locks) {
    for (const object of scene.objects) {
      if (!object.locked) continue
      const [x, y, z] = object.transform.position
      markers.push({ kind: 'lock', id: object.id, position: [x, y + Math.max(1, object.transform.scale[1]) + 0.4, z] })
    }
  }
  return markers
}
