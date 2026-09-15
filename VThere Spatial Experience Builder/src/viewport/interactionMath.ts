export type Vector3Tuple = [number, number, number]

const dot = (left: Vector3Tuple, right: Vector3Tuple): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

const subtract = (left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
]

const cross = (left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]

const length = (value: Vector3Tuple): number => Math.hypot(...value)

const normalize = (value: Vector3Tuple): Vector3Tuple => {
  const size = length(value)
  return size === 0 ? [0, 0, 0] : [value[0] / size, value[1] / size, value[2] / size]
}

export const closestPointOnAxis = (
  rayOrigin: Vector3Tuple,
  rayDirection: Vector3Tuple,
  axisOrigin: Vector3Tuple,
  axisDirection: Vector3Tuple,
): number | null => {
  const offset = subtract(axisOrigin, rayOrigin)
  const alignment = dot(axisDirection, rayDirection)
  const rayLengthSquared = dot(rayDirection, rayDirection)
  const axisOffset = dot(axisDirection, offset)
  const rayOffset = dot(rayDirection, offset)
  const denominator = rayLengthSquared - alignment * alignment
  if (Math.abs(denominator) < 1e-6) return null
  return (alignment * rayOffset - rayLengthSquared * axisOffset) / denominator
}

export const angleAroundAxis = (
  point: Vector3Tuple,
  center: Vector3Tuple,
  axis: Vector3Tuple,
): number => {
  const reference: Vector3Tuple = Math.abs(axis[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0]
  const basisU = normalize(cross(reference, axis))
  const basisV = normalize(cross(axis, basisU))
  const relative = subtract(point, center)
  return Math.atan2(dot(relative, basisV), dot(relative, basisU))
}

export const normalizeAngle = (value: number): number => {
  const twoPi = Math.PI * 2
  return ((value % twoPi) + twoPi) % twoPi
}
