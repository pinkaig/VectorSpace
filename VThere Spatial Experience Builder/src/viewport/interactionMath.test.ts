/**
 * @file        interactionMath.test.ts
 * @brief       Unit tests for framework-free viewport interaction mathematics.
 *
 * @responsibility
 * Verifies axis projection, degenerate parallel-ray handling, angle wrapping,
 * and stable rotation-angle calculation without a browser or WebGL context.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
import { describe, expect, it } from 'vitest'
import { angleAroundAxis, closestPointOnAxis, normalizeAngle } from './interactionMath'

describe('viewport interaction math', () => {
  it('finds the closest point on an axis', () => {
    expect(closestPointOnAxis([0, 1, 0], [0, -1, 0], [0, 0, 0], [1, 0, 0])).toBeCloseTo(0)
  })

  it('returns null for a ray parallel to the constrained axis', () => {
    expect(closestPointOnAxis([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0])).toBeNull()
  })

  it('keeps rotation angles continuous across the positive boundary', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5)
  })

  it('calculates a stable angle around an axis', () => {
    expect(angleAroundAxis([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2)
  })
})
