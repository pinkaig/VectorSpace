import { describe, expect, it } from 'vitest'
import { defaultProject, ProjectData } from '@vectorspace/project'
import { createCommandTimeline, createObject } from '../index'
import { executeCommand } from './commandService'
import { createMoveCommand, createScaleCommand, Vector3Tuple } from './transformCommands'

const SCENE = 'scene-gallery'
const target = { sceneId: SCENE, objectId: 'obj-0' }

const buildProject = (): ProjectData =>
  createObject(defaultProject(), { sceneId: SCENE, assetKind: 'cube' }, { nextId: () => 'obj-0', nextAttachmentId: () => 'att-0' }).project

const buildTimeline = (project = buildProject()) =>
  createCommandTimeline(project, (state) => JSON.parse(JSON.stringify(state)) as ProjectData)

const positionIn = (project: ProjectData) => project.scenes[0].objects[0].transform.position

/**
 * A gizmo drag emits many pointer-move preview values and one commit on release.
 * Only the released value is handed to the command service; the previews never
 * reach it, which is what makes one drag one history entry.
 */
const simulateDrag = (
  timeline: ReturnType<typeof buildTimeline>,
  previews: Vector3Tuple[],
  released: Vector3Tuple,
) => {
  void previews
  return executeCommand(timeline, (project) => createMoveCommand(project, target, released))
}

describe('one user action, one history entry', () => {
  it('records a single entry for a drag with many intermediate values', () => {
    const timeline = buildTimeline()

    const result = simulateDrag(
      timeline,
      [[0, 0.6, 0], [0.4, 0.6, 0], [0.9, 0.6, 0], [1.4, 0.6, 0]],
      [1.5, 0.6, 0],
    )

    expect(result.status).toBe('committed')
    expect(timeline.past).toHaveLength(1)
    expect(timeline.past[0].label).toBe('Move object')
    expect(positionIn(timeline.current)).toEqual([1.5, 0.6, 0])
  })

  it('records one entry per drag and unwinds them one at a time', () => {
    const timeline = buildTimeline()
    const start = timeline.current

    simulateDrag(timeline, [], [1, 0.6, 0])
    simulateDrag(timeline, [], [2, 0.6, 0])
    simulateDrag(timeline, [], [3, 0.6, 0])

    expect(timeline.past).toHaveLength(3)

    timeline.undo()
    expect(positionIn(timeline.current)).toEqual([2, 0.6, 0])
    timeline.undo()
    expect(positionIn(timeline.current)).toEqual([1, 0.6, 0])
    timeline.undo()
    expect(timeline.current).toEqual(start)
    expect(timeline.canUndo).toBe(false)
  })

  it('redoes a committed drag', () => {
    const timeline = buildTimeline()
    simulateDrag(timeline, [], [1.5, 0.6, 0])

    timeline.undo()
    expect(positionIn(timeline.current)).toEqual([0, 0.55, 0])

    timeline.redo()
    expect(positionIn(timeline.current)).toEqual([1.5, 0.6, 0])
  })
})

describe('rejected commands never reach history', () => {
  it('reports a rejection and leaves the timeline untouched', () => {
    const timeline = buildTimeline()
    const before = timeline.current

    const result = executeCommand(timeline, (project) =>
      createMoveCommand(project, target, [Number.NaN, 0, 0]))

    expect(result.status).toBe('rejected')
    expect(result.error).toBeInstanceOf(Error)
    expect(timeline.past).toHaveLength(0)
    expect(timeline.canUndo).toBe(false)
    expect(timeline.current).toEqual(before)
  })

  it('rejects an invalid scale without recording an entry', () => {
    const timeline = buildTimeline()

    expect(executeCommand(timeline, (project) => createScaleCommand(project, target, [0, 1, 1])).status).toBe('rejected')
    expect(timeline.past).toHaveLength(0)
  })

  it('rejects an unresolvable object without recording an entry', () => {
    const timeline = buildTimeline()

    const result = executeCommand(timeline, (project) =>
      createMoveCommand(project, { sceneId: SCENE, objectId: 'missing' }, [1, 1, 1]))

    expect(result.status).toBe('rejected')
    expect(timeline.past).toHaveLength(0)
  })

  it('does not discard redoable future when a command is rejected', () => {
    const timeline = buildTimeline()
    simulateDrag(timeline, [], [1.5, 0.6, 0])
    timeline.undo()
    expect(timeline.canRedo).toBe(true)

    executeCommand(timeline, (project) => createMoveCommand(project, target, [Number.NaN, 0, 0]))

    expect(timeline.canRedo).toBe(true)
    timeline.redo()
    expect(positionIn(timeline.current)).toEqual([1.5, 0.6, 0])
  })
})

describe('no-op commands never reach history', () => {
  it('reports a drag that ends on its starting transform as unchanged', () => {
    const timeline = buildTimeline()
    const start = positionIn(timeline.current) as Vector3Tuple

    const result = executeCommand(timeline, (project) => createMoveCommand(project, target, [...start]))

    expect(result.status).toBe('unchanged')
    expect(timeline.past).toHaveLength(0)
    expect(timeline.canUndo).toBe(false)
  })

  it('still commits a change smaller than a pixel of drag', () => {
    const timeline = buildTimeline()

    const result = executeCommand(timeline, (project) => createMoveCommand(project, target, [0, 0.55, 1e-9]))

    expect(result.status).toBe('committed')
    expect(timeline.past).toHaveLength(1)
  })
})

describe('history branching', () => {
  it('drops the redoable future once a new command is committed after an undo', () => {
    const timeline = buildTimeline()

    simulateDrag(timeline, [], [1, 0.6, 0]) // A
    simulateDrag(timeline, [], [2, 0.6, 0]) // B
    timeline.undo() // back to A
    expect(timeline.canRedo).toBe(true)

    simulateDrag(timeline, [], [3, 0.6, 0]) // C branches off A

    expect(timeline.canRedo).toBe(false)
    expect(positionIn(timeline.current)).toEqual([3, 0.6, 0])

    timeline.undo()
    expect(positionIn(timeline.current)).toEqual([1, 0.6, 0])
    expect(timeline.canRedo).toBe(true)
  })

  it('captures the before-value from live timeline state, not from a stale snapshot', () => {
    const timeline = buildTimeline()
    const stale = timeline.current

    simulateDrag(timeline, [], [5, 0.6, 0])
    timeline.undo()

    // The builder must see the restored state, so this command's inverse returns
    // to the restored position rather than to the discarded [5, 0.6, 0] future.
    let captured: ReturnType<typeof createMoveCommand> | null = null
    executeCommand(timeline, (project) => {
      captured = createMoveCommand(project, target, [7, 0.6, 0])
      return captured
    })

    expect(positionIn(timeline.current)).toEqual([7, 0.6, 0])
    expect(positionIn(captured!.undo(timeline.current))).toEqual([0, 0.55, 0])
    expect(positionIn(stale)).toEqual([0, 0.55, 0])
  })

  it('does not mutate the caller-visible snapshot it was given', () => {
    const timeline = buildTimeline()
    const before = timeline.current

    simulateDrag(timeline, [], [4, 0.6, 0])

    expect(positionIn(before)).toEqual([0, 0.55, 0])
  })
})
