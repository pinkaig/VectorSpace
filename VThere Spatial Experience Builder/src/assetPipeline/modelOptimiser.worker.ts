/**
 * @file       modelOptimiser.worker.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Web Worker that runs optimiseModel off the main thread, so a heavy
 *             import never freezes the editor. Supplies the browser's own image
 *             scaler (createImageBitmap + OffscreenCanvas) for texture resizing.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/
import { optimiseModel, type ResizeImage } from './optimiseModel'
import type { OptimiserRequest, OptimiserResponse } from './optimiseInWorker'

// Native, high-quality downscaling. Colour-space conversion and premultiplication
// are off so data textures (normal/roughness maps) keep their exact values.
const resizeImage: ResizeImage = async (image, mimeType, width, height) => {
  const bitmap = await createImageBitmap(new Blob([image], { type: mimeType }), {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  })
  const canvas = new OffscreenCanvas(width, height)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.9 })
  return new Uint8Array(await blob.arrayBuffer())
}

self.onmessage = async (event: MessageEvent<OptimiserRequest>) => {
  const { entryName, files } = event.data
  let response: OptimiserResponse
  try {
    const result = await optimiseModel({
      entryName,
      files: new Map(files.map((file) => [file.name, new Uint8Array(file.bytes)])),
      resizeImage,
    })
    response = result
  } catch (error) {
    response = { status: 'failed', reason: `optimising failed (${error instanceof Error ? error.message : String(error)})` }
  }
  // Transfer the output rather than copying it back.
  const transfer = response.status === 'optimised' ? [response.glb.buffer as ArrayBuffer] : []
  ;(self as unknown as Worker).postMessage(response, transfer)
}
