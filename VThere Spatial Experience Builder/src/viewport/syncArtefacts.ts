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
 * Rendering map: docs/05-subsystems/viewport.md
 * Rendering plan: docs/07-research-and-history/Week3/Wk2_3--PLAN--future-proof-rendering-system.md
 */
import * as THREE from 'three'
import type { SceneObject } from '../model'
import { colorFor } from './viewportTypes'

export interface ArtefactSyncInput {
  group: THREE.Group
  objects: readonly SceneObject[]
  selectedId: string | null
}

const createGeometry = (kind: SceneObject['assetKind']): THREE.BufferGeometry => {
  if (kind === 'sphere') return new THREE.SphereGeometry(0.65, 32, 20)
  if (kind === 'cylinder') return new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32)
  return new THREE.BoxGeometry(1.1, 1.1, 1.1)
}

export const disposeObjectResources = (root: THREE.Object3D): void => {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

export const syncArtefacts = ({ group, objects, selectedId }: ArtefactSyncInput): void => {
  disposeObjectResources(group)
  group.clear()

  objects.forEach((item) => {
    const geometry = createGeometry(item.assetKind)
    const material = new THREE.MeshStandardMaterial({
      color: colorFor(item.assetKind),
      roughness: 0.68,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = item.id
    mesh.visible = item.visible
    mesh.userData.entityId = item.id
    mesh.userData.enabled = item.enabled
    mesh.position.set(...item.transform.position)
    mesh.rotation.set(...item.transform.rotation)
    mesh.scale.set(...item.transform.scale)

    if (item.id === selectedId) {
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xf3d48b }),
      ))
    }

    group.add(mesh)
  })
}
