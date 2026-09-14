/******************************************************************************/
/**
 * @file        viewCube.ts
 * @project     Spatial Experience Builder
 * @author      Goh Pin Kai
 * @brief       builds the ViewCube widget that was inspired by Maya - a shaded, labeled cube plus eight
 *              corner handles for corner views, a fixed Home icon, and four nudge + two roll
 *              arrows that appear once the view is flush against one face.
 * 
 *              The cube itself (`worldGroup`) is a static stand-in for the world/environment -
 *              it never rotates, its faces are pinned to fixed world-semantic axes (FRONT is
 *              always +Z, TOP is always +Y, etc). What moves is the widget's own camera: each
 *              frame, Viewport.tsx calls `syncToCamera` with the MAIN camera's current
 *              direction/up (relative to its orbit target), and this camera orbits the static
 *              cube exactly the way the main camera orbits the actual scene. That's what makes
 *              the cube read as "the world, seen from your current angle" rather than a prop
 *              that's merely glued to the camera.
 * 
 *              The Home icon and nudge/roll arrows are children of this same camera (in its
 *              local space), so they orbit along with it and stay fixed in the same screen
 *              spot - a real HUD - even as the cube itself appears to turn underneath them.
 * 
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
import * as THREE from 'three'
import { FACE_VIEWS, NudgeDirection, RollDirection } from './viewSnap'

const CUBE_CAMERA_DISTANCE = 4
const OVERLAY_DEPTH = -1.5 // camera-local Z: negative is "into the screen", i.e. in front of the camera

const FACE_HOVER_TINT = 0xbfe0da
const CORNER_BASE_COLOR = 0x1c2f36
const CORNER_HOVER_COLOR = 0x35545a
const ARROW_BASE_COLOR = '#9fb7bc'
const ARROW_HOVER_COLOR = '#e8f4f1'
const FACE_TEXT = '#cfe4e0'
const FACE_BORDER = '#0a0f12'

// per-face background shade, indexed to match FACE_VIEWS — fakes a light source from
// the front/top/right so the cube reads as three-dimensional instead of six flat tiles
const FACE_BACKGROUND = ['#22393f', '#141f23', '#2b464e', '#0d1417', '#1c2f36', '#111a1e']

const makeFaceTexture = (label: string, background: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = FACE_BORDER
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, 122, 122)
  ctx.fillStyle = FACE_TEXT
  ctx.font = '700 18px "DM Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

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

export interface ViewCubeArrow {
  kind: ArrowKind
  sprite: THREE.Sprite
}

export interface ViewCubeWidget {
  scene: THREE.Group // pass this as the render root — contains the world group and the camera
  worldGroup: THREE.Group // cube + corners; fixed/world-aligned, never transformed
  camera: THREE.OrthographicCamera // orbits worldGroup each frame via syncToCamera
  cubeMesh: THREE.Mesh
  corners: THREE.Mesh[]
  homeSprite: THREE.Sprite
  arrows: ViewCubeArrow[]
  faceDirections: THREE.Vector3[]
  syncToCamera: (direction: THREE.Vector3, up: THREE.Vector3) => void
  setFaceHover: (index: number | null) => void
  setCornerHover: (mesh: THREE.Mesh | null) => void
  setHomeHover: (hovered: boolean) => void
  setArrowHover: (sprite: THREE.Sprite | null) => void
  setArrowsVisible: (visible: boolean) => void
  dispose: () => void
}

export const createViewCube = (): ViewCubeWidget => {
  const scene = new THREE.Group()
  const worldGroup = new THREE.Group()
  const camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 10)
  // camera is itself part of the render graph (not just an argument to renderer.render)
  // so its HUD children below get their world matrices updated as it orbits worldGroup
  scene.add(worldGroup, camera)

  const syncToCamera = (direction: THREE.Vector3, up: THREE.Vector3) => {
    camera.up.copy(up)
    camera.position.copy(direction).multiplyScalar(CUBE_CAMERA_DISTANCE)
    camera.lookAt(0, 0, 0)
  }
  syncToCamera(new THREE.Vector3(0.6, 0.5, 0.6).normalize(), new THREE.Vector3(0, 1, 0)) // corner default; Viewport.tsx overwrites this every frame

  const materials = FACE_VIEWS.map(
    (face, i) => new THREE.MeshBasicMaterial({ map: makeFaceTexture(face.label, FACE_BACKGROUND[i]), toneMapped: false }),
  )
  const cubeGeometry = new THREE.BoxGeometry(2, 2, 2)
  const cubeMesh = new THREE.Mesh(cubeGeometry, materials)
  worldGroup.add(cubeMesh)

  const cornerGeometry = new THREE.BoxGeometry(0.42, 0.42, 0.42)
  const corners: THREE.Mesh[] = []
  ;[-1, 1].forEach((x) => [-1, 1].forEach((y) => [-1, 1].forEach((z) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const mesh = new THREE.Mesh(cornerGeometry, new THREE.MeshBasicMaterial({ color: CORNER_BASE_COLOR, toneMapped: false }))
    mesh.position.copy(direction).multiplyScalar(1.12)
    mesh.userData.direction = direction
    worldGroup.add(mesh)
    corners.push(mesh)
  })))

  // HUD overlay: Home icon (top-left of the widget) plus nudge/roll arrows. These are
  // children of `camera` itself (in its local space) so they orbit along with it and
  // stay fixed on screen — depth testing is off so they always sit on top of the cube.
  const homeBaseMap = makeHomeTexture(ARROW_BASE_COLOR)
  const homeHoverMap = makeHomeTexture(ARROW_HOVER_COLOR)
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

  const arrows: ViewCubeArrow[] = []
  const arrowBaseMap = makeChevronTexture(ARROW_BASE_COLOR)
  const arrowHoverMap = makeChevronTexture(ARROW_HOVER_COLOR)
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
  const rollHoverMap = makeRollTexture(ARROW_HOVER_COLOR)
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

  const setFaceHover = (index: number | null) => {
    materials.forEach((material, i) => material.color.setHex(i === index ? FACE_HOVER_TINT : 0xffffff))
  }
  const setCornerHover = (target: THREE.Mesh | null) => {
    corners.forEach((corner) => (corner.material as THREE.MeshBasicMaterial).color.setHex(corner === target ? CORNER_HOVER_COLOR : CORNER_BASE_COLOR))
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
    cubeGeometry.dispose()
    cornerGeometry.dispose()
    materials.forEach((material) => { material.map?.dispose(); material.dispose() })
    corners.forEach((corner) => (corner.material as THREE.MeshBasicMaterial).dispose())
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
    cubeMesh,
    corners,
    homeSprite,
    arrows,
    faceDirections: FACE_VIEWS.map((face) => face.direction),
    syncToCamera,
    setFaceHover,
    setCornerHover,
    setHomeHover,
    setArrowHover,
    setArrowsVisible,
    dispose,
  }
}
