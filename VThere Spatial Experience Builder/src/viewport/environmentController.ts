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
