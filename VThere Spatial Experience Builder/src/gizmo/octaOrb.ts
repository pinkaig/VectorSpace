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
import { EDGE_VIEWS, FACE_VIEWS, NudgeDirection, RollDirection } from './viewSnap'

const OCTAORB_CAMERA_DISTANCE = 4
const OVERLAY_DEPTH = -1.5 // camera-local Z: negative is "into the screen", i.e. in front of the camera
const BODY_RADIUS = 1.0 // distance from center to each of the 6 orb tips
const VERTEX_RADIUS = 0.22 // orb size — deliberately large, this is the whole click target now
const EDGE_RADIUS = 0.12 // edge orbs are secondary targets, so smaller than the face orbs

// "Stealth" palette: dark, close to the viewport background, with a warm yellow accent
// for the orbs, axis lines, and hover states.
const AXIS_LINE_COLOR = '#5d8391'
const BODY_COLOR = '#2a3f48'
const ACCENT = '#f4c94f'
const EDGE_COLOR = '#b8923a' // dimmer accent so edge orbs read as secondary to the face orbs
const ACCENT_HOVER = '#ffe98a'
const ARROW_BASE_COLOR = '#9fb7bc'

// dark rounded backing plate shared by the Home and roll buttons, so they read as buttons
const makeButtonCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(10, 16, 20, 0.75)'
  ctx.beginPath()
  ctx.roundRect(2, 2, 60, 60, 10)
  ctx.fill()
  return { canvas, ctx }
}

const makeHomeTexture = (color: string) => {
  const { canvas, ctx } = makeButtonCanvas()
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

// draws a circular roll arrow on a button plate. Mirrored in the canvas itself
const makeRollTexture = (color: string, clockwise: boolean) => {
  const { canvas, ctx } = makeButtonCanvas()
  if (!clockwise) {
    ctx.translate(64, 0)
    ctx.scale(-1, 1)
  }
  const cx = 32
  const cy = 34
  const r = 15
  const end = Math.PI * 2.05
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 0.8, end)
  ctx.stroke()
  // arrowhead at the arc's end, pointing along its clockwise tangent
  const ex = cx + r * Math.cos(end)
  const ey = cy + r * Math.sin(end)
  const tx = -Math.sin(end)
  const ty = Math.cos(end)
  const nx = Math.cos(end)
  const ny = Math.sin(end)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(ex + tx * 9, ey + ty * 9)
  ctx.lineTo(ex + nx * 8, ey + ny * 8)
  ctx.lineTo(ex - nx * 8, ey - ny * 8)
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
  worldGroup: THREE.Group // body + outline + orbs; fixed/world-aligned, never transformed
  body: THREE.Mesh // opaque octahedron; raycast alongside the orbs so hidden ones can't be clicked
  camera: THREE.OrthographicCamera // orbits worldGroup each frame via syncToCamera
  vertexMeshes: THREE.Mesh[] // 6 orb tips, pinned to FACE_VIEWS directions -> axis-aligned views
  edgeMeshes: THREE.Mesh[] // 12 smaller orbs between adjacent tips, pinned to EDGE_VIEWS -> 45-degree edge views
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

  // Solid octahedron body joining the tips. Opaque so the far side (and its orbs) is
  // hidden, which is what makes the widget read as one 3D object. Slightly smaller than
  // the tips so every face and edge orb sits proud of its surface. Also a raycast
  // target: a hit on the body in front of an orb means that orb is out of sight.
  const bodyGeometry = new THREE.OctahedronGeometry(BODY_RADIUS * 0.92)
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: BODY_COLOR, flatShading: true })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  worldGroup.add(body)
  // Lights ride on the widget camera so the shading stays the same from every angle:
  // a soft fill plus a key from the viewer's upper left, so each face gets its own tone.
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(-1, 2, 3)
  camera.add(new THREE.AmbientLight(0xffffff, 1.1), keyLight)

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

  // 12 edge orbs, one on each edge of the octahedron between two adjacent tips — the
  // same 12 edges a view cube has. Outline lines trace the edges over the solid body.
  const edgeLinePositions: number[] = []
  FACE_VIEWS.forEach((a, i) => FACE_VIEWS.slice(i + 1).forEach((b) => {
    if (a.direction.dot(b.direction) !== 0) return
    edgeLinePositions.push(...a.direction.toArray(), ...b.direction.toArray())
  }))
  const edgeLineMaterial = new THREE.LineBasicMaterial({ color: AXIS_LINE_COLOR, toneMapped: false })
  const edgeLineGeometry = new THREE.BufferGeometry()
  edgeLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeLinePositions.map((v) => v * BODY_RADIUS), 3))
  worldGroup.add(new THREE.LineSegments(edgeLineGeometry, edgeLineMaterial))

  const edgeGeometry = new THREE.SphereGeometry(EDGE_RADIUS, 16, 10)
  const edgeMeshes: THREE.Mesh[] = []
  EDGE_VIEWS.forEach(({ direction, label }) => {
    const material = new THREE.MeshBasicMaterial({ color: EDGE_COLOR, toneMapped: false })
    const mesh = new THREE.Mesh(edgeGeometry, material)
    // midpoint of the two tips: the unit diagonal scaled by cos(45deg)
    mesh.position.copy(direction).multiplyScalar(BODY_RADIUS * Math.SQRT1_2)
    mesh.userData.direction = direction.clone()
    mesh.userData.label = label
    worldGroup.add(mesh)
    edgeMeshes.push(mesh)
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
  // Bottom corners: the top-left is Home's, and a roll button there overlapped Home's
  // hit area, which is tested first — so clicking it went Home instead of rolling.
  const ROLL_LAYOUT: { kind: `roll-${RollDirection}`; position: [number, number]; clockwise: boolean }[] = [
    { kind: 'roll-left', position: [-1.35, -1.35], clockwise: false },
    { kind: 'roll-right', position: [1.35, -1.35], clockwise: true },
  ]

  const arrows: OctaOrbArrow[] = []
  // base/hover texture pair per arrow sprite, swapped by setArrowHover
  const arrowMaps = new Map<THREE.Sprite, { base: THREE.Texture; hover: THREE.Texture }>()
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
    arrowMaps.set(sprite, { base: arrowBaseMap, hover: arrowHoverMap })
  })
  const rollMaps: THREE.Texture[] = []
  ROLL_LAYOUT.forEach(({ kind, position, clockwise }) => {
    const base = makeRollTexture(ARROW_BASE_COLOR, clockwise)
    const hover = makeRollTexture(ACCENT_HOVER, clockwise)
    rollMaps.push(base, hover)
    const material = new THREE.SpriteMaterial({ map: base, toneMapped: false, depthTest: false })
    const sprite = new THREE.Sprite(material)
    sprite.scale.setScalar(0.55)
    sprite.position.set(position[0], position[1], OVERLAY_DEPTH)
    sprite.renderOrder = 10
    sprite.userData.kind = kind
    camera.add(sprite)
    arrows.push({ kind, sprite })
    arrowMaps.set(sprite, { base, hover })
  })

  const setVertexHover = (target: THREE.Mesh | null) => {
    vertexMeshes.forEach((mesh) => {
      ;(mesh.material as THREE.MeshBasicMaterial).color.set(mesh === target ? ACCENT_HOVER : ACCENT)
    })
    edgeMeshes.forEach((mesh) => {
      ;(mesh.material as THREE.MeshBasicMaterial).color.set(mesh === target ? ACCENT_HOVER : EDGE_COLOR)
    })
  }
  const setHomeHover = (hovered: boolean) => {
    homeMaterial.map = hovered ? homeHoverMap : homeBaseMap
  }
  let hoveredArrow: THREE.Sprite | null = null
  const setArrowHover = (target: THREE.Sprite | null) => {
    if (hoveredArrow === target) return
    if (hoveredArrow) (hoveredArrow.material as THREE.SpriteMaterial).map = arrowMaps.get(hoveredArrow)!.base
    hoveredArrow = target
    if (hoveredArrow) (hoveredArrow.material as THREE.SpriteMaterial).map = arrowMaps.get(hoveredArrow)!.hover
  }
  const setArrowsVisible = (visible: boolean) => {
    arrows.forEach((arrow) => { arrow.sprite.visible = visible })
  }

  const dispose = () => {
    bodyGeometry.dispose()
    bodyMaterial.dispose()
    vertexGeometry.dispose()
    vertexMeshes.forEach((mesh) => (mesh.material as THREE.MeshBasicMaterial).dispose())
    edgeLineGeometry.dispose()
    edgeLineMaterial.dispose()
    edgeGeometry.dispose()
    edgeMeshes.forEach((mesh) => (mesh.material as THREE.MeshBasicMaterial).dispose())
    homeBaseMap.dispose()
    homeHoverMap.dispose()
    homeMaterial.dispose()
    arrowBaseMap.dispose()
    arrowHoverMap.dispose()
    rollMaps.forEach((map) => map.dispose())
    arrows.forEach((arrow) => (arrow.sprite.material as THREE.SpriteMaterial).dispose())
  }

  return {
    scene,
    worldGroup,
    body,
    camera,
    vertexMeshes,
    edgeMeshes,
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
