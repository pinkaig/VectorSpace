/**
 * @file        placeholderModels.ts
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       Stand-in models built with three.js, for catalogue items whose .glb isn't made yet.
 *              Each is registered under the id its real model will have (e.g. Bench.glb becomes
 *              'bundled-model-bench'), with a "placeholder:" address instead of a file. The
 *              renderer (viewport/syncArtefacts.ts) builds the stand-in for that address. Once the
 *              real .glb is dropped into src/content/assets/, it registers first, the stand-in is
 *              skipped, and every object already placed with that id shows the real model.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import * as THREE from 'three'
import { registerLocalAsset, resolveLocalAssetUrl } from './assetResolution'

const SCHEME = 'placeholder:'

const box = (size: [number, number, number], at: [number, number, number], material: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...at)
  return mesh
}

// A wooden bench: a seat on four legs, 1.6 long, 0.45 tall, standing on the floor at its origin.
const bench = (): THREE.Group => {
  const wood = new THREE.MeshStandardMaterial({ color: 0xc8915a, roughness: 0.75, metalness: 0 })
  const legs = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8, metalness: 0 })
  const group = new THREE.Group()
  const seatHeight = 0.45
  const seatThickness = 0.07
  group.add(box([1.6, seatThickness, 0.45], [0, seatHeight - seatThickness / 2, 0], wood))
  const legHeight = seatHeight - seatThickness
  for (const x of [-0.7, 0.7]) {
    for (const z of [-0.16, 0.16]) group.add(box([0.07, legHeight, 0.07], [x, legHeight / 2, z], legs))
  }
  // a rail between each pair of legs, so it reads as one piece of furniture
  for (const x of [-0.7, 0.7]) group.add(box([0.05, 0.05, 0.32], [x, 0.12, 0], legs))
  return group
}

// asset id -> builder; the id is what the real .glb's file name will give it (assets.ts)
const BUILDERS: Record<string, () => THREE.Group> = {
  'bundled-model-bench': bench,
}

/** Registers a stand-in for every placeholder whose real model isn't in the catalogue. */
export const registerPlaceholderModels = (): void => {
  for (const assetId of Object.keys(BUILDERS)) {
    if (!resolveLocalAssetUrl(assetId)) registerLocalAsset(assetId, { url: `${SCHEME}${assetId}`, contentType: 'model/x-placeholder' })
  }
}

/** The stand-in for a "placeholder:" address, or undefined for a real model's address. */
export const buildPlaceholderModel = (url: string): THREE.Group | undefined => {
  if (!url.startsWith(SCHEME)) return undefined
  return BUILDERS[url.slice(SCHEME.length)]?.()
}
