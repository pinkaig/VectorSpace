/**
 * @file        transformMath.ts
 * @brief       Framework-free world-transform composition for the parentId hierarchy.
 *
 * @responsibility
 * Composes a SceneObject's world position/rotation/scale from its local
 * transform plus its parentId ancestor chain, and computes the local
 * transform a child needs under a new parent to keep its world pose fixed.
 *
 * @inputs
 * A scene's SceneObject[] and a target object id.
 *
 * @outputs
 * WorldTransform values (quaternion-based) and TransformData values ready to
 * write back onto a SceneObject.
 *
 * @boundary
 * No `three` (or any renderer) dependency — pure vector/quaternion arithmetic
 * only, per the authoring-engine package's zero-dependency boundary. Assumes
 * standard TRS-per-node composition (no shear), the same model the Three.js
 * Object3D hierarchy uses.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import type { SceneObject, TransformData } from '@vthere/project'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface WorldTransform {
  position: Vector3
  quaternion: Quaternion
  scale: Vector3
}

const tupleToVector = ([x, y, z]: readonly [number, number, number]): Vector3 => ({ x, y, z })
const vectorToTuple = ({ x, y, z }: Vector3): [number, number, number] => [x, y, z]

const identityWorld = (): WorldTransform => ({
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
})

/** Intrinsic XYZ Euler order, matching THREE.Euler's default used throughout the viewport. */
export const eulerToQuaternion = ([x, y, z]: readonly [number, number, number]): Quaternion => {
  const cx = Math.cos(x / 2); const sx = Math.sin(x / 2)
  const cy = Math.cos(y / 2); const sy = Math.sin(y / 2)
  const cz = Math.cos(z / 2); const sz = Math.sin(z / 2)
  // XYZ order: q = qX * qY * qZ (Three.js Euler->Quaternion for order 'XYZ')
  return {
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  }
}

export const quaternionToEuler = (q: Quaternion): [number, number, number] => {
  // Matches THREE.Euler.setFromQuaternion for order 'XYZ'.
  const { x, y, z, w } = q
  const m11 = 1 - 2 * (y * y + z * z)
  const m12 = 2 * (x * y - z * w)
  const m13 = 2 * (x * z + y * w)
  const m22 = 1 - 2 * (x * x + z * z)
  const m23 = 2 * (y * z - x * w)
  const m32 = 2 * (y * z + x * w)
  const m33 = 1 - 2 * (x * x + y * y)

  const clamp = (value: number) => Math.min(1, Math.max(-1, value))
  const ey = Math.asin(clamp(m13))
  let ex: number
  let ez: number
  if (Math.abs(m13) < 0.9999999) {
    ex = Math.atan2(-m23, m33)
    ez = Math.atan2(-m12, m11)
  } else {
    ex = Math.atan2(m32, m22)
    ez = 0
  }
  return [ex, ey, ez]
}

export const multiplyQuaternions = (a: Quaternion, b: Quaternion): Quaternion => ({
  x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
  y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
  z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
})

export const invertQuaternion = (q: Quaternion): Quaternion => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })

/** Rotates a vector by a unit quaternion. */
export const rotateVector = (q: Quaternion, v: Vector3): Vector3 => {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y
  const iy = q.w * v.y + q.z * v.x - q.x * v.z
  const iz = q.w * v.z + q.x * v.y - q.y * v.x
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  }
}

const composeStep = (parent: WorldTransform, local: TransformData): WorldTransform => {
  const localPosition = tupleToVector(local.position)
  const localScale = tupleToVector(local.scale)
  const localQuaternion = eulerToQuaternion(local.rotation)
  const scaledLocalPosition: Vector3 = {
    x: localPosition.x * parent.scale.x,
    y: localPosition.y * parent.scale.y,
    z: localPosition.z * parent.scale.z,
  }
  const rotatedPosition = rotateVector(parent.quaternion, scaledLocalPosition)
  return {
    position: {
      x: parent.position.x + rotatedPosition.x,
      y: parent.position.y + rotatedPosition.y,
      z: parent.position.z + rotatedPosition.z,
    },
    quaternion: multiplyQuaternions(parent.quaternion, localQuaternion),
    scale: {
      x: parent.scale.x * localScale.x,
      y: parent.scale.y * localScale.y,
      z: parent.scale.z * localScale.z,
    },
  }
}

/** Composes an object's world transform by walking its parentId chain from the root down. */
export const composeWorldTransform = (objects: readonly SceneObject[], objectId: string): WorldTransform => {
  const object = objects.find((item) => item.id === objectId)
  if (!object) return identityWorld()
  const chain: SceneObject[] = []
  let current: SceneObject | undefined = object
  while (current) {
    chain.unshift(current)
    current = current.parentId === undefined ? undefined : objects.find((item) => item.id === current!.parentId)
  }
  return chain.reduce<WorldTransform>((parentWorld, node) => composeStep(parentWorld, node.transform), identityWorld())
}

/** Recomputes the local TransformData a child needs under `newParentWorld` to keep `childWorld` fixed. */
export const localTransformForNewParent = (childWorld: WorldTransform, newParentWorld: WorldTransform): TransformData => {
  const invParentQuaternion = invertQuaternion(newParentWorld.quaternion)
  const delta: Vector3 = {
    x: childWorld.position.x - newParentWorld.position.x,
    y: childWorld.position.y - newParentWorld.position.y,
    z: childWorld.position.z - newParentWorld.position.z,
  }
  const unrotated = rotateVector(invParentQuaternion, delta)
  const localPosition: Vector3 = {
    x: unrotated.x / newParentWorld.scale.x,
    y: unrotated.y / newParentWorld.scale.y,
    z: unrotated.z / newParentWorld.scale.z,
  }
  const localQuaternion = multiplyQuaternions(invParentQuaternion, childWorld.quaternion)
  const localScale: Vector3 = {
    x: childWorld.scale.x / newParentWorld.scale.x,
    y: childWorld.scale.y / newParentWorld.scale.y,
    z: childWorld.scale.z / newParentWorld.scale.z,
  }
  return {
    position: vectorToTuple(localPosition),
    rotation: quaternionToEuler(localQuaternion),
    scale: vectorToTuple(localScale),
  }
}
