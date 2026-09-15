import * as THREE from 'three'
import { AxisArrow } from '../gizmo/types'
import { makeAxisArrow } from '../gizmo/moveGizmo'
import { AxisScaleHandle, makeAxisScaleHandle } from '../gizmo/scaleGizmo'
import { AxisRotateHandle, makeAxisRotateHandle } from '../gizmo/rotateGizmo'

export interface GizmoSet {
  group: THREE.Group
  axisArrows: AxisArrow[]
  scaleHandles: AxisScaleHandle[]
  rotateHandles: AxisRotateHandle[]
  dispose: () => void
}


export const createGizmoSet = (): GizmoSet => {
  const group = new THREE.Group()
  const axisArrows: AxisArrow[] = [makeAxisArrow('x'), makeAxisArrow('y'), makeAxisArrow('z')]
  
  // move gizmo: one arrow per axis, built once
  axisArrows.forEach((arrow) => group.add(arrow.group))

  // scale gizmo: one handle per axis, built once
  const scaleHandles: AxisScaleHandle[] = [makeAxisScaleHandle('x'), makeAxisScaleHandle('y'), makeAxisScaleHandle('z')]
  scaleHandles.forEach((handle) => group.add(handle.mesh))

  // rotate gizmo: one ring per axis, built once
  const rotateHandles: AxisRotateHandle[] = [makeAxisRotateHandle('x'), makeAxisRotateHandle('y'), makeAxisRotateHandle('z')]
  rotateHandles.forEach((handle) => group.add(handle.mesh))

  return {
    group,
    axisArrows,
    scaleHandles,
    rotateHandles,
    dispose: () => {
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.geometry.dispose()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => material.dispose())
      })
    },
  }
}
