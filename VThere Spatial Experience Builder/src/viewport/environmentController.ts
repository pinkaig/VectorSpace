/**
 * @file        environmentController.ts
 * @brief       Coordinates asynchronous environment loading and replacement.
 *
 * @responsibility
 * Loads a procedural or GLB environment, reports progress and failures,
 * replaces the environment group, and hands disposal ownership to the active
 * viewport lifecycle.
 *
 * @inputs
 * Environment ID, a Three.js group, status callback, ready callback, and the
 * current environment disposal reference.
 *
 * @outputs
 * An environment load handle with cancellation and status transitions.
 *
 * @ownership
 * Asset construction remains in environments.ts. This module owns lifecycle
 * coordination, not project data or editor state.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
import * as THREE from 'three'
import { loadEnvironment } from '../environments'
import type { EnvStatus } from './renderTypes'

export interface EnvironmentControllerInput {
  group: THREE.Group
  environmentId: string
  currentDispose: { current: (() => void) | null }
  onStatus: (status: EnvStatus) => void
  onReady: () => void
}

export interface EnvironmentLoadHandle {
  cancel: () => void
}

export const loadEnvironmentIntoGroup = ({
  group,
  environmentId,
  currentDispose,
  onStatus,
  onReady,
}: EnvironmentControllerInput): EnvironmentLoadHandle => {
  let cancelled = false

  onStatus({ state: 'loading', progress: 0 })
  loadEnvironment(environmentId, {
    onProgress: (ratio) => {
      if (!cancelled) onStatus({ state: 'loading', progress: ratio })
    },
  })
    .then((loaded) => {
      if (cancelled) {
        loaded.dispose()
        return
      }
      group.clear()
      group.add(loaded.group)
      currentDispose.current?.()
      currentDispose.current = loaded.dispose
      onStatus({ state: 'ready', progress: 1 })
      onReady()
    })
    .catch((error: unknown) => {
      if (cancelled) return
      onStatus({
        state: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to load environment',
      })
    })

  return {
    cancel: () => {
      cancelled = true
    },
  }
}
