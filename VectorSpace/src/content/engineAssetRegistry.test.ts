/**
 * Verifies the reporting contract the Asset Manager depends on: every engine
 * load is accounted for, a reuse of an already-parsed model is attributable by
 * URL alone, a failure is recorded rather than lost, and repeated loads of one
 * asset are visible as loadCount rather than as separate entries.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearEngineAssetRegistry,
  engineEnvironmentId,
  getEngineAsset,
  listEngineAssets,
  noteEngineAssetUsed,
  noteEngineLoadFailed,
  noteEngineLoadStarted,
  noteEngineLoadSucceeded,
} from './engineAssetRegistry'

describe('engineAssetRegistry', () => {
  beforeEach(() => clearEngineAssetRegistry())

  it('records a load as loading, then loaded', () => {
    noteEngineLoadStarted({ id: 'user-model-1', kind: 'model', url: 'blob:one' })
    expect(getEngineAsset('user-model-1')?.state).toBe('loading')

    noteEngineLoadSucceeded('user-model-1')

    const record = getEngineAsset('user-model-1')
    expect(record?.state).toBe('loaded')
    expect(record?.settledAt).toBeDefined()
  })

  it('records a failure with the loader message instead of dropping it', () => {
    noteEngineLoadStarted({ id: 'broken', kind: 'model', url: 'blob:broken' })
    noteEngineLoadFailed('broken', 'Failed to load model "blob:broken"')

    const record = getEngineAsset('broken')
    expect(record?.state).toBe('error')
    expect(record?.errorMessage).toContain('Failed to load model')
  })

  it('attributes a reuse by URL, since a parse-cache hit knows no assetId', () => {
    noteEngineLoadStarted({ id: 'user-model-1', kind: 'model', url: 'blob:one' })
    noteEngineLoadSucceeded('user-model-1')
    const firstUse = getEngineAsset('user-model-1')!.lastAccessedAt

    noteEngineAssetUsed('blob:one')

    const record = getEngineAsset('user-model-1')!
    expect(record.lastAccessedAt).toBeGreaterThanOrEqual(firstUse)
    expect(listEngineAssets()).toHaveLength(1)
  })

  it('counts repeated loads of one asset as loadCount, not as separate entries', () => {
    noteEngineLoadStarted({ id: 'user-model-1', kind: 'model', url: 'blob:one' })
    noteEngineLoadSucceeded('user-model-1')
    // the same asset under a fresh blob URL, as happens on the next app start
    noteEngineLoadStarted({ id: 'user-model-1', kind: 'model', url: 'blob:two' })

    const records = listEngineAssets()
    expect(records).toHaveLength(1)
    expect(records[0].loadCount).toBe(2)
    expect(records[0].url).toBe('blob:two')
  })

  it('keeps models and environments in one list, each under its own id', () => {
    noteEngineLoadStarted({ id: 'user-model-1', kind: 'model', url: 'blob:one' })
    noteEngineLoadStarted({ id: engineEnvironmentId('room_1'), kind: 'environment', url: 'env/room_1.glb' })

    expect(listEngineAssets().map((record) => record.kind).sort()).toEqual(['environment', 'model'])
    expect(getEngineAsset('env:room_1')?.kind).toBe('environment')
  })

  it('ignores a report for an id that never started, rather than inventing a record', () => {
    noteEngineLoadSucceeded('never-started')
    noteEngineAssetUsed('never-seen-url')

    expect(listEngineAssets()).toHaveLength(0)
  })
})
