/**
 * @file       roomLayout.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Manages room positioning and adjacency within the room layout,
 *             including grid cell lookup, directional offsets, neighboring
 *             room detection, and available cell allocation.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import { environmentLibrary, type EnvironmentDefinition, type ProjectData, type RoomCell, type SceneData } from '../project/model'

 // The environments the student can add are the ones in template setup the teacher has chosen, the kinds the template's
export const studentRoomEnv = (project: ProjectData): EnvironmentDefinition[] => {
  const allowed = project.validateEnvironment ?? project.scenes.map((room) => room.environmentId)
  return environmentLibrary.filter((env) => allowed.includes(env.id))
}

export type RoomSide = 'north' | 'east' | 'south' | 'west'

export const ROOM_SIDES: readonly RoomSide[] = ['north', 'east', 'south', 'west']

const SIDE_OFFSET: Record<RoomSide, RoomCell> = {
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
}

const isCell = (cell: unknown): cell is RoomCell =>
  !!cell && Number.isInteger((cell as RoomCell).x) && Number.isInteger((cell as RoomCell).z)

const sameCell = (a: RoomCell, b: RoomCell) => a.x === b.x && a.z === b.z

/** A room's cell; a project's first room counts as the origin until it is given one. */
export const roomCell = (project: ProjectData, scene: SceneData): RoomCell | undefined => {
  if (isCell(scene.layout)) return scene.layout
  if (project.scenes[0]?.id === scene.id && !project.scenes.some((item) => isCell(item.layout) && sameCell(item.layout, { x: 0, z: 0 }))) {
    return { x: 0, z: 0 }
  }
  return undefined
}

export const cellBeside = (cell: RoomCell, side: RoomSide): RoomCell =>
  ({ x: cell.x + SIDE_OFFSET[side].x, z: cell.z + SIDE_OFFSET[side].z })

/** Rooms may only fill five cells: the origin and the one cell on each of its sides. */
export const isAllowedCell = (cell: RoomCell): boolean => Math.abs(cell.x) + Math.abs(cell.z) <= 1

export const roomAt =(project: ProjectData, cell: RoomCell): SceneData | undefined =>
  project.scenes.find((scene) => {
    const at = roomCell(project, scene)
    return at !== undefined && sameCell(at, cell)
  })

/**
 * A cell for a room that has none yet (made before the map existed): the first free
 * cell along the row east of the origin, so it never lands on another room.
 */
export const freeCell = (project: ProjectData): RoomCell => {
  for (let x = 0; ; x += 1) {
    if (!roomAt(project, { x, z: 0 })) return { x, z: 0 }
  }
}
