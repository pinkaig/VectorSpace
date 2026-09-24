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
    if (params?.objectId) {
      const mesh = objectsGroup.getObjectByName(params.objectId) as THREE.Mesh | undefined
      if (mesh) {
        const material = mesh.material as THREE.MeshStandardMaterial
        material.color.setHex(params.color) // set the new color directly on the material
      }
    }
    return context.state // must return state, since this action registers no effect and needs no cleanup tracking
  }
}