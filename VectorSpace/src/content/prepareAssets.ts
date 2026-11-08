/**
 * @file        prepareAssets.ts
 * @brief       Gets a project's cloud pack models ready before a viewer draws them.
 *
 * @responsibility
 * A saved project names its pack models only by id. Before a viewport mounts, this asks the asset
 * manager where each one lives (ensurePackAssets), then downloads the model so it is in the model
 * cache when the viewport first looks. Each step retries on its own, so one dropped connection does
 * not cost a model. What cannot be got comes back as a named failure with a plain reason, and
 * whether trying again could help, so a screen can say what is wrong instead of drawing a blank.
 *
 * @inputs
 * A ProjectData. Bundled and imported assets need no preparing and are skipped.
 *
 * @outputs
 * A report: the failures (empty when everything is ready).
 *
 * @boundary
 * Owns no state. The address book is assetResolution.ts; the downloaded bytes are modelCache.ts.
 */
import { isPackAssetId } from '../../packages/assets/src/index'
import type { ProjectData } from '../project/model'
import { ensurePackAssets, forgetPackAsset, resolveLocalAssetUrl } from './assetResolution'
import { getCachedModel, loadModel } from './modelCache'

export interface PrepareFailure {
  assetId: string
  /** What the author called the object, so the message names something they recognise. */
  name: string
  reason: string
  /** True when another try could succeed (a dropped connection); false when the asset is gone. */
  retryable: boolean
}

export interface PrepareProgress {
  done: number
  total: number
}

export interface PrepareOptions {
  onProgress?: (progress: PrepareProgress) => void
  /** Tries to download one model before giving up. */
  downloadAttempts?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

/** Every distinct cloud pack model a project places, in a stable order. */
export const collectPackAssetIds = (project: ProjectData): string[] => {
  const ids = new Set<string>()
  project.scenes.forEach((scene) => scene.objects.forEach((object) => {
    if (object.assetKind === 'model' && isPackAssetId(object.assetId)) ids.add(object.assetId)
  }))
  return [...ids].sort()
}

/** True when every pack model is already addressed and downloaded, so a viewer need not wait at all. */
export const isProjectReady = (project: ProjectData): boolean =>
  collectPackAssetIds(project).every((assetId) => {
    const url = resolveLocalAssetUrl(assetId)
    return url !== undefined && getCachedModel(url) !== undefined
  })

const nameFor = (project: ProjectData, assetId: string): string => {
  for (const scene of project.scenes) {
    const object = scene.objects.find((candidate) => candidate.assetId === assetId)
    if (object?.name) return object.name
  }
  return 'A 3D model'
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const prepareProjectAssets = async (project: ProjectData, options: PrepareOptions = {}): Promise<PrepareFailure[]> => {
  const ids = collectPackAssetIds(project)
  if (ids.length === 0) return []
  const attempts = options.downloadAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 500
  const sleep = options.sleep ?? defaultSleep
  let done = 0
  const step = () => { done += 1; options.onProgress?.({ done, total: ids.length }) }
  options.onProgress?.({ done: 0, total: ids.length })

  const outcomes = await ensurePackAssets(ids)
  const failures: PrepareFailure[] = []

  await Promise.all(ids.map(async (assetId) => {
    const outcome = outcomes.get(assetId)
    const name = nameFor(project, assetId)
    if (outcome?.status !== 'found') {
      const gone = outcome?.status === 'missing'
      failures.push({
        assetId,
        name,
        reason: gone ? 'It was removed from its pack.' : 'The server could not be reached.',
        retryable: !gone,
      })
      step()
      return
    }
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await loadModel(outcome.entry.url, undefined, assetId)
        step()
        return
      } catch {
        if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt)
      }
    }
    failures.push({ assetId, name, reason: 'The model file could not be downloaded.', retryable: true })
    step()
  }))
  return failures
}

/** Clear what was remembered about failed assets so the next prepare really asks and downloads again. */
export const resetFailedAssets = (failures: readonly PrepareFailure[]): void => {
  failures.forEach((failure) => forgetPackAsset(failure.assetId))
}
