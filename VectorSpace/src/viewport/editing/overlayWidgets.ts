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
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import * as THREE from 'three'
import { createOctaOrb, OctaOrbWidget } from '../../viewport/editing/octaOrb'
import { createAxisIndicator, AxisIndicatorHandle } from '../../viewport/editing/axisIndicator'
import { matchFaceView } from '../../viewport/editing/viewSnap'

// Kept small so they stay out of the way of the editor's floating panels; the targets
// are still clean mouse hits (OctaOrb tips ≈8px across, axis balls ≈7px).
export const OCTAORB_DIM = 88
export const AXIS_INDICATOR_DIM = 60
// Compact sizes for the quad ("Orthographic") layout's quarter-size main pane.
export const OCTAORB_DIM_COMPACT = 72
export const AXIS_INDICATOR_DIM_COMPACT = 52

export interface OverlayDims {
  octaOrb: number
  axisIndicator: number
}

// Single source for widget size: drives the render rects, hit-test rects and the DOM backdrops.
export const overlayDims = (compact: boolean): OverlayDims => compact
  ? { octaOrb: OCTAORB_DIM_COMPACT, axisIndicator: AXIS_INDICATOR_DIM_COMPACT }
  : { octaOrb: OCTAORB_DIM, axisIndicator: AXIS_INDICATOR_DIM }

// Distance from the viewport's right edge, and between stacked widgets.
export const OVERLAY_MARGIN = 8
export const OVERLAY_GAP = 6

/**
 * Both widgets stack in one column on the right edge: the OctaOrb on top, the axis
 * indicator under it (moving up when the OctaOrb is hidden). `insetTop` lets a host
 * start the column below its own floating controls.
 */
export interface OverlayLayout {
  compact: boolean
  insetTop: number
  showOctaOrb: boolean
}

export type OverlayWidget = 'octaOrb' | 'axisIndicator'

export interface OverlayBox {
  left: number
  top: number
  size: number
}

// Position inside the viewport, CSS pixels from its top-left corner.
export const overlayBox = (widget: OverlayWidget, layout: OverlayLayout, width: number): OverlayBox => {
  const dims = overlayDims(layout.compact)
  if (widget === 'octaOrb') {
    return { left: width - OVERLAY_MARGIN - dims.octaOrb, top: layout.insetTop, size: dims.octaOrb }
  }
  const top = layout.insetTop + (layout.showOctaOrb ? dims.octaOrb + OVERLAY_GAP : 0)
  return { left: width - OVERLAY_MARGIN - dims.axisIndicator, top, size: dims.axisIndicator }
}

export interface OverlayRect {
  left: number
  top: number
  right: number
  bottom: number
}

// The same box in client coordinates, for pointer hit-testing.
export const overlayRect = (widget: OverlayWidget, layout: OverlayLayout, rect: DOMRect): OverlayRect => {
  const box = overlayBox(widget, layout, rect.width)
  const left = rect.left + box.left
  const top = rect.top + box.top
  return { left, top, right: left + box.size, bottom: top + box.size }
}

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
  /** Shrinks both widgets — see overlayDims. */
  compact: boolean
  /** Where the widget column starts — see OverlayLayout. */
  insetTop: number
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

// Matches the .octaorb-backdrop / .axis-indicator-backdrop border-radius in styles.css
// (border-box, so the panel fills exactly the box the CSS border is drawn around).
const PANEL_RADIUS = 6
// Same shade the widgets had when the scissor rect was cleared to black under the
// CSS rgba(13, 24, 30, 0.45) tint.
const PANEL_COLOR = 0x060b0e

const roundedRectGeometry = (size: number, radius: number): THREE.ShapeGeometry => {
  const shape = new THREE.Shape()
  shape.moveTo(radius, 0)
  shape.lineTo(size - radius, 0)
  shape.quadraticCurveTo(size, 0, size, radius)
  shape.lineTo(size, size - radius)
  shape.quadraticCurveTo(size, size, size - radius, size)
  shape.lineTo(radius, size)
  shape.quadraticCurveTo(0, size, 0, size - radius)
  shape.lineTo(0, radius)
  shape.quadraticCurveTo(0, 0, radius, 0)
  return new THREE.ShapeGeometry(shape, 8)
}

// making the panel rounded by drawing a rounded rectangle into the scissor rect, then drawing the widget scene on top of it
const createPanel = () => {
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1)
  const material = new THREE.MeshBasicMaterial({ color: PANEL_COLOR, toneMapped: false, depthWrite: false })
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(new THREE.BufferGeometry(), material)
  scene.add(mesh)
  const geometries = new Map<number, THREE.ShapeGeometry>()
  return {
    render: (renderer: THREE.WebGLRenderer, dim: number) => {
      let geometry = geometries.get(dim)
      if (!geometry) {
        geometry = roundedRectGeometry(dim, PANEL_RADIUS)
        geometries.set(dim, geometry)
      }
      mesh.geometry = geometry
      camera.right = dim
      camera.top = dim
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    },
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose())
      material.dispose()
    },
  }
}

type Panel = ReturnType<typeof createPanel>

// Draws into a sub-rect of the canvas. Origin is bottom-left, as WebGL expects.
const renderInRect = (renderer: THREE.WebGLRenderer, panel: Panel, scene: THREE.Object3D, camera: THREE.Camera, x: number, y: number, dim: number) => {
  const { autoClear } = renderer
  renderer.autoClear = false // keep the main pass visible outside the panel's rounded corners
  renderer.setScissorTest(true)
  renderer.setScissor(x, y, dim, dim)
  renderer.setViewport(x, y, dim, dim)
  renderer.clearDepth()
  panel.render(renderer, dim)
  renderer.render(scene, camera)
  renderer.autoClear = autoClear
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
  const panel = createPanel()

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
    render: (renderer, { camera, target, width, height, showOctaOrb, showAxisIndicator, compact, insetTop }) => {
      const layout: OverlayLayout = { compact, insetTop, showOctaOrb }
      // overlayBox measures from the top; WebGL's viewport origin is bottom-left
      if (showOctaOrb) {
        direction.copy(camera.position).sub(target).normalize()
        octaOrb.syncToCamera(direction, camera.up)
        octaOrb.setArrowsVisible(matchFaceView(direction) !== null)
        const box = overlayBox('octaOrb', layout, width)
        renderInRect(renderer, panel, octaOrb.scene, octaOrb.camera, box.left, height - box.top - box.size, box.size)
      }
      if (showAxisIndicator) {
        axisIndicator.group.quaternion.copy(camera.quaternion).invert()
        const box = overlayBox('axisIndicator', layout, width)
        renderInRect(renderer, panel, axisIndicator.group, axisIndicator.camera, box.left, height - box.top - box.size, box.size)
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
      panel.dispose()
      axisIndicator.dispose()
      tooltip.remove()
    },
  }
}
