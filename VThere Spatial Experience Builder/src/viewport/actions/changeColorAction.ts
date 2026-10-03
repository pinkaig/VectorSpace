/**
 * @file        changeColorAction.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       WHEN->DO action executor for changeColor. Finds the target mesh in the scene
 *              by ID and sets its material color directly. Purely a Three.js scene 
 *              mutation, never writes ProjectData, so the color reverts for free when the
 *              runtime resets.
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

// creates the executor, given the scene's objectsGroup so it can find the target mesh by name
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