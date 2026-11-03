import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { resolveModelUrl } from './assets'
import { buildPlaceholderModel } from './placeholderModels'
import { syncArtefacts } from '../viewport/syncArtefacts'
import { makeObject } from '../project/model'

describe('placeholder models', () => {
  it('stands in for the bench until Bench.glb exists', () => {
    // assets.ts registers stand-ins after the bundled models, so a real Bench.glb would win
    const url = resolveModelUrl('bundled-model-bench')!
    expect(url).toBe('placeholder:bundled-model-bench')

    const bench = buildPlaceholderModel(url)!
    const bounds = new THREE.Box3().setFromObject(bench)
    expect(bounds.min.y).toBeCloseTo(0) // stands on the floor
    expect(bounds.max.y).toBeCloseTo(0.45)
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(1.6)
  })

  it('leaves real model addresses alone', () => {
    expect(buildPlaceholderModel('/assets/Pedestal.glb')).toBeUndefined()
    expect(buildPlaceholderModel('placeholder:nothing-by-this-name')).toBeUndefined()
  })

  it('is drawn in the room straight away, with no file to load', () => {
    const group = new THREE.Group()
    const bench = { ...makeObject('model', 0, 'bundled-model-bench'), id: 'bench-1' }
    syncArtefacts({ group, objects: [bench], selectedId: null })
    expect(group.getObjectByName('bench-1')?.userData.entityId).toBe('bench-1')
  })
})
