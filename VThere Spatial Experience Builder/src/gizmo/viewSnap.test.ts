import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { EDGE_VIEWS, FACE_VIEWS, matchEdgeView, matchFaceView, nudgeView, upFor } from './viewSnap'

const labelFor = (direction: THREE.Vector3): string | undefined =>
  FACE_VIEWS.find((face) => face.direction.distanceTo(direction) < 1e-6)?.label

describe('nudgeView', () => {
  it('cycles horizontally through Front -> Right -> Back -> Left -> Front', () => {
    let direction = new THREE.Vector3(0, 0, 1) // FRONT
    let up = upFor(direction)
    const seen: (string | undefined)[] = [labelFor(direction)]
    for (let i = 0; i < 4; i++) {
      const next = nudgeView(direction, up, 'right')
      direction = next.direction
      up = next.up
      seen.push(labelFor(direction))
    }
    expect(seen).toEqual(['FRONT', 'RIGHT', 'BACK', 'LEFT', 'FRONT'])
  })

  it('never lands upside-down after two vertical nudges in the same direction', () => {
    // Front -> Top -> Back: two "up" nudges in a row is a regression-prone case — a
    // naive rotation-composition implementation flips the landing view upside-down here.
    let direction = new THREE.Vector3(0, 0, 1) // FRONT
    let up = upFor(direction)
    ;({ direction, up } = nudgeView(direction, up, 'up'))
    expect(labelFor(direction)).toBe('TOP')
    expect(up).toEqual(upFor(direction))

    ;({ direction, up } = nudgeView(direction, up, 'up'))
    expect(labelFor(direction)).toBe('BACK')
    expect(up).toEqual(upFor(direction)) // must be the canonical (upright) BACK orientation
  })

  it('undoes a left/right nudge within the front/right/back/left ring', () => {
    // Reversibility only holds within the "equatorial" ring, where every face shares
    // the same canonical up — going through a pole (top/bottom) always lands on that
    // pole's one fixed orientation regardless of which side you approached from, so
    // e.g. Right -> up -> Top -> down -> Front, not back to Right. That's intentional:
    // every named view always snaps to a single upright orientation, never a
    // path-dependent one — matching real ViewCube-style navigation widget behavior.
    const start = { direction: new THREE.Vector3(0, 0, 1), up: upFor(new THREE.Vector3(0, 0, 1)) } // FRONT
    const forward = nudgeView(start.direction, start.up, 'right')
    const back = nudgeView(forward.direction, forward.up, 'left')
    expect(back.direction.distanceTo(start.direction)).toBeLessThan(1e-6)
    expect(back.up.distanceTo(start.up)).toBeLessThan(1e-6)
  })

  it('always lands exactly on one of the six canonical faces', () => {
    for (const face of FACE_VIEWS) {
      const up = upFor(face.direction)
      for (const way of ['up', 'down', 'left', 'right'] as const) {
        const next = nudgeView(face.direction, up, way)
        expect(matchFaceView(next.direction)).not.toBeNull()
        expect(next.up).toEqual(upFor(next.direction))
      }
    }
  })
})

describe('EDGE_VIEWS', () => {
  it('has the 12 cube edges with vertical-first labels', () => {
    const labels = EDGE_VIEWS.map((edge) => edge.label)
    expect(labels).toHaveLength(12)
    expect(new Set(labels).size).toBe(12)
    expect(labels).toEqual(expect.arrayContaining(['TOP-FRONT', 'BOTTOM-FRONT', 'LEFT-BACK', 'RIGHT-FRONT']))
  })

  it('looks along the diagonal between its two faces and matches only as an edge', () => {
    const topFront = EDGE_VIEWS.find((edge) => edge.label === 'TOP-FRONT')!
    expect(topFront.direction.distanceTo(new THREE.Vector3(0, 1, 1).normalize())).toBeLessThan(1e-6)
    expect(EDGE_VIEWS[matchEdgeView(topFront.direction)!].label).toBe('TOP-FRONT')
    expect(matchFaceView(topFront.direction)).toBeNull()
    expect(matchEdgeView(new THREE.Vector3(0, 0, 1))).toBeNull()
  })
})
