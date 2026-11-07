import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackOutcome } from '../../packages/assets/src/index'
import { makeScene, type ProjectData, type SceneObject } from '../project/model'

const ensurePackAssets = vi.fn<(ids: readonly string[]) => Promise<Map<string, PackOutcome>>>()
const loadModel = vi.fn<(url: string, modifier?: unknown, assetId?: string) => Promise<unknown>>()

vi.mock('./assetResolution', () => ({
  ensurePackAssets: (ids: readonly string[]) => ensurePackAssets(ids),
  forgetPackAsset: vi.fn(),
  resolveLocalAssetUrl: () => undefined,
}))
vi.mock('./modelCache', () => ({
  loadModel: (url: string, modifier?: unknown, assetId?: string) => loadModel(url, modifier, assetId),
  getCachedModel: () => undefined,
}))

const { collectPackAssetIds, isProjectReady, prepareProjectAssets } = await import('./prepareAssets')

const object = (id: string, assetId: string, name = id, assetKind: SceneObject['assetKind'] = 'model'): SceneObject => ({
  id, name, assetId, assetKind, visible: true, enabled: true,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
})

const projectWith = (...objects: SceneObject[]): ProjectData => {
  const scene = makeScene('scene-1', 'Hall')
  scene.objects = objects
  return { schemaVersion: 1, id: 'p', name: 'P', scenes: [scene], activeSceneId: scene.id } as ProjectData
}

const found = (id: string): PackOutcome => ({ status: 'found', entry: { id, url: `https://cdn.test/${id}.glb`, contentType: 'model/gltf-binary' } })
const noWait = { sleep: async () => {}, baseDelayMs: 0 }

describe('prepareProjectAssets', () => {
  beforeEach(() => {
    ensurePackAssets.mockReset()
    loadModel.mockReset()
  })

  it('collects each pack model once, ignoring bundled and primitive assets', () => {
    const project = projectWith(
      object('a', 'pack:x:1'), object('b', 'pack:x:1'), object('c', 'pack:x:2'),
      object('d', 'fossil.glb'), object('e', 'primitive-cube', 'e', 'cube'),
    )
    expect(collectPackAssetIds(project)).toEqual(['pack:x:1', 'pack:x:2'])
    expect(isProjectReady(project)).toBe(false)
    expect(isProjectReady(projectWith(object('d', 'fossil.glb')))).toBe(true)
  })

  it('does nothing for a project with no pack models', async () => {
    expect(await prepareProjectAssets(projectWith(object('d', 'fossil.glb')))).toEqual([])
    expect(ensurePackAssets).not.toHaveBeenCalled()
  })

  it('asks for every pack id, downloads each model, and reports progress', async () => {
    ensurePackAssets.mockResolvedValue(new Map([['pack:x:1', found('pack:x:1')], ['pack:x:2', found('pack:x:2')]]))
    loadModel.mockResolvedValue({})
    const progress: number[] = []
    const failures = await prepareProjectAssets(projectWith(object('a', 'pack:x:1'), object('b', 'pack:x:2')), {
      ...noWait, onProgress: (p) => progress.push(p.done),
    })
    expect(failures).toEqual([])
    expect(ensurePackAssets).toHaveBeenCalledWith(['pack:x:1', 'pack:x:2'])
    expect(loadModel).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([0, 1, 2])
  })

  it('names a removed asset, and says trying again will not help', async () => {
    ensurePackAssets.mockResolvedValue(new Map([['pack:x:1', { status: 'missing' } as PackOutcome]]))
    const [failure] = await prepareProjectAssets(projectWith(object('a', 'pack:x:1', 'Triceratops')), noWait)
    expect(failure).toMatchObject({ name: 'Triceratops', retryable: false })
    expect(failure.reason).toContain('removed')
    expect(loadModel).not.toHaveBeenCalled()
  })

  it('says the server could not be reached, which is worth retrying', async () => {
    ensurePackAssets.mockResolvedValue(new Map([['pack:x:1', { status: 'unreachable', message: 'offline' } as PackOutcome]]))
    const [failure] = await prepareProjectAssets(projectWith(object('a', 'pack:x:1')), noWait)
    expect(failure).toMatchObject({ retryable: true })
    expect(failure.reason).toContain('could not be reached')
  })

  it('retries a download that fails, then succeeds', async () => {
    ensurePackAssets.mockResolvedValue(new Map([['pack:x:1', found('pack:x:1')]]))
    loadModel.mockRejectedValueOnce(new Error('reset')).mockResolvedValueOnce({})
    expect(await prepareProjectAssets(projectWith(object('a', 'pack:x:1')), noWait)).toEqual([])
    expect(loadModel).toHaveBeenCalledTimes(2)
  })

  it('gives up on a download after its tries, and one failure does not stop the others', async () => {
    ensurePackAssets.mockResolvedValue(new Map([['pack:x:1', found('pack:x:1')], ['pack:x:2', found('pack:x:2')]]))
    loadModel.mockImplementation(async (url) => { if (url.includes('x:1')) throw new Error('404'); return {} })
    const failures = await prepareProjectAssets(projectWith(object('a', 'pack:x:1'), object('b', 'pack:x:2')), { ...noWait, downloadAttempts: 2 })
    expect(failures.map((f) => f.assetId)).toEqual(['pack:x:1'])
    expect(failures[0].reason).toContain('could not be downloaded')
  })
})
