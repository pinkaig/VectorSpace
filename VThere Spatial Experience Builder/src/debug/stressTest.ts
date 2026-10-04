/**
 * @file        stressTest.ts
 * @brief       DEBUG ONLY — press F8 to spawn 100 objects for frame-rate testing.
 *
 * Enabled by a single `useStressTestKey(...)` line in App.tsx; comment that line
 * out to disable it. Pair with the viewport's Stats toggle to read FPS against
 * object count. Each press adds one 10×10 block behind the last, as one undo step.
 */
import { useEffect } from 'react'
import { createEditorObject, updateEditorTransform } from '../editor/editorOperations'
import type { AssetKind, ProjectData } from '../model'

const STRESS_KEY = 'F8'
const GRID = 10
// What to spawn. Bundled models use `bundled-model-<file name>` (see assets.ts).
const STRESS_ASSET: { kind: AssetKind; assetId?: string } = { kind: 'model', assetId: 'bundled-model-pedestal' }
// const STRESS_ASSET: { kind: AssetKind; assetId?: string } = { kind: 'cube' }
// Gap between object origins; widen if the model's footprint makes them overlap.
const SPACING = 2.5

export const useStressTestKey = (project: ProjectData, commit: (label: string, next: ProjectData) => void) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== STRESS_KEY || event.repeat) return
      event.preventDefault()
      const sceneId = project.activeSceneId
      const objects = project.scenes.find((scene) => scene.id === sceneId)?.objects ?? []
      const assetId = STRESS_ASSET.assetId ?? `primitive-${STRESS_ASSET.kind}`
      const existing = objects.filter((object) => object.assetId === assetId).length
      // Each batch is a new block further back on Z, so models of any height never stack.
      const block = Math.floor(existing / (GRID * GRID))
      const offset = ((GRID - 1) * SPACING) / 2
      let next = project
      for (let i = 0; i < GRID * GRID; i += 1) {
        const created = createEditorObject(next, sceneId, STRESS_ASSET.kind, STRESS_ASSET.assetId)
        if (!created.objectId) continue
        const restingY = created.project.scenes.find((scene) => scene.id === sceneId)
          ?.objects.find((object) => object.id === created.objectId)?.transform.position[1] ?? 0
        const position: [number, number, number] = [
          (i % GRID) * SPACING - offset,
          restingY,
          Math.floor(i / GRID) * SPACING - offset - block * GRID * SPACING,
        ]
        next = updateEditorTransform(created.project, sceneId, created.objectId, { position }).project
      }
      commit(`Stress test: +${GRID * GRID} objects`, next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [project, commit])
}
