/**
 * @file        transformCommands.ts
 * @brief       Stateless move/rotate/scale functions and their reversible commands.
 *
 * @responsibility
 * Validates authored transform values, applies them to a SceneObject without
 * mutating the original, and packages each edit as a command that can be
 * executed and undone against a ProjectData snapshot.
 *
 * @inputs
 * ProjectData snapshots, { sceneId, objectId } addresses, and three-number
 * position, rotation, or scale tuples.
 *
 * @outputs
 * New SceneObject values, ProjectCommand instances, and TransformValidationError
 * for values the project may not store.
 *
 * @ownership
 * Owns transform validity and reversal semantics. It does not own history
 * storage (commandService.ts), renderer preview state (the viewport interaction
 * controller), or persistence.
 *
 * @testing
 * Covered by transformCommands.test.ts for precision, rejection, and inversion.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import { ProjectData, SceneObject, cloneProject } from '@vectorspace/project'
import { ObjectTargetInput, requireObject } from '../objectAccess'
import { ProjectCommand, TransformValidationError } from './types'

export type Vector3Tuple = [number, number, number]

/** Which transform component a command writes. */
export type TransformChannel = 'position' | 'rotation' | 'scale'

// Mirrors the isTuple check in src/serializer.ts: a stored transform component
// is always exactly three finite numbers, so NaN and +/-Infinity are rejected
// here rather than being written into a project that can no longer be loaded.
const isFiniteTriple = (value: unknown): value is Vector3Tuple =>
  Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))

const requireFiniteTriple = (channel: TransformChannel, value: Vector3Tuple): Vector3Tuple => {
  if (!isFiniteTriple(value)) {
    throw new TransformValidationError(`Transform ${channel} must be three finite numbers`)
  }
  // A zero or negative scale collapses or mirrors the object's matrix, and the
  // gizmo cannot recover a usable handle from it.
  if (channel === 'scale' && value.some((item) => item <= 0)) {
    throw new TransformValidationError('Transform scale must be greater than zero on every axis')
  }
  return [value[0], value[1], value[2]]
}

const writeChannel = (object: SceneObject, channel: TransformChannel, value: Vector3Tuple): SceneObject => ({
  ...object,
  transform: { ...object.transform, [channel]: requireFiniteTriple(channel, value) },
})

export const applyMove = (object: SceneObject, position: Vector3Tuple): SceneObject =>
  writeChannel(object, 'position', position)

export const applyRotate = (object: SceneObject, rotation: Vector3Tuple): SceneObject =>
  writeChannel(object, 'rotation', rotation)

export const applyScale = (object: SceneObject, scale: Vector3Tuple): SceneObject =>
  writeChannel(object, 'scale', scale)

const sameTriple = (left: Vector3Tuple, right: Vector3Tuple): boolean =>
  left[0] === right[0] && left[1] === right[1] && left[2] === right[2]

// Replaces one object inside a fresh project snapshot. The mapper receives the
// cloned object and returns its replacement, so the caller never mutates input.
const writeObject = (
  project: ProjectData,
  target: ObjectTargetInput,
  map: (object: SceneObject) => SceneObject,
): ProjectData => {
  const next = cloneProject(project)
  const { scene, index } = requireObject(next, target)
  scene.objects[index] = map(scene.objects[index])
  return next
}

const createTransformCommand = (
  project: ProjectData,
  target: ObjectTargetInput,
  channel: TransformChannel,
  label: string,
  value: Vector3Tuple,
): ProjectCommand => {
  // Resolving the object and validating the value here means an unusable edit
  // fails before any command exists to commit.
  const { object } = requireObject(project, target)
  const after = requireFiniteTriple(channel, value)
  const before: Vector3Tuple = [...object.transform[channel]]

  return {
    label,
    execute: (current) => writeObject(current, target, (item) => writeChannel(item, channel, after)),
    undo: (current) => writeObject(current, target, (item) => writeChannel(item, channel, before)),
    isNoop: (current) => sameTriple(requireObject(current, target).object.transform[channel], after),
  }
}

export const createMoveCommand = (
  project: ProjectData,
  target: ObjectTargetInput,
  position: Vector3Tuple,
): ProjectCommand => createTransformCommand(project, target, 'position', 'Move object', position)

export const createRotateCommand = (
  project: ProjectData,
  target: ObjectTargetInput,
  rotation: Vector3Tuple,
): ProjectCommand => createTransformCommand(project, target, 'rotation', 'Rotate object', rotation)

/**
 * Rotation about a point other than the object's own origin (e.g. the gizmo's
 * visual centre) also moves the origin, so both channels change together. One
 * command keeps that a single undo step instead of a rotate followed by a move.
 */
export const createRotateAboutPivotCommand = (
  project: ProjectData,
  target: ObjectTargetInput,
  rotation: Vector3Tuple,
  position: Vector3Tuple,
): ProjectCommand => {
  const { object } = requireObject(project, target)
  const after = { rotation: requireFiniteTriple('rotation', rotation), position: requireFiniteTriple('position', position) }
  const before = { rotation: [...object.transform.rotation] as Vector3Tuple, position: [...object.transform.position] as Vector3Tuple }
  const write = (values: typeof after) => (item: SceneObject) =>
    writeChannel(writeChannel(item, 'rotation', values.rotation), 'position', values.position)

  return {
    label: 'Rotate object',
    execute: (current) => writeObject(current, target, write(after)),
    undo: (current) => writeObject(current, target, write(before)),
    isNoop: (current) => {
      const { transform } = requireObject(current, target).object
      return sameTriple(transform.rotation, after.rotation) && sameTriple(transform.position, after.position)
    },
  }
}

export const createScaleCommand = (
  project: ProjectData,
  target: ObjectTargetInput,
  scale: Vector3Tuple,
): ProjectCommand => createTransformCommand(project, target, 'scale', 'Scale object', scale)
