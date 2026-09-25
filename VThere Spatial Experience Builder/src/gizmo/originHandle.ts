/**
 * @file        originHandle.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Builds the move gizmo's center origin handle, a small sphere
 *              sitting at the object's shared pivot point that triggers free
 *              movement when grabbed, replacing free-move triggered by clicking
 *              the object body directly.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import * as THREE from "three";
import { ORIGIN_COLOR } from "./colors";

export interface OriginHandle {
  mesh: THREE.Mesh;
}

/**
 * Builds the origin handle: a small sphere with no axis or direction of its
 * own, since it triggers free camera-plane movement rather than a
 * constrained axis drag. Always sits at the gizmo group's local origin,
 * which syncGizmo keeps positioned at the selected object's world center.
 *
 * @returns The origin handle, ready to be added to the gizmo group.
 */
export const makeOriginHandle = (): OriginHandle => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16), // smaller, and more segments for a smoother, more visibly round shape
    new THREE.MeshStandardMaterial({ color: ORIGIN_COLOR, depthTest: false, depthWrite: false, roughness: 0.4, metalness: 0.1 }), // responds to scene lighting, reads as 3D instead of a flat disc
  )
  mesh.renderOrder = 1000 // slightly above the arrows' 999, so it consistently draws on top rather than fighting them
  return { mesh }
};

/**
 * Sets the origin handle's color, used for its default and hover states.
 *
 * @param handle - The origin handle whose color is being set.
 * @param color - The hex color to apply.
 */
export const setOriginHandleColor = (handle: OriginHandle, color: number) => {
  (handle.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
};
