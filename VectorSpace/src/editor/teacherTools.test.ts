import { describe, expect, it } from 'vitest'
import { defaultProject } from '../project/model'
import { deserializeProject, serializeProject } from '../project/serializer'
import { addSpot, addStarterObject, markersFor, objectOnSpot, removeSpot, removeThing, setSpotText, spotAt, STARTER_OBJECTS, toggleLock, DEFAULT_SPOT_TEXT, unlockNewObjects } from './teacherTools'
import { createEditorObject, duplicateEditorObject, reparentEditorObject, updateEditorTransform } from './editorOperations'

const start = () => {
  const project = defaultProject()
  return { project, sceneId: project.scenes[0].id }
}
const starter = (id: string) => STARTER_OBJECTS.find((item) => item.id === id)!

describe('suggested spots', () => {
  it('adds a spot on the floor, edits its note and removes it', () => {
    const { project, sceneId } = start()
    const added = addSpot(project, sceneId, [1.234, 3, -2.5])
    const spot = added.project.scenes[0].spots![0]
    expect(spot).toMatchObject({ id: added.spotId, position: [1.23, 0, -2.5], text: DEFAULT_SPOT_TEXT })

    const edited = setSpotText(added.project, sceneId, added.spotId, 'x'.repeat(100))
    expect(edited.scenes[0].spots![0].text).toHaveLength(60)

    expect(removeSpot(edited, sceneId, added.spotId).scenes[0].spots).toEqual([])
  })

  it('numbers spots by their place in the list', () => {
    const { project, sceneId } = start()
    const first = addSpot(project, sceneId, [0, 0, 0], 'One')
    const second = addSpot(first.project, sceneId, [2, 0, 0], 'Two')
    const spots = markersFor(removeSpot(second.project, sceneId, first.spotId).scenes[0], { spots: true, locks: false })
    expect(spots).toEqual([{ kind: 'spot', id: second.spotId, number: 1, text: 'Two', position: [2, 0, 0] }])
  })
})

describe('removing', () => {
  it('finds the spot whose ring was clicked, the nearest when rings overlap', () => {
    const { project, sceneId } = start()
    const first = addSpot(project, sceneId, [0, 0, 0])
    const second = addSpot(first.project, sceneId, [1, 0, 0])
    const scene = second.project.scenes[0]
    expect(spotAt(scene, [0.7, 0, 0])?.id).toBe(second.spotId)
    expect(spotAt(scene, [-0.3, 0, 0.2])?.id).toBe(first.spotId)
    expect(spotAt(scene, [5, 0, 5])).toBeNull()
  })

  it('removes a starter object the teacher placed', () => {
    const { project, sceneId } = start()
    const placed = addStarterObject(project, sceneId, starter('bench'), [1, 0, 1])
    const id = placed.scenes[0].objects.at(-1)!.id
    const after = removeThing(placed, sceneId, id)
    expect(after.scenes[0].objects.map((object) => object.id)).not.toContain(id)
    expect(after.scenes[0].objects).toHaveLength(project.scenes[0].objects.length)
  })
})

describe('copying a locked thing', () => {
  it('makes an unlocked copy and leaves the original locked', () => {
    const { project, sceneId } = start()
    const placed = addStarterObject(project, sceneId, starter('fact-board'), [0, 0, 0])
    const original = placed.scenes[0].objects.at(-1)!
    const copied = duplicateEditorObject(placed, sceneId, original.id)
    const after = unlockNewObjects(placed, copied.project, sceneId)
    const objects = after.scenes[0].objects
    expect(objects.find((object) => object.id === original.id)!.locked).toBe(true)
    expect('locked' in objects.find((object) => object.id === copied.objectId)!).toBe(false)
  })
})

describe('locks and starter objects', () => {
  it('places a starter object where the floor was clicked, locked and named after its kind', () => {
    const { project, sceneId } = start()
    const before = project.scenes[0].objects.length
    const next = addStarterObject(project, sceneId, starter('bench'), [3, 0, 4])
    const bench = next.scenes[0].objects[before]
    expect(next.scenes[0].objects).toHaveLength(before + 1)
    // the real model's id, drawn as a three.js stand-in until Bench.glb is added
    expect(bench).toMatchObject({ name: 'Bench', locked: true, assetKind: 'model', assetId: 'bundled-model-bench' })
    expect([bench.transform.position[0], bench.transform.position[2]]).toEqual([3, 4])
  })

  it('flips a lock, and an unlocked object has no locked field at all', () => {
    const { project, sceneId } = start()
    const placed = addStarterObject(project, sceneId, starter('pedestal'), [0, 0, 0])
    const id = placed.scenes[0].objects.at(-1)!.id
    const unlocked = toggleLock(placed, sceneId, id)
    expect('locked' in unlocked.scenes[0].objects.at(-1)!).toBe(false)
    expect(toggleLock(unlocked, sceneId, id).scenes[0].objects.at(-1)!.locked).toBe(true)
    expect(markersFor(placed.scenes[0], { spots: true, locks: true }).filter((marker) => marker.kind === 'lock')).toHaveLength(1)
  })
})

describe('saving', () => {
  it('keeps spots and locks through a save and load', () => {
    const { project, sceneId } = start()
    const withSpot = addSpot(project, sceneId, [1, 0, 1]).project
    const withLock = addStarterObject(withSpot, sceneId, starter('fact-board'), [2, 0, 2])
    const loaded = deserializeProject(serializeProject(withLock))
    expect(loaded.scenes[0].spots).toEqual(withLock.scenes[0].spots)
    expect(loaded.scenes[0].objects.at(-1)!.locked).toBe(true)
  })

  it('rejects a malformed spot or lock', () => {
    const { project, sceneId } = start()
    const bad = JSON.parse(serializeProject(addSpot(project, sceneId, [0, 0, 0]).project))
    bad.scenes[0].spots[0].position = [0, 0]
    expect(() => deserializeProject(JSON.stringify(bad))).toThrow('invalid spot')

    const badLock = JSON.parse(serializeProject(addStarterObject(project, sceneId, starter('bench'), [0, 0, 0])))
    badLock.scenes[0].objects.at(-1).locked = 'yes'
    expect(() => deserializeProject(JSON.stringify(badLock))).toThrow('invalid scene object')
  })
})

describe('the thing on a spot', () => {
  // a spot at (2, 0, 0) and a box placed at x
  const withBox = (x: number) => {
    const { project, sceneId } = start()
    const added = addSpot(project, sceneId, [2, 0, 0])
    const box = createEditorObject(added.project, sceneId, 'cube')
    const moved = updateEditorTransform(box.project, sceneId, box.objectId!, { position: [x, 0.5, 0] }).project
    return { project: moved, sceneId, boxId: box.objectId!, spot: moved.scenes[0].spots![0] }
  }

  it('is the thing standing inside the ring, and nothing once it is moved off', () => {
    const on = withBox(2.3)
    expect(objectOnSpot(on.project.scenes[0], on.spot)?.id).toBe(on.boxId)
    const off = withBox(4)
    expect(objectOnSpot(off.project.scenes[0], off.spot)).toBeNull()
  })

  it("never counts the teacher's locked things or a thing's children", () => {
    const { project, sceneId, boxId, spot } = withBox(2)
    expect(objectOnSpot(toggleLock(project, sceneId, boxId).scenes[0], spot)).toBeNull()
    const parent = createEditorObject(project, sceneId, 'cube')
    const far = updateEditorTransform(parent.project, sceneId, parent.objectId!, { position: [9, 0, 9] }).project
    const child = reparentEditorObject(far, sceneId, boxId, parent.objectId!).project
    expect(objectOnSpot(child.scenes[0], spot)).toBeNull()
  })
})
