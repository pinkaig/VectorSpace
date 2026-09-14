/******************************************************************************/
/**
 * @file        octaOrb.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       Implements OctaOrb, a custom 3D viewport navigation widget
 *              inspired by Maya's 3D ViewCube. It provides quick camera snapping to
 *              standard axis views, with additional Home, nudge, and roll controls.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import { FACE_VIEWS, NudgeDirection, RollDirection } from './viewSnap'

const OCTAORB_CAMERA_DISTANCE = 4
const OVERLAY_DEPTH = -1.5 // camera-local Z: negative is "into the screen", i.e. in front of the camera
const BODY_RADIUS = 1.0 // distance from center to each of the 6 orb tips
const VERTEX_RADIUS = 0.22 // orb size — deliberately large, this is the whole click target now

// "Stealth" palette: dark, close to the viewport background, with a warm yellow accent
// for the orbs, axis lines, and hover states.
const AXIS_LINE_COLOR = '#3a5560'
const ACCENT = '#f4c94f'
const ACCENT_HOVER = '#ffe98a'
const ARROW_BASE_COLOR = '#9fb7bc'

const makeHomeTexture = (color: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(10, 16, 20, 0.75)'
  ctx.beginPath()
  ctx.roundRect(2, 2, 60, 60, 10)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath() // simple house glyph: a triangle roof over a square body
  ctx.moveTo(32, 16)
  ctx.lineTo(50, 32)
  ctx.lineTo(43, 32)
  ctx.lineTo(43, 48)
  ctx.lineTo(21, 48)
  ctx.lineTo(21, 32)
  ctx.lineTo(14, 32)
  ctx.closePath()
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// draws a straight chevron for the four nudge arrows, rotated per direction
const makeChevronTexture = (color: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(24, 10)
  ctx.lineTo(40, 32)
  ctx.lineTo(28, 32)
  ctx.lineTo(28, 40)
  ctx.lineTo(20, 40)
  ctx.lineTo(20, 32)
  ctx.lineTo(8, 32)
  ctx.closePath()
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// draws a curved roll arrow, mirrored for left/right via the mesh's own scale.x
const makeRollTexture = (color: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(24, 28, 14, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath() // arrowhead at the curve's end
  ctx.moveTo(35, 12)
  ctx.lineTo(35, 24)
  ctx.lineTo(24, 17)
  ctx.closePath()
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export type ArrowKind = NudgeDirection | `roll-${RollDirection}`

export interface OctaOrbArrow {
  kind: ArrowKind
  sprite: THREE.Sprite
}

export interface OctaOrbWidget {
  scene: THREE.Group // pass this as the render root — contains the world group and the camera
  worldGroup: THREE.Group // axis lines + orb tips + labels; fixed/world-aligned, never transformed
  camera: THREE.OrthographicCamera // orbits worldGroup each frame via syncToCamera
  vertexMeshes: THREE.Mesh[] // 6 orb tips, pinned to FACE_VIEWS directions -> axis-aligned views
  homeSprite: THREE.Sprite
  arrows: OctaOrbArrow[]
  syncToCamera: (direction: THREE.Vector3, up: THREE.Vector3) => void
  setVertexHover: (mesh: THREE.Mesh | null) => void
  setHomeHover: (hovered: boolean) => void
  setArrowHover: (sprite: THREE.Sprite | null) => void
  setArrowsVisible: (visible: boolean) => void
  dispose: () => void
}

export const createOctaOrb = (): OctaOrbWidget => {
  const scene = new THREE.Group()
  const worldGroup = new THREE.Group()
  const camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 10)
  // camera is itself part of the render graph (not just an argument to renderer.render)
  // so its HUD children below get their world matrices updated as it orbits worldGroup
  scene.add(worldGroup, camera)

  const syncToCamera = (direction: THREE.Vector3, up: THREE.Vector3) => {
    camera.up.copy(up)
    camera.position.copy(direction).multiplyScalar(OCTAORB_CAMERA_DISTANCE)
    camera.lookAt(0, 0, 0)
  }
  syncToCamera(new THREE.Vector3(0.6, 0.5, 0.6).normalize(), new THREE.Vector3(0, 1, 0)) // corner default; Viewport.tsx overwrites this every frame

  // Visual-only "jack": three perpendicular axis lines through the center, purely to read
  // as one connected 3D object and hint at depth — never a raycast target.
  const axisLineMaterial = new THREE.LineBasicMaterial({ color: AXIS_LINE_COLOR, transparent: true, opacity: 0.8, toneMapped: false })
  const axisLineGeometry = new THREE.BufferGeometry()
  axisLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -BODY_RADIUS, 0, 0, BODY_RADIUS, 0, 0,
    0, -BODY_RADIUS, 0, 0, BODY_RADIUS, 0,
    0, 0, -BODY_RADIUS, 0, 0, BODY_RADIUS,
  ], 3))
  const axisLines = new THREE.LineSegments(axisLineGeometry, axisLineMaterial)
  worldGroup.add(axisLines)

  // 6 large orb tips, pinned to the canonical world-axis directions (shared with the axis
  // indicator and camera-snap math). Deliberately big — the orb IS the click target, no
  // separate hitbox, so it needs to be comfortably clickable inside a small overlay.
  const vertexGeometry = new THREE.SphereGeometry(VERTEX_RADIUS, 20, 14)
  const vertexMeshes: THREE.Mesh[] = []
  FACE_VIEWS.forEach(({ direction, label }) => {
    const material = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false })
    const mesh = new THREE.Mesh(vertexGeometry, material)
    mesh.position.copy(direction).multiplyScalar(BODY_RADIUS)
    mesh.userData.direction = direction.clone()
    mesh.userData.label = label // read by Viewport.tsx to show the hover tooltip
    worldGroup.add(mesh)
    vertexMeshes.push(mesh)
  })

  // HUD overlay: Home icon (top-left of the widget) plus nudge/roll arrows. These are
  // children of `camera` itself (in its local space) so they orbit along with it and
  // stay fixed on screen — depth testing is off so they always sit on top of the body.
  const homeBaseMap = makeHomeTexture(ARROW_BASE_COLOR)
  const homeHoverMap = makeHomeTexture(ACCENT_HOVER)
  const homeMaterial = new THREE.SpriteMaterial({ map: homeBaseMap, toneMapped: false, depthTest: false })
  const homeSprite = new THREE.Sprite(homeMaterial)
  homeSprite.scale.setScalar(0.62)
  homeSprite.position.set(-1.35, 1.35, OVERLAY_DEPTH)
  homeSprite.renderOrder = 10
  camera.add(homeSprite)

  const NUDGE_LAYOUT: { kind: NudgeDirection; position: [number, number]; rotation: number }[] = [
    { kind: 'up', position: [0, 1.55], rotation: 0 },
    { kind: 'down', position: [0, -1.55], rotation: Math.PI },
    { kind: 'right', position: [1.55, 0], rotation: -Math.PI / 2 },
    { kind: 'left', position: [-1.55, 0], rotation: Math.PI / 2 },
  ]
  const ROLL_LAYOUT: { kind: `roll-${RollDirection}`; position: [number, number]; flip: boolean }[] = [
    { kind: 'roll-left', position: [-1.2, 1.55], flip: true },
    { kind: 'roll-right', position: [1.2, 1.55], flip: false },
  ]

  const arrows: OctaOrbArrow[] = []
  const arrowBaseMap = makeChevronTexture(ARROW_BASE_COLOR)
  const arrowHoverMap = makeChevronTexture(ACCENT_HOVER)
  NUDGE_LAYOUT.forEach(({ kind, position, rotation }) => {
    const material = new THREE.SpriteMaterial({ map: arrowBaseMap, toneMapped: false, depthTest: false, rotation })
    const sprite = new THREE.Sprite(material)
    sprite.scale.setScalar(0.4)
    sprite.position.set(position[0], position[1], OVERLAY_DEPTH)
    sprite.renderOrder = 10
    sprite.userData.kind = kind
    camera.add(sprite)
    arrows.push({ kind, sprite })
  })
  const rollBaseMap = makeRollTexture(ARROW_BASE_COLOR)
  const rollHoverMap = makeRollTexture(ACCENT_HOVER)
  ROLL_LAYOUT.forEach(({ kind, position, flip }) => {
    const material = new THREE.SpriteMaterial({ map: rollBaseMap, toneMapped: false, depthTest: false })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(flip ? -0.4 : 0.4, 0.4, 1)
    sprite.position.set(position[0], position[1], OVERLAY_DEPTH)
    sprite.renderOrder = 10
    sprite.userData.kind = kind
    camera.add(sprite)
    arrows.push({ kind, sprite })
  })

  const setVertexHover = (target: THREE.Mesh | null) => {
    vertexMeshes.forEach((mesh) => {
      ;(mesh.material as THREE.MeshBasicMaterial).color.set(mesh === target ? ACCENT_HOVER : ACCENT)
    })
  }
  const setHomeHover = (hovered: boolean) => {
    homeMaterial.map = hovered ? homeHoverMap : homeBaseMap
  }
  let hoveredArrow: THREE.Sprite | null = null
  const setArrowHover = (target: THREE.Sprite | null) => {
    if (hoveredArrow === target) return
    if (hoveredArrow) {
      const isRoll = (hoveredArrow.userData.kind as ArrowKind).startsWith('roll')
      ;(hoveredArrow.material as THREE.SpriteMaterial).map = isRoll ? rollBaseMap : arrowBaseMap
    }
    hoveredArrow = target
    if (hoveredArrow) {
      const isRoll = (hoveredArrow.userData.kind as ArrowKind).startsWith('roll')
      ;(hoveredArrow.material as THREE.SpriteMaterial).map = isRoll ? rollHoverMap : arrowHoverMap
    }
  }
  const setArrowsVisible = (visible: boolean) => {
    arrows.forEach((arrow) => { arrow.sprite.visible = visible })
  }

  const dispose = () => {
    axisLineGeometry.dispose()
    axisLineMaterial.dispose()
    vertexGeometry.dispose()
    vertexMeshes.forEach((mesh) => (mesh.material as THREE.MeshBasicMaterial).dispose())
    homeBaseMap.dispose()
    homeHoverMap.dispose()
    homeMaterial.dispose()
    arrowBaseMap.dispose()
    arrowHoverMap.dispose()
    rollBaseMap.dispose()
    rollHoverMap.dispose()
    arrows.forEach((arrow) => (arrow.sprite.material as THREE.SpriteMaterial).dispose())
  }

  return {
    scene,
    worldGroup,
    camera,
    vertexMeshes,
    homeSprite,
    arrows,
    syncToCamera,
    setVertexHover,
    setHomeHover,
    setArrowHover,
    setArrowsVisible,
    dispose,
  }
}
