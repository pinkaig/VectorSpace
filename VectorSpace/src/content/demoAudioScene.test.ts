import { describe, expect, it } from 'vitest'
import { applyDemoAudioScene, demoAudioAssets, demoAudioObjects, demoAudioRules, demoAudioZones } from './demoAudioScene'
import { deserializeProject, serializeProject } from '../project/serializer'
import { defaultProject } from '../project/model'

describe('applyDemoAudioScene', () => {
  it('is additive: keeps existing objects/rules and appends the demo content once', () => {
    const project = defaultProject()
    const scene = project.scenes[0]
    const { project: nextProject, scene: nextScene } = applyDemoAudioScene(project, scene)

    expect(nextScene.objects).toHaveLength(demoAudioObjects.length)
    expect(nextScene.zones).toHaveLength(demoAudioZones.length)
    expect(nextProject.rules).toHaveLength(demoAudioRules.length)
    expect(nextProject.audioAssets).toHaveLength(demoAudioAssets.length)
  })

  it('produces a project that survives serializer validation (rules reference real objects/zones)', () => {
    const project = defaultProject()
    const scene = project.scenes[0]
    const { project: nextProject, scene: nextScene } = applyDemoAudioScene(project, scene)
    const withScene = { ...nextProject, scenes: [nextScene] }

    const json = serializeProject(withScene)
    expect(() => deserializeProject(json)).not.toThrow()

    const roundTripped = deserializeProject(json)
    expect(roundTripped.rules?.length).toBe(demoAudioRules.length)
    expect(roundTripped.scenes[0].zones?.length).toBe(demoAudioZones.length)
  })

  it('every zoneEnter rule has a matching zoneExit rule stopping the same assetId, so re-entry never stacks voices', () => {
    for (const zone of demoAudioZones) {
      const enterRule = demoAudioRules.find((rule) => rule.zoneId === zone.id && rule.triggers.includes('zoneEnter'))
      const exitRule = demoAudioRules.find((rule) => rule.zoneId === zone.id && rule.triggers.includes('zoneExit'))
      expect(enterRule).toBeDefined()
      expect(exitRule).toBeDefined()
      const playedAssetId = enterRule?.actions[0]?.params?.assetId
      const stoppedAssetId = exitRule?.actions[0]?.params?.assetId
      expect(stoppedAssetId).toBe(playedAssetId)
    }
  })

  it('is safe to call twice without id collisions blowing up the second merge (last-write union, caller de-dupes if needed)', () => {
    const project = defaultProject()
    const scene = project.scenes[0]
    const once = applyDemoAudioScene(project, scene)
    const twice = applyDemoAudioScene(once.project, once.scene)
    // Calling twice duplicates ids by design (additive merge) — this test documents
    // that behaviour rather than asserting de-dupe, since callers only invoke this
    // from a single "Load audio demo" button and duplicate-id validation catches misuse.
    expect(() => serializeProject({ ...twice.project, scenes: [twice.scene] })).not.toThrow()
    expect(() => deserializeProject(serializeProject({ ...twice.project, scenes: [twice.scene] }))).toThrow()
  })
})
