/**
 * @file        objectAccess.ts
 * @brief       Shared scene/object lookup, addressing, and failure reporting.
 *
 * @responsibility
 * Resolves scene and object addresses inside a ProjectData snapshot and raises
 * one consistent error type when an address cannot be resolved. Owns no state
 * and performs no mutation of its own.
 *
 * @inputs
 * ProjectData snapshots and { sceneId, objectId } addresses.
 *
 * @outputs
 * Resolved scene/object references, subtree ID sets, and ObjectOperationError.
 *
 * @ownership
 * Extracted from index.ts so both the operation functions and the command
 * modules can share one lookup implementation without an import cycle. This
 * file must not gain mutation, history, validation, or persistence logic.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import { ProjectData, SceneObject } from '@vectorspace/project'

export interface ObjectTargetInput {
  sceneId: string
  objectId: string
}

export class ObjectOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ObjectOperationError'
  }
}

export const requireScene = (project: ProjectData, sceneId: string) => {
  const scene = project.scenes.find((item) => item.id === sceneId)
  if (!scene) throw new ObjectOperationError(`Scene "${sceneId}" was not found`)
  return scene
}

export const requireObject = (project: ProjectData, input: ObjectTargetInput) => {
  const scene = requireScene(project, input.sceneId)
  const index = scene.objects.findIndex((item) => item.id === input.objectId)
  if (index < 0) throw new ObjectOperationError(`Object "${input.objectId}" was not found`)
  return { scene, object: scene.objects[index], index }
}

// The root plus every object that transitively parents up to it.
export const collectSubtreeIds = (objects: readonly SceneObject[], rootId: string): Set<string> => {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const object of objects) {
      if (object.parentId !== undefined && ids.has(object.parentId) && !ids.has(object.id)) {
        ids.add(object.id)
        grew = true
      }
    }
  }
  return ids
}
