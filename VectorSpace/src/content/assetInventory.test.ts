/**
 * Verifies the accounting the inventory exists to provide: one row per asset
 * rather than per placement, the engine's own loads visible alongside what the
 * manager resolved, and a failed engine load reported rather than hidden.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultProject, type ProjectData, type SceneObject } from '../project/model'
import { assetInventory } from './assetInventory'
import { registerLocalAsset, resolveAsset, retryAsset } from './assetResolution'
import {
  clearEngineAssetRegistry,
  engineEnvironmentId,
  noteEngineLoadFailed,
  noteEngineLoadStarted,
  noteEngineLoadSucceeded,
} from './engineAssetRegistry'

const makeObject = (id: string, assetId: string): SceneObject => ({
  id,
  name: id,
  assetId,
  assetKind: 'model',
  visible: true,
  enabled: true,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
})

const projectWith = (objects: SceneObject[]): ProjectData => {
  const project = defaultProject()
  return { ...project, scenes: [{ ...project.scenes[0], objects }] }
}

const rowFor = (id: string, project?: ProjectData) => assetInventory(project).find((row) => row.id === id)

describe('assetInventory', () => {
  beforeEach(() => clearEngineAssetRegistry())

  it('reports many placements of one asset as a single row', async () => {
    registerLocalAsset('inventory-shared', { url: 'blob:shared', contentType: 'model/gltf-binary' })
    const objects = Array.from({ length: 20 }, (_, index) => makeObject(`obj-${index}`, 'inventory-shared'))
    await retryAsset(objects[0])

    const rows = assetInventory(projectWith(objects)).filter((row) => row.id === 'inventory-shared')

    expect(rows).toHaveLength(1)
    expect(rows[0].placements).toBe(20)
  })

  it('lists a catalog entry nothing has resolved yet, with no status', () => {
    registerLocalAsset('inventory-unresolved', { url: 'blob:unresolved' })

    const row = rowFor('inventory-unresolved')
    expect(row).toBeDefined()
    expect(row?.status).toBeUndefined()
    expect(row?.inEngine).toBe(false)
  })

  it('marks an asset the engine loaded, and keeps the status the manager resolved', async () => {
    registerLocalAsset('inventory-loaded', { url: 'blob:loaded', contentType: 'model/gltf-binary' })
    const object = makeObject('obj-loaded', 'inventory-loaded')
    await retryAsset(object)
    noteEngineLoadStarted({ id: 'inventory-loaded', kind: 'model', url: 'blob:loaded' })
    noteEngineLoadSucceeded('inventory-loaded')

    const row = rowFor('inventory-loaded')
    expect(row?.status).toBe('ready')
    expect(row?.inEngine).toBe(true)
    expect(row?.engineState).toBe('loaded')
    expect(row?.source).toBe('unknown') // neither bundled nor a user- prefixed import
  })

  it('reports a failed engine load instead of leaving the asset looking fine', () => {
    registerLocalAsset('inventory-broken', { url: 'blob:broken' })
    noteEngineLoadStarted({ id: 'inventory-broken', kind: 'model', url: 'blob:broken' })
    noteEngineLoadFailed('inventory-broken', 'Failed to load model "blob:broken"')

    const row = rowFor('inventory-broken')
    expect(row?.engineState).toBe('error')
    expect(row?.engineErrorMessage).toContain('Failed to load model')
  })

  it('includes an environment the engine loaded, which has no catalog entry at all', () => {
    noteEngineLoadStarted({ id: engineEnvironmentId('room_1'), kind: 'environment', url: 'env/room_1.glb' })
    noteEngineLoadSucceeded(engineEnvironmentId('room_1'))

    const row = rowFor('env:room_1')
    expect(row?.kind).toBe('environment')
    expect(row?.source).toBe('environment')
    expect(row?.inEngine).toBe(true)
  })

  it('answers every column except placements when given no project', async () => {
    registerLocalAsset('inventory-noproject', { url: 'blob:noproject', contentType: 'model/gltf-binary' })
    await resolveAsset(makeObject('obj-noproject', 'inventory-noproject'))

    const row = rowFor('inventory-noproject')
    expect(row?.status).toBe('ready')
    expect(row?.placements).toBeUndefined()
  })
})
