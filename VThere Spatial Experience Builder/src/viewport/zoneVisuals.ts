/**
 * @file        zoneVisuals.ts
 * @brief       Translucent wireframe indicators for authored zones, highlighted while occupied.
 *
 * @responsibility
 * Purely a rendering aid so an author or visitor can see where a When-Do zone
 * actually is and whether the visitor is currently inside it — zones
 * themselves stay logical-only data (ZoneDefinition) consumed by
 * packages/interaction's zoneTracker; this module never affects matching or
 * dispatch. Rebuilt only when the zone list's shape changes (mirrors
 * syncArtefacts.ts's group-reconciliation pattern), and mutated cheaply
 * (color/opacity) on every zoneEnter/zoneExit transition.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/when-do-dispatch-engine.md
 */
import * as THREE from 'three'
import type { ZoneDefinition } from '../../packages/project/src/index'

const IDLE_COLOR = 0x4fa3ff
const OCCUPIED_COLOR = 0x36e27a
const IDLE_OPACITY = 0.08
const OCCUPIED_OPACITY = 0.22

const createZoneGeometry = (shape: ZoneDefinition['shape']): THREE.BufferGeometry =>
  shape.kind === 'sphere'
    ? new THREE.SphereGeometry(shape.radius, 24, 16)
    : new THREE.BoxGeometry(shape.size[0], shape.size[1], shape.size[2])

interface ZoneVisual {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  wireframe: THREE.LineSegments
}

export interface ZoneVisualsHandle {
  /** Rebuilds all zone meshes from scratch. Call only when the zone list itself changed. */
  rebuild(zones: readonly ZoneDefinition[]): void
  /** Cheap per-frame update: recolors meshes whose occupancy changed since the last call. */
  setOccupied(occupiedZoneIds: ReadonlySet<string>): void
  /** Disposes every zone mesh's GPU resources and empties the group. */
  dispose(): void
}

/** Owns a dedicated THREE.Group (added to the scene by the caller) for zone indicator meshes. */
export const createZoneVisuals = (group: THREE.Group): ZoneVisualsHandle => {
  const visuals = new Map<string, ZoneVisual>()
  let lastOccupied = new Set<string>()

  const disposeAll = (): void => {
    for (const { mesh, wireframe } of visuals.values()) {
      mesh.geometry.dispose()
      mesh.material.dispose()
      wireframe.geometry.dispose()
      ;(wireframe.material as THREE.Material).dispose()
    }
    visuals.clear()
    group.clear()
  }

  return {
    rebuild(zones) {
      disposeAll()
      for (const zone of zones) {
        const geometry = createZoneGeometry(zone.shape)
        const material = new THREE.MeshBasicMaterial({
          color: IDLE_COLOR,
          transparent: true,
          opacity: IDLE_OPACITY,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = `zone-visual-${zone.id}`
        mesh.position.set(...zone.position)
        mesh.userData.zoneId = zone.id

        const wireframe = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: IDLE_COLOR, transparent: true, opacity: 0.35 }),
        )
        mesh.add(wireframe)

        group.add(mesh)
        visuals.set(zone.id, { mesh, wireframe })
      }
      lastOccupied = new Set()
    },
    setOccupied(occupiedZoneIds) {
      for (const [zoneId, { mesh, wireframe }] of visuals) {
        const wasOccupied = lastOccupied.has(zoneId)
        const isOccupied = occupiedZoneIds.has(zoneId)
        if (wasOccupied === isOccupied) continue
        const color = isOccupied ? OCCUPIED_COLOR : IDLE_COLOR
        mesh.material.color.setHex(color)
        mesh.material.opacity = isOccupied ? OCCUPIED_OPACITY : IDLE_OPACITY
        ;(wireframe.material as THREE.LineBasicMaterial).color.setHex(color)
      }
      lastOccupied = new Set(occupiedZoneIds)
    },
    dispose: disposeAll,
  }
}
