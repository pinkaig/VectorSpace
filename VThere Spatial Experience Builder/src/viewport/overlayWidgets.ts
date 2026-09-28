/**
 * @file        overlayWidgets.ts
 * @brief       Builds, draws and disposes the corner navigation widgets (OctaOrb, axis indicator).
 *
 * @responsibility
 * Assembles the OctaOrb view-cube and axis-indicator scenes, draws them into
 * their corner scissor rects after the main pass, owns the OctaOrb's DOM
 * tooltip, and provides the shared screen-space hit-testing geometry (corner
 * rects, NDC conversion) used to route pointer events into them.
 *
 * @inputs
 * No project state. Widget geometry is created through the specialised
 * factories in src/gizmo/; each frame takes the main camera and orbit target.
 *
 * @outputs
 * A ViewportOverlays set (widgets, render, tooltip, dispose) and pure hit-test helpers.
 *
 * @ownership
 * These are presentation/navigation widgets, not editor gizmos or authored
 * artefacts — they never touch ProjectData.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
import * as THREE from 'three'
import { createOctaOrb, OctaOrbWidget } from '../gizmo/octaOrb'
import { createAxisIndicator, AxisIndicatorHandle } from '../gizmo/axisIndicator'
import { matchFaceView } from '../gizmo/viewSnap'

export const OCTAORB_DIM = 128
export const AXIS_INDICATOR_DIM = 84
// Matches the CSS backdrop insets in styles.css.
export const OVERLAY_MARGIN = 8

export type OverlayCorner = 'top-right' | 'bottom-left'

export interface OverlayRect {
  left: number
  top: number
  right: number
  bottom: number
}

export const overlayRect = (corner: OverlayCorner, dim: number, rect: DOMRect): OverlayRect =>
  corner === 'top-right'
    ? { left: rect.right - OVERLAY_MARGIN - dim, top: rect.top + OVERLAY_MARGIN, right: rect.right - OVERLAY_MARGIN, bottom: rect.top + OVERLAY_MARGIN + dim }
    : { left: rect.left + OVERLAY_MARGIN, top: rect.bottom - OVERLAY_MARGIN - dim, right: rect.left + OVERLAY_MARGIN + dim, bottom: rect.bottom - OVERLAY_MARGIN }

export const pointInRect = (x: number, y: number, r: OverlayRect): boolean =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

// Converts a client-space point inside `r` into the [-1, 1] NDC space of the widget's
// own small overlay camera. Writes into `target` to avoid an allocation per pointer event.
export const ndcInRect = (x: number, y: number, r: OverlayRect, target: THREE.Vector2): THREE.Vector2 => {
  target.x = ((x - r.left) / (r.right - r.left)) * 2 - 1
  target.y = -((y - r.top) / (r.bottom - r.top)) * 2 + 1
  return target
}

export interface OverlayRenderInput {
  /** The main perspective camera; the widgets mirror its orientation. */
  camera: THREE.Camera
  /** Orbit pivot, used to derive the OctaOrb's view direction. */
  target: THREE.Vector3
  /** Drawing-buffer size in CSS pixels, matching the main pass's viewport. */
  width: number
  height: number
  showOctaOrb: boolean
  showAxisIndicator: boolean
}

export interface ViewportOverlays {
  octaOrb: OctaOrbWidget
  axisIndicator: AxisIndicatorHandle
  /** Draws the enabled widgets into their corner scissor rects, over the main pass. */
  render: (renderer: THREE.WebGLRenderer, input: OverlayRenderInput) => void
  showOctaOrbTooltip: (label: string, clientX: number, clientY: number) => void
  hideOctaOrbTooltip: () => void
  dispose: () => void
}

// Draws into a sub-rect of the canvas. Origin is bottom-left, as WebGL expects.
const renderInRect = (renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, x: number, y: number, dim: number) => {
  renderer.clearDepth()
  renderer.setScissorTest(true)
  renderer.setScissor(x, y, dim, dim)
  renderer.setViewport(x, y, dim, dim)
  renderer.render(scene, camera)
}

/**
 * Corner overlay widgets: each owns a tiny scene rendered into a scissor rect of the
 * same canvas/renderer (no extra WebGL context), rotated opposite the main camera so
 * it always shows the world's orientation relative to the current view.
 *
 * `mount` hosts the OctaOrb's DOM tooltip; `canvas` is the renderer's element the
 * tooltip is positioned against.
 */
export const createViewportOverlays = (mount: HTMLElement, canvas: HTMLCanvasElement): ViewportOverlays => {
  const octaOrb = createOctaOrb()
  const axisIndicator = createAxisIndicator()
  const direction = new THREE.Vector3()

  // OctaOrb's orb names render here, not as in-scene sprites — at the widget's small
  // on-screen size, world-unit text came out illegibly tiny no matter how it was tuned.
  // A real DOM element is crisp at any size and only needs updating on hover.
  const tooltip = document.createElement('div')
  tooltip.className = 'octaorb-tooltip'
  tooltip.style.display = 'none'
  mount.appendChild(tooltip)

  return {
    octaOrb,
    axisIndicator,
    render: (renderer, { camera, target, width, height, showOctaOrb, showAxisIndicator }) => {
      if (showOctaOrb) {
        direction.copy(camera.position).sub(target).normalize()
        octaOrb.syncToCamera(direction, camera.up)
        octaOrb.setArrowsVisible(matchFaceView(direction) !== null)
        renderInRect(renderer, octaOrb.scene, octaOrb.camera, width - OVERLAY_MARGIN - OCTAORB_DIM, height - OVERLAY_MARGIN - OCTAORB_DIM, OCTAORB_DIM)
      }
      if (showAxisIndicator) {
        axisIndicator.group.quaternion.copy(camera.quaternion).invert()
        renderInRect(renderer, axisIndicator.group, axisIndicator.camera, OVERLAY_MARGIN, OVERLAY_MARGIN, AXIS_INDICATOR_DIM)
      }
      renderer.setScissorTest(false)
    },
    showOctaOrbTooltip: (label, clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      tooltip.textContent = label
      tooltip.style.left = `${clientX - rect.left}px`
      tooltip.style.top = `${clientY - rect.top}px`
      tooltip.style.display = 'block'
    },
    hideOctaOrbTooltip: () => { tooltip.style.display = 'none' },
    dispose: () => {
      octaOrb.dispose()
      axisIndicator.dispose()
      tooltip.remove()
    },
  }
}
