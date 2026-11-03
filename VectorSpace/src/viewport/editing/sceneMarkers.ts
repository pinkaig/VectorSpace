/**
 * @file       sceneMarkers.ts
 * @project    VectorSpace
 * @author     Goh Pin Kai
 * @brief      Floating markers over the room, for the teacher's tools: a numbered pin with a
 *             label and a dotted ring on the floor for a suggested spot, and a lock badge over
 *             a locked object. Drawn as screen-sized sprites, so they read the same at any zoom,
 *             and on top of everything, so a wall never hides one.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'

export type SceneMarker =
  | { kind: 'spot'; id: string; number: number; text: string; position: [number, number, number] }
  | { kind: 'lock'; id: string; position: [number, number, number] }

const PURPLE = '#5b4bdb'
const INK = '#1e1b3a'
// how tall a marker is, as a share of the viewport's height
const PIN_HEIGHT = 0.05
const LABEL_HEIGHT = 0.04
const RING_RADIUS = 0.6
const PIN_RISE = 1.1

// a canvas drawn at 2x for a sharp sprite; returns the texture and its width / height
const drawTexture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement('canvas')
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: width / height }
}

const sprite = (texture: THREE.Texture, aspect: number, height: number, center: [number, number] = [0.5, 0.5]) => {
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, sizeAttenuation: false })
  const result = new THREE.Sprite(material)
  result.scale.set(height * aspect, height, 1)
  result.center.set(...center)
  result.renderOrder = 1000
  return result
}

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string) => {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.lineWidth = 3
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
}

const numberBadge = (n: number) =>
  drawTexture(40, 40, (ctx) => {
    circle(ctx, 20, 20, 17, PURPLE, '#ffffff')
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 20, 21)
  })

const lockBadge = () =>
  drawTexture(40, 40, (ctx) => {
    circle(ctx, 20, 20, 17, PURPLE, '#ffffff')
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(20, 17, 5, Math.PI, 0)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(13, 17, 14, 11)
  })

const labelPill = (text: string) => {
  const font = '700 15px system-ui, sans-serif'
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const width = Math.ceil(measure.measureText(text).width) + 32
  return drawTexture(width, 32, (ctx) => {
    ctx.beginPath()
    ctx.roundRect(1.5, 1.5, width - 3, 29, 14.5)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#d6ccf5'
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, 17)
  })
}

// a dotted circle flat on the floor, where a spot is
const ring = () => {
  const points = Array.from({ length: 65 }, (_, i) => {
    const angle = (i / 64) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS)
  })
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({ color: PURPLE, dashSize: 0.08, gapSize: 0.08, depthTest: false }),
  )
  line.computeLineDistances()
  line.renderOrder = 999
  return line
}

// the pin's stem, from the floor up to the number
const stem = () => {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, PIN_RISE, 0)]),
    new THREE.LineBasicMaterial({ color: PURPLE, depthTest: false }),
  )
  line.renderOrder = 999
  return line
}

const disposeGroup = (group: THREE.Group) => {
  group.traverse((child) => {
    const item = child as THREE.Mesh
    item.geometry?.dispose()
    const material = item.material as THREE.Material & { map?: THREE.Texture | null }
    material?.map?.dispose()
    material?.dispose()
  })
  group.clear()
}

/** Adds a marker layer to the scene. update() redraws every marker; dispose() removes them. */
export const createSceneMarkers = (scene: THREE.Scene) => {
  const group = new THREE.Group()
  scene.add(group)

  const update = (markers: readonly SceneMarker[]) => {
    disposeGroup(group)
    for (const marker of markers) {
      const [x, y, z] = marker.position
      const holder = new THREE.Group()
      holder.position.set(x, y, z)
      if (marker.kind === 'spot') {
        holder.add(ring(), stem())
        const badge = numberBadge(marker.number)
        const pin = sprite(badge.texture, badge.aspect, PIN_HEIGHT)
        pin.position.y = PIN_RISE
        holder.add(pin)
        if (marker.text) {
          const pill = labelPill(marker.text)
          // sits above the number, its bottom edge on the pin
          const label = sprite(pill.texture, pill.aspect, LABEL_HEIGHT, [0.5, -0.75])
          label.position.y = PIN_RISE
          holder.add(label)
        }
      } else {
        const badge = lockBadge()
        holder.add(sprite(badge.texture, badge.aspect, PIN_HEIGHT * 0.85))
      }
      group.add(holder)
    }
  }

  const dispose = () => {
    disposeGroup(group)
    scene.remove(group)
  }

  return { update, dispose }
}
