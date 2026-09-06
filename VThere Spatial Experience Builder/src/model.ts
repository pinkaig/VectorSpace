export type AssetKind = 'cube' | 'sphere' | 'cylinder'

export interface TransformData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: AssetKind
  transform: TransformData
}

export interface SceneData {
  id: string
  name: string
  objects: SceneObject[]
}

export interface ProjectData {
  schemaVersion: 1
  id: string
  name: string
  scenes: SceneData[]
  activeSceneId: string
}

export const defaultProject = (): ProjectData => ({
  schemaVersion: 1,
  id: 'project-vthere-demo',
  name: 'Tide Lines Exhibition',
  activeSceneId: 'scene-gallery',
  scenes: [{ id: 'scene-gallery', name: 'Gallery', objects: [] }],
})

export const cloneProject = (project: ProjectData): ProjectData => JSON.parse(JSON.stringify(project)) as ProjectData

export const makeObject = (assetKind: AssetKind, index: number): SceneObject => ({
  id: `${assetKind}-${Date.now()}-${index}`,
  name: `${assetKind[0].toUpperCase()}${assetKind.slice(1)} ${index}`,
  assetId: `primitive-${assetKind}`,
  assetKind,
  transform: {
    position: [index * 1.5, 0.8, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
})
