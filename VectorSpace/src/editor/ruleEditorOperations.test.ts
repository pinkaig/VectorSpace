import { describe, expect, it } from 'vitest'
import { defaultProject, makeObject } from '../model'
import { addEditorClickRule, removeEditorRule } from './ruleEditorOperations'

const setup = () => {
  const project = defaultProject()
  const scene = project.scenes[0]
  const object = makeObject('cube', 0)
  scene.objects.push(object)
  return { project, sceneId: scene.id, objectId: object.id }
}

describe('addEditorClickRule', () => {
  it('saves a message as a text asset and adds a rule that shows it', () => {
    const { project, sceneId, objectId } = setup()
    const { project: next } = addEditorClickRule(project, sceneId, objectId, { action: 'showText', message: 'Hello' })

    expect(next.textAssets).toHaveLength(1)
    expect(next.textAssets?.[0]).toMatchObject({ format: 'plain', content: 'Hello' })
    const [rule] = next.rules ?? []
    expect(rule.triggers).toEqual(['click'])
    expect(rule.actions).toEqual([{ kind: 'showPanel', params: { assetId: next.textAssets?.[0].assetId } }])
  })

  it('leaves the original project untouched so undo restores it', () => {
    const { project, sceneId, objectId } = setup()
    addEditorClickRule(project, sceneId, objectId, { action: 'showText', message: 'Hello' })
    expect(project.textAssets ?? []).toHaveLength(0)
    expect(project.rules ?? []).toHaveLength(0)
  })

  it('adds no text asset for other actions', () => {
    const { project, sceneId, objectId } = setup()
    const { project: next } = addEditorClickRule(project, sceneId, objectId, { action: 'changeColor', color: 0xff0000 })
    expect(next.textAssets ?? []).toHaveLength(0)
  })

  it('removing a message rule also removes its message', () => {
    const { project, sceneId, objectId } = setup()
    const added = addEditorClickRule(project, sceneId, objectId, { action: 'showText', message: 'Hello' })
    const next = removeEditorRule(added.project, added.ruleId).project
    expect(next.rules ?? []).toHaveLength(0)
    expect(next.textAssets ?? []).toHaveLength(0)
  })

  it('keeps a message another rule still shows, and hand-authored text', () => {
    const { project, sceneId, objectId } = setup()
    const first = addEditorClickRule(project, sceneId, objectId, { action: 'showText', message: 'Hello' })
    const [rule] = first.project.rules ?? []
    // a second rule opening the same message, and a hand-authored asset the editor did not make
    first.project.rules = [...(first.project.rules ?? []), { ...rule, id: 'second' }]
    first.project.textAssets = [...(first.project.textAssets ?? []), { assetId: 'intro', name: 'Intro', format: 'plain', lang: 'en', content: 'x' }]
    const afterFirst = removeEditorRule(first.project, first.ruleId).project
    expect(afterFirst.textAssets).toHaveLength(2)
    const afterBoth = removeEditorRule(afterFirst, 'second').project
    expect(afterBoth.textAssets?.map((asset) => asset.assetId)).toEqual(['intro'])
  })
})
