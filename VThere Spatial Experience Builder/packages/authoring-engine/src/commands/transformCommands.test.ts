import { describe, expect, it } from 'vitest'
import { defaultProject, ProjectData, SceneObject } from '@vthere/project'
import { createObject } from '../index'
import { ObjectOperationError } from '../objectAccess'
import { TransformValidationError } from './types'
import {
  applyMove,
  applyRotate,
  applyScale,
  createMoveCommand,
  createRotateCommand,
  createScaleCommand,
  Vector3Tuple,
} from './transformCommands'

const SCENE = 'scene-gallery'
const ids = { nextId: () => 'obj-0' }

/** A project holding one cube at obj-0 with a deliberately non-default transform. */
const buildProject = (): ProjectData => {
  const project = createObject(defaultProject(), { sceneId: SCENE, assetKind: 'cube' }, ids).project
  const object = project.scenes[0].objects[0]
  object.transform = { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: [2, 2, 2] }
  return project
}

const target = { sceneId: SCENE, objectId: 'obj-0' }
const objectIn = (project: ProjectData): SceneObject => project.scenes[0].objects[0]

describe('stateless transform functions', () => {
  it('writes the new value and leaves the other two components identical', () => {
    const object = objectIn(buildProject())

    const moved = applyMove(object, [9, 8, 7])
    expect(moved.transform.position).toEqual([9, 8, 7])
    expect(moved.transform.rotation).toEqual([0.1, 0.2, 0.3])
    expect(moved.transform.scale).toEqual([2, 2, 2])

    const rotated = applyRotate(object, [1, 1, 1])
    expect(rotated.transform.rotation).toEqual([1, 1, 1])
    expect(rotated.transform.position).toEqual([1, 2, 3])

    const scaled = applyScale(object, [0.5, 0.5, 0.5])
    expect(scaled.transform.scale).toEqual([0.5, 0.5, 0.5])
    expect(scaled.transform.position).toEqual([1, 2, 3])
  })

  it('leaves the source object and its tuples untouched', () => {
    const object = objectIn(buildProject())
    const originalPosition = object.transform.position

    const moved = applyMove(object, [9, 8, 7])

    expect(object.transform.position).toEqual([1, 2, 3])
    expect(moved).not.toBe(object)
    expect(moved.transform).not.toBe(object.transform)
    expect(moved.transform.position).not.toBe(originalPosition)
  })

  it('copies the incoming tuple so the caller cannot mutate it afterwards', () => {
    const object = objectIn(buildProject())
    const incoming: Vector3Tuple = [9, 8, 7]

    const moved = applyMove(object, incoming)
    incoming[0] = 999

    expect(moved.transform.position).toEqual([9, 8, 7])
  })

  it('preserves identity fields such as id, name, and parentId', () => {
    const object = { ...objectIn(buildProject()), parentId: 'some-parent' }

    const moved = applyMove(object, [0, 0, 0])

    expect(moved).toMatchObject({ id: object.id, name: object.name, parentId: 'some-parent' })
  })
})

describe('transform validation', () => {
  const project = buildProject()

  it('rejects non-finite numbers in any component', () => {
    const bad: Vector3Tuple[] = [
      [Number.NaN, 0, 0],
      [0, Number.POSITIVE_INFINITY, 0],
      [0, 0, Number.NEGATIVE_INFINITY],
    ]
    for (const value of bad) {
      expect(() => createMoveCommand(project, target, value)).toThrow(TransformValidationError)
      expect(() => createRotateCommand(project, target, value)).toThrow(TransformValidationError)
      expect(() => createScaleCommand(project, target, value)).toThrow(TransformValidationError)
    }
  })

  it('rejects a zero or negative scale on any axis', () => {
    expect(() => createScaleCommand(project, target, [0, 1, 1])).toThrow(TransformValidationError)
    expect(() => createScaleCommand(project, target, [1, -1, 1])).toThrow(TransformValidationError)
    expect(() => createScaleCommand(project, target, [1, 1, 0])).toThrow(TransformValidationError)
  })

  it('accepts a very small but positive scale', () => {
    expect(() => createScaleCommand(project, target, [1e-6, 1e-6, 1e-6])).not.toThrow()
  })

  it('rejects a tuple that is not exactly three numbers', () => {
    expect(() => createMoveCommand(project, target, [1, 2] as unknown as Vector3Tuple)).toThrow(TransformValidationError)
    expect(() => createMoveCommand(project, target, [1, 2, 3, 4] as unknown as Vector3Tuple)).toThrow(TransformValidationError)
    expect(() => createMoveCommand(project, target, ['1', 2, 3] as unknown as Vector3Tuple)).toThrow(TransformValidationError)
  })

  it('rejects an unresolvable scene or object address', () => {
    expect(() => createMoveCommand(project, { sceneId: 'missing', objectId: 'obj-0' }, [0, 0, 0])).toThrow(ObjectOperationError)
    expect(() => createMoveCommand(project, { sceneId: SCENE, objectId: 'missing' }, [0, 0, 0])).toThrow(ObjectOperationError)
  })

  it('reports a transform failure as an ObjectOperationError too, so one catch covers both', () => {
    expect(() => createMoveCommand(project, target, [Number.NaN, 0, 0])).toThrow(ObjectOperationError)
  })
})

describe('transform command execution and inversion', () => {
  it('produces a new project snapshot without touching the input', () => {
    const project = buildProject()
    const next = createMoveCommand(project, target, [9, 8, 7]).execute(project)

    expect(objectIn(next).transform.position).toEqual([9, 8, 7])
    expect(objectIn(project).transform.position).toEqual([1, 2, 3])
    expect(next).not.toBe(project)
  })

  it('carries a history label describing the action', () => {
    const project = buildProject()
    expect(createMoveCommand(project, target, [9, 8, 7]).label).toBe('Move object')
    expect(createRotateCommand(project, target, [1, 1, 1]).label).toBe('Rotate object')
    expect(createScaleCommand(project, target, [3, 3, 3]).label).toBe('Scale object')
  })

  it('undo is the exact inverse of execute for every channel', () => {
    const project = buildProject()
    const commands = [
      createMoveCommand(project, target, [9, 8, 7]),
      createRotateCommand(project, target, [1.5, 0, -1.5]),
      createScaleCommand(project, target, [0.25, 4, 1]),
    ]

    for (const command of commands) {
      expect(command.undo(command.execute(project))).toEqual(project)
    }
  })

  it('preserves floating point values bit-exactly through execute, undo, and execute', () => {
    const project = buildProject()
    const awkward: Vector3Tuple = [0.1 + 0.2, 1 / 3, -1e-7]
    const command = createMoveCommand(project, target, awkward)

    const applied = command.execute(project)
    expect(objectIn(applied).transform.position[0]).toBe(0.30000000000000004)
    expect(objectIn(applied).transform.position).toEqual(awkward)

    const reverted = command.undo(applied)
    expect(objectIn(reverted).transform.position).toEqual([1, 2, 3])

    const reapplied = command.execute(reverted)
    expect(objectIn(reapplied).transform.position).toEqual(awkward)
  })

  it('does not normalise or clamp rotation angles', () => {
    const project = buildProject()
    const beyondTwoPi: Vector3Tuple = [Math.PI * 4, -Math.PI * 3, 100]

    const applied = createRotateCommand(project, target, beyondTwoPi).execute(project)

    expect(objectIn(applied).transform.rotation).toEqual(beyondTwoPi)
  })

  it('touches only its own target, leaving sibling objects identical', () => {
    let project = buildProject()
    project = createObject(project, { sceneId: SCENE, assetKind: 'sphere' }, { nextId: () => 'obj-1' }).project
    const sibling = project.scenes[0].objects[1]

    const applied = createMoveCommand(project, target, [9, 8, 7]).execute(project)

    expect(applied.scenes[0].objects[1]).toEqual(sibling)
    expect(applied.scenes[0].objects).toHaveLength(2)
  })

  it('reports an unchanged transform as a no-op', () => {
    const project = buildProject()

    expect(createMoveCommand(project, target, [1, 2, 3]).isNoop?.(project)).toBe(true)
    expect(createMoveCommand(project, target, [1, 2, 3.0001]).isNoop?.(project)).toBe(false)
    expect(createScaleCommand(project, target, [2, 2, 2]).isNoop?.(project)).toBe(true)
  })
})
