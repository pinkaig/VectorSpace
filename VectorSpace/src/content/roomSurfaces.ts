/**
 * @file       roomSurfaces.ts
 * @project    Spatial Experience Builder
 * @author     Daniel
 * @brief      Wall and floor styles for room environments, picked per room in "Your rooms".
 *
 *             How it works, step by step:
 *               1. In Blender, the room's faces are put into material slots NAMED after the
 *                  surface they are: "floor", "wall" (any case; Blender's ".001" endings are fine).
 *               2. When a room GLB loads, prepareRoomSurfaces() finds those meshes, remembers
 *                  their own material from Blender, and gives them box-projected UVs (below).
 *               3. styleRoomSurfaces() then puts on the style the room has picked
 *                  (SceneData.surfaces). Switching style just swaps materials: the model is
 *                  NOT loaded again, so it is instant.
 *
 *             Box projection: each face takes the texture from whichever side it faces (floor
 *             from above, walls from the side), measured in metres. So no UV unwrapping in
 *             Blender, and every room tiles at the same real-world size.
 *
 *             To add a style: drop the image in src/content/textures/, import it below and
 *             give it to a style in STYLE_TEXTURES. A style with no entry keeps the model's look.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import * as THREE from 'three'
import type { RoomSurfaces } from '../project/model'
// Textures from ambientCG (CC0, free to use)
import wallPlasterUrl from './textures/wall_plaster.png?url'
import wallBricksUrl from './textures/wall_bricks.png?url'
import wallWoodSidingUrl from './textures/wall_wood_siding.png?url'
import floorWoodUrl from './textures/floor_wood.png?url'
import floorPlanksUrl from './textures/floor_planks.png?url'
import floorTilesUrl from './textures/floor_tiles.png?url'

// The style buttons in "Your rooms", in order
export const ROOM_STYLE_OPTIONS = ['Style 1', 'Style 2', 'Style 3', 'Style 4'] as const
export type RoomStyle = (typeof ROOM_STYLE_OPTIONS)[number]
export type SurfacePart = keyof RoomSurfaces // 'walls' | 'floor'

// A room with no style picked yet
export const DEFAULT_ROOM_SURFACES: RoomSurfaces = { walls: 'Style 1', floor: 'Style 1' }

interface SurfaceTexture {
  url: string        // the texture image
  // how many metres ONE copy of the image covers (bigger = larger pattern).
  // [width, height] for an image that is not square, e.g. the 1024x512 bricks.
  tileSize: number | [number, number]
  roughness: number  // 0 = shiny, 1 = completely matte
}

// Style 1 has no entry: it keeps the room's own plain look from its model.
const STYLE_TEXTURES: Record<SurfacePart, Partial<Record<string, SurfaceTexture>>> = {
  walls: {
    'Style 2': { url: wallPlasterUrl, tileSize: 2, roughness: 0.9 },
    'Style 3': { url: wallBricksUrl, tileSize: [2, 1], roughness: 0.9 },
    'Style 4': { url: wallWoodSidingUrl, tileSize: 2, roughness: 0.8 },
  },
  floor: {
    'Style 2': { url: floorWoodUrl, tileSize: 2, roughness: 0.7 },
    'Style 3': { url: floorPlanksUrl, tileSize: 2, roughness: 0.8 },
    'Style 4': { url: floorTilesUrl, tileSize: 1.5, roughness: 0.5 },
  },
}

// Blender material name -> which part of the room it is. "Floor.001" counts as "floor".
const partOfMaterial = (materialName: string): SurfacePart | null => {
  const name = materialName.toLowerCase().replace(/\.\d+$/, '').trim()
  if (name === 'floor') return 'floor'
  if (name === 'wall' || name === 'walls') return 'walls'
  return null
}

// What a floor/wall mesh keeps in its userData
interface SurfaceData {
  part: SurfacePart
  modelMaterial: THREE.Material                         // its own material from Blender (Styles 1-3)
  styledMaterials: Map<SurfaceTexture, THREE.Material>  // textured ones, made the first time a style is picked
}
const surfaceDataOf = (mesh: THREE.Mesh): SurfaceData | undefined => mesh.userData.roomSurface

// One texture per style, shared by every room (loaded once, never disposed with a room)
const textureCache = new Map<SurfaceTexture, THREE.Texture>()
const textureFor = (style: SurfaceTexture): THREE.Texture => {
  const cached = textureCache.get(style)
  if (cached) return cached
  const texture = new THREE.TextureLoader().load(style.url)
  texture.wrapS = THREE.RepeatWrapping // repeat sideways instead of stretching
  texture.wrapT = THREE.RepeatWrapping // repeat up/down too
  const [width, height] = typeof style.tileSize === 'number' ? [style.tileSize, style.tileSize] : style.tileSize
  texture.repeat.set(1 / width, 1 / height) // UVs are in metres, so this sets the tile size
  texture.colorSpace = THREE.SRGBColorSpace // photos are sRGB; without this they look washed out
  texture.anisotropy = 8 // keeps the floor sharp when viewed at a low angle
  textureCache.set(style, texture)
  return texture
}

// Box projection: write UVs in metres from each vertex's position, picking the two axes
// that lie flat along the face (a floor uses x/z, a wall facing x uses z/y, facing z uses x/y).
const writeBoxUVs = (mesh: THREE.Mesh) => {
  const geometry = mesh.geometry
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const positions = geometry.attributes.position
  const normals = geometry.attributes.normal
  const uvs = new Float32Array(positions.count * 2)

  // matrixWorld carries the GLB's scaling (Fusion exports in cm, so the node is scaled 0.01)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
    normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix)
    const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z)
    let u: number, v: number
    if (ay >= ax && ay >= az) { u = point.x; v = point.z }  // faces up/down: floor, ceiling
    else if (ax >= az) { u = point.z; v = point.y }         // faces along x: a side wall
    else { u = point.x; v = point.y }                       // faces along z: a front/back wall
    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

/** Run once after a room GLB loads: finds the floor/wall meshes and gets them ready to be styled. */
export const prepareRoomSurfaces = (room: THREE.Object3D): void => {
  room.updateMatrixWorld(true) // make sure matrixWorld is current before reading it
  room.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return
    const part = partOfMaterial(child.material.name)
    if (!part) return
    writeBoxUVs(child)
    const data: SurfaceData = { part, modelMaterial: child.material, styledMaterials: new Map() }
    child.userData.roomSurface = data
  })
}

/** Puts the picked wall/floor style on a prepared room. Safe to call again whenever the pick changes. */
export const styleRoomSurfaces = (room: THREE.Object3D, surfaces: RoomSurfaces = DEFAULT_ROOM_SURFACES): void => {
  room.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const data = surfaceDataOf(child)
    if (!data) return
    const style = STYLE_TEXTURES[data.part][surfaces[data.part]]

    let material = data.modelMaterial
    if (style) {
      let styled = data.styledMaterials.get(style)
      if (!styled) {
        styled = new THREE.MeshStandardMaterial({ name: data.modelMaterial.name, map: textureFor(style), roughness: style.roughness, metalness: 0 })
        data.styledMaterials.set(style, styled)
      }
      material = styled
    }
    if (material === child.material) return
    // keep the viewport's wall cut (Walls: Half / Low), which lives on the material
    material.clippingPlanes = (child.material as THREE.Material).clippingPlanes
    material.needsUpdate = true
    child.material = material
  })
}

/** Every material a floor/wall mesh holds, worn or not, so the room can free them all. */
export const roomSurfaceMaterials = (mesh: THREE.Mesh): THREE.Material[] => {
  const data = surfaceDataOf(mesh)
  return data ? [data.modelMaterial, ...data.styledMaterials.values()] : []
}
