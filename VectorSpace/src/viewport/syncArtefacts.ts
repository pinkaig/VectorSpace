/**
 * @file        syncArtefacts.ts
 * @brief       Rebuilds authored artefacts as disposable Three.js objects.
 *
 * @responsibility
 * Creates primitive geometry and materials, applies authored transforms and
 * visibility state, adds editor selection outlines, and disposes renderer
 * resources before a full synchronisation rebuild.
 *
 * @inputs
 * SceneObject snapshots, a Three.js group, and the selected object ID.
 *
 * @outputs
 * Updated Three.js artefact objects and explicit resource disposal helpers.
 *
 * @ownership
 * ProjectData remains authoritative. This module owns only the renderer
 * projection and GPU resources represented by the supplied group.
 *
 * @documentation
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 * The future-proof-rendering-system plan this file was built against was
 * archived and removed from the repository; it is in git history only.
 */
import * as THREE from 'three'
import type { SceneObject } from '../project/model'
import { colorFor } from './viewportTypes'
import { resolveModelUrl, resolveModelUrlModifier } from '../content/assets'
import { cloneModel, getCachedModel, loadModel } from '../content/modelCache'

export interface ArtefactSyncInput {
  group: THREE.Group
  objects: readonly SceneObject[]
  selectedId: string | null
  // Called once a `model` asset's GLB finishes loading after having been missing from the
  // cache on an earlier sync - lets the caller invalidate its own memo so the next
  // syncObjects pass retries and actually places it, without polling every frame.
  onModelLoaded?: () => void
}

const createGeometry = (kind: SceneObject['assetKind']): THREE.BufferGeometry => {
  if (kind === 'sphere') return new THREE.SphereGeometry(0.65, 32, 20)
  if (kind === 'cylinder') return new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32)
  return new THREE.BoxGeometry(1.1, 1.1, 1.1)
}

export const disposeObjectResources = (root: THREE.Object3D): void => {
  root.traverse((child) => {
    // A `model` instance shares its geometry/materials with the cached GLB template and
    // any other placed instance of it - only per-instance (primitive) resources are ours to free.
    if (child.userData.sharedResources) return
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

const applyTransform = (node: THREE.Object3D, item: SceneObject): void => {
  node.visible = item.visible
  node.userData.enabled = item.enabled
  node.position.set(...item.transform.position)
  node.rotation.set(...item.transform.rotation)
  node.scale.set(...item.transform.scale)
}

const SELECTION_COLOR = 0xf3d48b

// Bounds of an artefact's own meshes, in the node's local space. Stops at nested
// artefacts (children parented to this object) so it measures this object only.
export const artefactLocalBounds = (node: THREE.Object3D): THREE.Box3 => {
  node.updateMatrixWorld(true)
  const toLocal = node.matrixWorld.clone().invert()
  const box = new THREE.Box3()
  const visit = (child: THREE.Object3D) => {
    if (child !== node && (child.userData.entityId || child.userData.isSelectionOutline)) return
    if (child instanceof THREE.Mesh) {
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
      box.union(child.geometry.boundingBox!.clone().applyMatrix4(toLocal.clone().multiply(child.matrixWorld)))
    }
    child.children.forEach(visit)
  }
  visit(node)
  return box
}

// Primitives are outlined along their own edges. A model's geometry is many meshes with
// far too many edges for that, so it gets a box around its bounds instead.
const createSelectionOutline = (node: THREE.Object3D): THREE.LineSegments => {
  const material = new THREE.LineBasicMaterial({ color: SELECTION_COLOR })
  let outline: THREE.LineSegments
  if (node instanceof THREE.Mesh && !node.userData.sharedResources) {
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry), material)
  } else {
    const bounds = artefactLocalBounds(node)
    const size = bounds.getSize(new THREE.Vector3())
    const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z)
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), material)
    boxGeometry.dispose() // only needed to derive the edges
    bounds.getCenter(outline.position)
  }
  outline.raycast = () => {} // outline only - never steal a click from the object it outlines
  outline.userData.isSelectionOutline = true
  return outline
}

// The middle of an artefact's own bounds, as a point in its local space — fixed to the
// object, so it stays the same point on the object however it is rotated. The rotate
// gizmo sits here and turns the object about it.
export const artefactLocalCenter = (node: THREE.Object3D): THREE.Vector3 =>
  artefactLocalBounds(node).getCenter(new THREE.Vector3())

const setSelectionOutline = (node: THREE.Object3D, isSelected: boolean): void => {
  const current = node.children.find((child) => child.userData.isSelectionOutline) as THREE.LineSegments | undefined
  if (isSelected && !current) {
    node.add(createSelectionOutline(node))
  } else if (!isSelected && current) {
    node.remove(current)
    current.geometry.dispose()
    ;(current.material as THREE.Material).dispose()
  }
}

const createPrimitiveArtefact = (item: SceneObject): THREE.Mesh => {
  const geometry = createGeometry(item.assetKind)
  const material = new THREE.MeshStandardMaterial({ color: item.color ?? colorFor(item.assetKind), roughness: 0.68, metalness: 0.05 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = item.id
  mesh.userData.entityId = item.id
  applyTransform(mesh, item)
  return mesh
}

const createModelArtefact = (item: SceneObject, onModelLoaded?: () => void): THREE.Object3D | null => {
  const url = resolveModelUrl(item.assetId)
  const template = url ? getCachedModel(url) : undefined
  if (url && !template) loadModel(url, resolveModelUrlModifier(item.assetId)).then(() => onModelLoaded?.())
  if (!template) return null // not loaded yet (or a missing/unknown asset) — nothing to place this pass
  const mesh = cloneModel(template)
  mesh.name = item.id
  mesh.userData.entityId = item.id
  applyTransform(mesh, item)
  return mesh
}

export const syncArtefacts = ({ group, objects, selectedId, onModelLoaded }: ArtefactSyncInput): void => {
  // Artefacts can be nested (parentId), so they are no longer all direct children of
  // `group` - collect every entity-tagged node anywhere in the subtree.
  const existing = new Map<string, THREE.Object3D>()
  group.traverse((child) => {
    const entityId = child.userData.entityId as string | undefined
    if (entityId) existing.set(entityId, child)
  })

  const nodesById = new Map<string, THREE.Object3D>()

  objects.forEach((item) => {
    let node = existing.get(item.id)
    if (node) {
      applyTransform(node, item)
    } else {
      const created = item.assetKind === 'model' ? createModelArtefact(item, onModelLoaded) : createPrimitiveArtefact(item)
      if (!created) return // model not loaded yet - retried via onModelLoaded
      node = created
    }
    setSelectionOutline(node, item.id === selectedId)
    nodesById.set(item.id, node)
  })

  // Attach after every node exists so a child can precede its parent in `objects`.
  // Reattaching only when the parent actually changed keeps unchanged nodes untouched.
  objects.forEach((item) => {
    const node = nodesById.get(item.id)
    if (!node) return
    const parentNode = item.parentId ? nodesById.get(item.parentId) : undefined
    const target = parentNode ?? group
    if (node.parent !== target) target.add(node)
  })

  // Remove last: anything that was reparented above is no longer inside a removed
  // node's subtree, so disposing the removed node cannot free a surviving child.
  existing.forEach((node, id) => {
    if (nodesById.has(id)) return
    node.parent?.remove(node)
    disposeObjectResources(node)
  })
}
