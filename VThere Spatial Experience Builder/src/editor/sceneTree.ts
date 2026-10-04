/**
 * @file        sceneTree.ts
 * @brief       Pure ordering/indentation helpers for the scene hierarchy panel.
 *
 * @responsibility
 * Turns a flat SceneObject[] (each carrying an optional parentId) into a
 * depth-first, depth-annotated render order, and answers the sibling
 * questions the indent/outdent tree controls need.
 *
 * @inputs
 * The active scene's SceneObject[] array, in its stored order.
 *
 * @outputs
 * SceneTreeRow[] for rendering, plus previousSibling/grandparentId lookups.
 *
 * @boundary
 * No React, no authoring-engine calls, no mutation. Reparenting itself goes
 * through @vthere/authoring-engine's reparentObject via editorOperations.
 *
 * @documentation
 * Authoring boundary: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { SceneObject } from '../model'

export interface SceneTreeRow {
  object: SceneObject
  depth: number
}

/**
 * Depth-first order: root objects (no parentId) in their original array
 * order, then each root's children in their original array order,
 * recursively. This is the single source of truth for render order so the
 * indent/outdent sibling lookups below never disagree with what is drawn.
 */
export const buildSceneTree = (objects: readonly SceneObject[]): SceneTreeRow[] => {
  const childrenByParent = new Map<string, SceneObject[]>()
  const roots: SceneObject[] = []
  for (const object of objects) {
    if (object.parentId === undefined) {
      roots.push(object)
      continue
    }
    const siblings = childrenByParent.get(object.parentId)
    if (siblings) siblings.push(object)
    else childrenByParent.set(object.parentId, [object])
  }

  const rows: SceneTreeRow[] = []
  const visit = (object: SceneObject, depth: number) => {
    rows.push({ object, depth })
    for (const child of childrenByParent.get(object.id) ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return rows
}

/** Siblings share a parentId, in original array order (not tree order). */
const siblingsOf = (objects: readonly SceneObject[], parentId: string | undefined): SceneObject[] =>
  objects.filter((item) => item.parentId === parentId)

/** The sibling immediately before this object, or null if it is already first (Indent target). */
export const previousSibling = (objects: readonly SceneObject[], objectId: string): SceneObject | null => {
  const object = objects.find((item) => item.id === objectId)
  if (!object) return null
  const siblings = siblingsOf(objects, object.parentId)
  const index = siblings.findIndex((item) => item.id === objectId)
  return index > 0 ? siblings[index - 1] : null
}

/** The parent's own parentId, or null when the object is already top-level (Outdent target). */
export const grandparentId = (objects: readonly SceneObject[], objectId: string): string | null => {
  const object = objects.find((item) => item.id === objectId)
  if (!object?.parentId) return null
  const parent = objects.find((item) => item.id === object.parentId)
  return parent?.parentId ?? null
}
