import type { SceneObject } from '../model'

export const WALK_SPEED = 3.6
export const SPRINT_MULTIPLIER = 2.2
export const SPRINT_KEYS = new Set(['ShiftLeft', 'ShiftRight'])
export const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}
// Editor-only walk-mode fly controls (not available during Run simulation, which is
// ground-locked to the authored eye height — see updateWalkCamera's groundLocked flag).
export const VERTICAL_KEYS: Record<string, number> = {
  KeyX: 1,
  KeyC: -1,
}
export const MIN_FLY_HEIGHT = 0.2
// Radians of camera rotation per pixel of mouse movement, shared by drag-to-look
// (editor + un-locked walk) and pointer-lock look (Run simulation).
export const LOOK_SENSITIVITY = 0.0045
export const GIZMO_GAP = 0.15
export const ARROW_LENGTH = 0.725

// Used for the primitives' own material and for the sidebar/palette dot color. GLB models
// render with their own authored materials - this entry only colors their sidebar dot.
const ASSET_COLORS: Record<SceneObject['assetKind'], number> = {
  cube: 0x4ea7a0,
  sphere: 0xe6ad5a,
  cylinder: 0xd66d75,
  model: 0x8a8fa3,
}

export const colorFor = (kind: SceneObject['assetKind']) => ASSET_COLORS[kind]

export const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
}

export const getWalkDirection = (pressedKeys: Iterable<string>) => {
  let x = 0
  let z = 0
  for (const code of pressedKeys) {
    const [keyX, keyZ] = MOVE_KEYS[code] ?? [0, 0]
    x += keyX
    z += keyZ
  }
  return { x, z }
}

export const getVerticalDirection = (pressedKeys: Iterable<string>) => {
  let y = 0
  for (const code of pressedKeys) y += VERTICAL_KEYS[code] ?? 0
  return y
}

