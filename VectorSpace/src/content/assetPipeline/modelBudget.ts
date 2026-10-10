/**
 * @file       modelBudget.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Defines the triangle and texture limits for imported models
 *             and the metrics reported after optimisation. Models within
 *             these limits are imported unchanged.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/

/** Imports with more triangles than this are simplified. */
export const MAX_TRIANGLES = 100_000
/**
 * 100k triangles for an imported model for anything above the max triangles count
 */
export const TARGET_TRIANGLES = 100_000
/** 2k texture size limit */
export const MAX_TEXTURE_SIZE = 2048

export interface ModelStats {
  triangles: number
  /** Largest width or height across all textures; 0 when there are none. */
  maxTextureSize: number
  textureCount: number
  fileBytes: number
}

export interface BudgetCheck {
  overTriangles: boolean
  overTextures: boolean
}

export const checkBudget = (stats: ModelStats): BudgetCheck => ({
  overTriangles: stats.triangles > MAX_TRIANGLES,
  overTextures: stats.maxTextureSize > MAX_TEXTURE_SIZE,
})

export const isWithinBudget = (stats: ModelStats): boolean => {
  const { overTriangles, overTextures } = checkBudget(stats)
  return !overTriangles && !overTextures
}

/** Largest size within `limit` × `limit` that keeps the aspect ratio; never scales up. */
export const fitWithinLimit = (width: number, height: number, limit: number = MAX_TEXTURE_SIZE): [number, number] => {
  const scale = Math.min(1, limit / Math.max(width, height))
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))]
}

const formatCount = (value: number): string =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value)

const formatBytes = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const formatTextureSize = (size: number): string => (size >= 1024 && size % 1024 === 0 ? `${size / 1024}K` : `${size}px`)

/** e.g. "753k → 100k triangles, 8K → 2K textures, 46.4 MB → 4.1 MB" — only what changed. */
export const describeOptimisation = (before: ModelStats, after: ModelStats): string => {
  const parts: string[] = []
  if (after.triangles !== before.triangles) parts.push(`${formatCount(before.triangles)} → ${formatCount(after.triangles)} triangles`)
  if (after.maxTextureSize !== before.maxTextureSize) parts.push(`${formatTextureSize(before.maxTextureSize)} → ${formatTextureSize(after.maxTextureSize)} textures`)
  parts.push(`${formatBytes(before.fileBytes)} → ${formatBytes(after.fileBytes)}`)
  return parts.join(', ')
}
