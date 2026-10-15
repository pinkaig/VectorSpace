/**
 * @file        useViewportSettings.ts
 * @author      Chloe Lau Rey En (gizmo mode),
 *              Goh Pin Kai (camera, layout, orthographic, OctaOrb, axes, stats, scale/rotate space)
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       The stage's display and tool settings.
 *
 * @responsibility
 * Holds the choices that change how the stage looks or what the pointer does, and none
 * that change the project: gizmo mode, scale/rotate space, camera mode, layout,
 * orthographic, OctaOrb, axes, stats and the reset-view token.
 *
 * @inputs
 * None.
 *
 * @outputs
 * Each setting and its setter.
 *
 * @boundary
 * Nothing here is saved or undoable. The stage components read these through
 * EditorPage's props.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useState } from 'react'
import type { CameraMode, GizmoMode } from '../../viewport/Viewport'

export function useViewportSettings() {
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('select')
  const [scaleSpace, setScaleSpace] = useState<'world' | 'local'>('world')
  const [rotateSpace, setRotateSpace] = useState<'world' | 'local'>('world')
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  // 'single' (default) is one full-size perspective pane. 'quad' — entered via the
  // Orthographic button — shows that same pane top-left plus Top/Front/Right references.
  const [layoutMode, setLayoutMode] = useState<'quad' | 'single'>('single')
  const [singleViewOrthographic, setSingleViewOrthographic] = useState(false)
  const [showOctaOrb, setShowOctaOrb] = useState(false)
  const [showAxisIndicator, setShowAxisIndicator] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [resetToken, setResetToken] = useState(0)

  return {
    gizmoMode, setGizmoMode,
    scaleSpace, setScaleSpace,
    rotateSpace, setRotateSpace,
    cameraMode, setCameraMode,
    layoutMode, setLayoutMode,
    singleViewOrthographic, setSingleViewOrthographic,
    showOctaOrb, setShowOctaOrb,
    showAxisIndicator, setShowAxisIndicator,
    showStats, setShowStats,
    resetToken, setResetToken,
  }
}
