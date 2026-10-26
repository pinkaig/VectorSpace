/**
 * @file        axisIndicator.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       builds a small always-visible XYZ axis indicator (Blender-style) - three
 *              colored stems with labeled ball tips, rendered in its own scene that rotates
 *              opposite to the main camera each frame so it always shows which way the
 *              world axes point. Clicking a ball reorients the camera along that axis.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import { AxisName } from '../../gizmo/types'
import { AXIS_COLORS } from '../../gizmo/colors'

const HOVER_SCALE = 1.25

const AXIS_LABELS: Record<AxisName, string> = { x: 'X', y: 'Y', z: 'Z' }

const makeBallTexture = (color: number, label: string | null) => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(32, 32, label ? 26 : 15, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  ctx.fill()
  if (label) {
    ctx.fillStyle = '#0b1118'
    ctx.font = '800 26px "Nunito", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 32, 34)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export interface AxisIndicatorHandle {
  group: THREE.Group
  camera: THREE.OrthographicCamera
  interactiveObjects: THREE.Sprite[]
  setHover: (target: THREE.Sprite | null) => void
  dispose: () => void
}

export const createAxisIndicator = (): AxisIndicatorHandle => {
  const group = new THREE.Group()
  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0, 4)
  camera.position.set(0, 0, 2)

  // stem points along +X by default; y/z stems are rotated onto their own axis below
  const stemGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8).rotateZ(-Math.PI / 2).translate(0.36, 0, 0)
  const interactiveObjects: THREE.Sprite[] = []
  const axes: AxisName[] = ['x', 'y', 'z']

  axes.forEach((axis) => {
    const color = AXIS_COLORS[axis]
    const stem = new THREE.Mesh(stemGeometry, new THREE.MeshBasicMaterial({ color, toneMapped: false }))
    if (axis === 'y') stem.rotation.z = Math.PI / 2
    if (axis === 'z') stem.rotation.y = -Math.PI / 2
    group.add(stem)

    const direction = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)

    const positive = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeBallTexture(color, AXIS_LABELS[axis]), toneMapped: false }))
    positive.scale.setScalar(0.42)
    positive.position.copy(direction)
    positive.userData.direction = direction.clone()
    positive.userData.baseScale = 0.42

    const negative = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeBallTexture(color, null), toneMapped: false, transparent: true, opacity: 0.35 }))
    negative.scale.setScalar(0.3)
    negative.position.copy(direction).multiplyScalar(-1)
    negative.userData.direction = direction.clone().multiplyScalar(-1)
    negative.userData.baseScale = 0.3

    group.add(positive, negative)
    interactiveObjects.push(positive, negative)
  })

  let hovered: THREE.Sprite | null = null
  const setHover = (target: THREE.Sprite | null) => {
    if (hovered === target) return
    if (hovered) hovered.scale.setScalar(hovered.userData.baseScale as number)
    hovered = target
    if (hovered) hovered.scale.setScalar((hovered.userData.baseScale as number) * HOVER_SCALE)
  }

  const dispose = () => {
    stemGeometry.dispose()
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material.dispose()
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose()
        child.material.dispose()
      }
    })
  }

  return { group, camera, interactiveObjects, setHover, dispose }
}
