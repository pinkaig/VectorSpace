/**
 * @file       playMovement.ts
 * @project    VectorSpace
 * @author     Goh Pin Kai
 * @brief      Play-mode movement that glides the visitor instead of stepping per key:
 *             Tap to go (walk to a tapped floor point, with a ring and dotted path) and
 *             Tour spots (walk to stand in front of an exhibit, turning to face it).
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'
import type { CameraPose } from '../project/model'
import { WALK_SPEED } from './viewportTypes'

const MARKER_COLOR = 0x5b4bd6
// Walls aren't solid, so a glide stops this far inside the room's outline.
const WALL_MARGIN = 0.4
// How far from an exhibit's edge the visitor stands, and where its floor marker sits.
const SPOT_STAND_OFF = 1.8
const SPOT_MARKER_OFF = 0.45
const PATH_SPACING = 0.28
const MAX_PATH_DOTS = 80

// Signed shortest turn from one angle to another, in -PI..PI.
const turnBetween = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

interface Glide {
  target: THREE.Vector3
  // only tour glides turn the visitor; tap glides keep looking where they look
  facing?: { yaw: number; pitch: number }
  showMarker: boolean
  onArrive?: () => void
}

export interface PlayMovementInput {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  mount: HTMLElement
  objectsGroup: THREE.Group
  environmentGroup: THREE.Group
  yaw: { current: number }
  pitch: { current: number }
  eyeHeight: { current: number }
  getStartCamera: () => CameraPose
}

export const createPlayMovement = ({ scene, camera, mount, objectsGroup, environmentGroup, yaw, pitch, eyeHeight, getStartCamera }: PlayMovementInput) => {
  let glide: Glide | null = null

  // The tap target: a soft disc, a ring and a centre dot, flat on the floor.
  const markerMaterial = new THREE.MeshBasicMaterial({ color: MARKER_COLOR, side: THREE.DoubleSide })
  const fillMaterial = new THREE.MeshBasicMaterial({ color: MARKER_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.18 })
  const marker = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.33, 40), markerMaterial)
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), markerMaterial)
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.26, 40), fillMaterial)
  for (const mesh of [fill, ring, dot]) {
    mesh.rotation.x = -Math.PI / 2
    marker.add(mesh)
  }
  marker.visible = false
  scene.add(marker)

  // The path to it: a row of small dots from under the visitor to the ring.
  const pathDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 12), markerMaterial, MAX_PATH_DOTS)
  pathDots.count = 0
  pathDots.frustumCulled = false
  scene.add(pathDots)
  const dotMatrix = new THREE.Matrix4()
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
  const unitScale = new THREE.Vector3(1, 1, 1)

  // Keeps a point inside the environment's outline; an empty environment has none.
  const keepInRoom = (point: THREE.Vector3) => {
    const box = new THREE.Box3().setFromObject(environmentGroup)
    if (box.isEmpty()) return point
    point.x = THREE.MathUtils.clamp(point.x, box.min.x + WALL_MARGIN, Math.max(box.min.x + WALL_MARGIN, box.max.x - WALL_MARGIN))
    point.z = THREE.MathUtils.clamp(point.z, box.min.z + WALL_MARGIN, Math.max(box.min.z + WALL_MARGIN, box.max.z - WALL_MARGIN))
    return point
  }

  const startGlide = (x: number, z: number, options: Omit<Glide, 'target'>) => {
    const target = keepInRoom(new THREE.Vector3(x, eyeHeight.current, z))
    glide = { target, ...options }
    marker.position.set(target.x, 0.02, target.z)
  }

  const facingFrom = (from: THREE.Vector3, at: THREE.Vector3) => {
    const toward = at.clone().sub(from)
    return {
      yaw: Math.atan2(-toward.x, -toward.z),
      pitch: THREE.MathUtils.clamp(Math.atan2(toward.y, Math.hypot(toward.x, toward.z)), -0.6, 0.6),
    }
  }

  // Where a tour spot stands, what it looks at, and where its floor marker goes. A null id
  // is the entrance (the scene's start view); an exhibit is approached from the entrance side.
  const spotFor = (objectId: string | null) => {
    const start = getStartCamera()
    if (objectId === null) {
      return {
        stand: new THREE.Vector3(start.position[0], eyeHeight.current, start.position[2]),
        look: new THREE.Vector3(start.target[0], eyeHeight.current, start.target[2]),
        marker: new THREE.Vector3(start.position[0], 0, start.position[2]),
      }
    }
    const mesh = objectsGroup.getObjectByName(objectId)
    if (!mesh) return null
    const box = new THREE.Box3().setFromObject(mesh)
    if (box.isEmpty()) return null
    const centre = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.z) / 2
    const away = new THREE.Vector3(start.position[0] - centre.x, 0, start.position[2] - centre.z)
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1)
    away.normalize()
    const stand = keepInRoom(centre.clone().addScaledVector(away, radius + SPOT_STAND_OFF))
    stand.y = eyeHeight.current
    const markerPoint = centre.clone().addScaledVector(away, radius + SPOT_MARKER_OFF)
    markerPoint.y = 0
    return { stand, look: centre, marker: markerPoint }
  }

  const drawPath = () => {
    if (!glide?.showMarker) {
      pathDots.count = 0
      return
    }
    const from = new THREE.Vector3(camera.position.x, 0.02, camera.position.z)
    const to = new THREE.Vector3(glide.target.x, 0.02, glide.target.z)
    // stop at the ring's edge rather than running through it
    const length = Math.max(0, from.distanceTo(to) - 0.33)
    const count = Math.min(MAX_PATH_DOTS, Math.floor(length / PATH_SPACING))
    const step = to.clone().sub(from).normalize().multiplyScalar(PATH_SPACING)
    const point = from.clone()
    for (let index = 0; index < count; index += 1) {
      point.add(step)
      pathDots.setMatrixAt(index, dotMatrix.compose(point, flat, unitScale))
    }
    pathDots.count = count
    pathDots.instanceMatrix.needsUpdate = true
  }

  return {
    /** Tap to go: walk to where the ray meets the floor (y = 0). */
    tapFloor: (ray: THREE.Ray) => {
      const point = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())
      if (point) startGlide(point.x, point.z, { showMarker: true })
    },
    /** Tour spots: walk to a spot and turn to face it; onArrive runs once there. */
    goToSpot: (objectId: string | null, onArrive?: () => void) => {
      const spot = spotFor(objectId)
      if (!spot) return
      startGlide(spot.stand.x, spot.stand.z, { showMarker: false, facing: facingFrom(spot.stand, spot.look), onArrive })
    },
    /** Walk to `stand` on the floor, turning to face `look` (Tap to go toward a far door). */
    walkTo: (stand: THREE.Vector3, look: THREE.Vector3) => {
      const at = new THREE.Vector3(stand.x, eyeHeight.current, stand.z)
      startGlide(at.x, at.z, { showMarker: true, facing: facingFrom(at, new THREE.Vector3(look.x, eyeHeight.current, look.z)) })
    },
    /** A spot's floor marker in viewport pixels, or null when it's behind the visitor. */
    spotScreenPoint: (objectId: string | null) => {
      const spot = spotFor(objectId)
      if (!spot) return null
      if (spot.marker.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.3) return null
      const ndc = spot.marker.clone().project(camera)
      return { x: ((ndc.x + 1) / 2) * mount.clientWidth, y: ((1 - ndc.y) / 2) * mount.clientHeight }
    },
    cancel: () => {
      glide = null
    },
    /** One frame: move and turn toward the glide's end. `steering` (keys or joystick) cancels it. */
    update: (delta: number, playing: boolean, steering: boolean) => {
      if (!playing || steering) glide = null
      if (glide) {
        const toTarget = glide.target.clone().sub(camera.position)
        toTarget.y = 0
        const distance = toTarget.length()
        const step = WALK_SPEED * 1.2 * delta
        if (distance > step) camera.position.addScaledVector(toTarget, step / distance)
        else camera.position.set(glide.target.x, camera.position.y, glide.target.z)
        let turned = true
        if (glide.facing) {
          const ease = Math.min(1, delta * 4)
          yaw.current += turnBetween(yaw.current, glide.facing.yaw) * ease
          pitch.current += (glide.facing.pitch - pitch.current) * ease
          camera.rotation.order = 'YXZ'
          camera.rotation.set(pitch.current, yaw.current, 0)
          turned = Math.abs(turnBetween(yaw.current, glide.facing.yaw)) < 0.01 && Math.abs(glide.facing.pitch - pitch.current) < 0.01
        }
        if (distance <= step && turned) {
          const arrived = glide
          glide = null
          arrived.onArrive?.()
        }
      }
      marker.visible = !!glide?.showMarker
      drawPath()
    },
    dispose: () => {
      scene.remove(marker, pathDots)
      for (const mesh of [ring, dot, fill]) mesh.geometry.dispose()
      pathDots.geometry.dispose()
      pathDots.dispose()
      markerMaterial.dispose()
      fillMaterial.dispose()
    },
  }
}
