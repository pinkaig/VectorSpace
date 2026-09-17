/**
 * @file        overlayWidgets.ts
 * @brief       Builds and disposes the corner navigation widgets (OctaOrb, axis indicator).
 *
 * @responsibility
 * Assembles the OctaOrb view-cube and axis-indicator scenes and provides the
 * shared screen-space hit-testing geometry (corner rects, NDC conversion) used
 * to route pointer events into them.
 *
 * @inputs
 * No project state. Widget geometry is created through the specialised
 * factories in src/gizmo/.
 *
 * @outputs
 * A ViewportOverlays set (widgets + dispose) and pure hit-test helpers.
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

export interface ViewportOverlays {
  octaOrb: OctaOrbWidget
  axisIndicator: AxisIndicatorHandle
  dispose: () => void
}

export const createViewportOverlays = (): ViewportOverlays => {
  const octaOrb = createOctaOrb()
  const axisIndicator = createAxisIndicator()
  return {
    octaOrb,
    axisIndicator,
    dispose: () => {
      octaOrb.dispose()
      axisIndicator.dispose()
    },
  }
}
