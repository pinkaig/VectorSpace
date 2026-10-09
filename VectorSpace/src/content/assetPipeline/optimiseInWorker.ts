/**
 * @file       optimiseInWorker.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Main-thread entry point for the model optimiser. Starts one worker
 *             per model, hands it the model's files, and resolves with the
 *             optimiseModel result; the worker is terminated afterwards so its
 *             memory (tens of MB for a large scan) is released straight away.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/
import type { OptimiseResult } from './optimiseModel'

export interface OptimiserRequest {
  entryName: string
  files: { name: string; bytes: ArrayBuffer }[]
}

export type OptimiserResponse = OptimiseResult

export const optimiseInWorker = async (entry: File, companions: readonly File[]): Promise<OptimiseResult> => {
  const files = await Promise.all([entry, ...companions].map(async (file) => ({ name: file.name, bytes: await file.arrayBuffer() })))
  const worker = new Worker(new URL('./modelOptimiser.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await new Promise<OptimiseResult>((resolve) => {
      worker.onmessage = (event: MessageEvent<OptimiserResponse>) => resolve(event.data)
      worker.onerror = (event) => resolve({ status: 'failed', reason: `the optimiser stopped (${event.message || 'worker error'})` })
      const request: OptimiserRequest = { entryName: entry.name, files }
      worker.postMessage(request, files.map((file) => file.bytes))
    })
  } finally {
    worker.terminate()
  }
}
