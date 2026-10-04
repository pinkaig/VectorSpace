/**
 * @file        changeColorAction.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       WHEN->DO action executor for changeColor. Finds the target object in the scene by ID and
 *              recolours every mesh inside it, so it works for primitives and imported models. Uses material
 *              copies and registers an effect that restores the original materials when the runtime resets.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
 import * as THREE from 'three'
 import type { ActionSpec } from '@vthere/project'
 import type { ActionExecutor } from '../../../packages/interaction/src/index'
 
 export interface ChangeColorParams {
    objectId: string
    color: number
 }

// copies a material and sets the copy's colour, so the original stays untouched and can be put back later
const recolourCopy = (material: THREE.Material, color: number): THREE.Material => {
  const copy = material.clone()
  // only materials that have a colour can be recoloured, others are copied unchanged
  if ('color' in copy && copy.color instanceof THREE.Color) copy.color.setHex(color)
  return copy
}

// frees the GPU memory of material copies once they are no longer shown
const disposeMaterials = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) material.forEach((item) => item.dispose())
  else material.dispose()
}

// creates the executor, given the scene's objectsGroup so it can find the target object by name
export const createChangeColorExecutor = (objectsGroup: THREE.Group): ActionExecutor => {
  return (action, context) => {
    const params = action.params as ChangeColorParams | undefined
    if (!params?.objectId) return context.state
    const target = objectsGroup.getObjectByName(params.objectId)
    // a primitive is a single mesh, an imported model is a group of meshes, so visit every mesh inside the target
    target?.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const original = node.material
      // give this mesh its own recoloured copies, so other copies of the same model keep their colour
      const recoloured = Array.isArray(original) ? original.map((item) => recolourCopy(item, params.color)) : recolourCopy(original, params.color)
      node.material = recoloured
      // restarting (R), exiting, or closing the viewport puts the original material back and frees the copies
      context.effects.add(() => {
        node.material = original
        disposeMaterials(recoloured)
      })
    })
    return context.state // must return state, the colour reset is handled by the effects registered above
  }
}