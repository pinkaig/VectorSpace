/**
 * @file       stressTest.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Provides a debug-only F8 shortcut to spawn 100 objects for
 *             frame-rate testing. Each press adds a 10×10 block behind
 *             the previous block as a single undo step.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/
import { useEffect } from 'react'
import { createEditorObject, updateEditorTransform } from '../editor/editorOperations'
import type { AssetKind, ProjectData } from '../project/model'

const STRESS_KEY = 'F8'
const GRID = 10
// What to spawn. Bundled models use `bundled-model-<file name>`
const STRESS_ASSET: { kind: AssetKind; assetId?: string } = { kind: 'model', assetId: 'bundled-model-pedestal' }
// const STRESS_ASSET: { kind: AssetKind; assetId?: string } = { kind: 'bundled-model-pedestal' }


const SPACING = 2.5 // Gap between object origins

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
