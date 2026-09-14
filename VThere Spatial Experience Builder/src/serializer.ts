/**
 * @file        serializer.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Project JSON serialization, validation, import, export, and draft recovery.
 *
 * @responsibility
 * Converts ProjectData to and from JSON, validates untrusted project input,
 * and manages current and backup browser draft records.
 *
 * @inputs
 * ProjectData, JSON strings, browser File values, and localStorage records.
 *
 * @outputs
 * Validated ProjectData, persistence results, downloaded JSON, and errors
 * describing rejected input or failed storage operations.
 *
 * @members
 * ProjectLoadResult, serializeProject, deserializeProject, importProjectFile,
 * loadProjectWithSource, saveProject, downloadProject, and copyProject.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/project-serialization.md
 */
import { ProjectData, cloneProject, defaultCameraPose, defaultEnvironmentId, defaultProject } from './model'
import { createLogger } from '../packages/debugging/src/index'

const STORAGE_KEY = 'vthere-project-v1'
const BACKUP_STORAGE_KEY = 'vthere-project-v1-backup'

export type PersistenceResult = 'saved' | 'saved-with-backup' | 'failed'
export type ProjectLoadSource = 'draft' | 'backup' | 'default'
export const MAX_PROJECT_FILE_BYTES = 2_000_000
const MAX_SCENES = 100
const MAX_OBJECTS = 5_000
const MAX_LABEL_LENGTH = 200

export interface ProjectLoadResult {
  project: ProjectData
  source: ProjectLoadSource
}

const logger = createLogger('editor.persistence')

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const serializeProject = (project: ProjectData): string => JSON.stringify(project, null, 2)

/**
 * Adds missing data to older project files so they can still open correctly without crashing.
 */
const backfillScenes = (project: ProjectData): ProjectData => {
  project.scenes.forEach((scene) => {
    if (!scene.environmentId) scene.environmentId = defaultEnvironmentId
    if (!scene.startCamera) scene.startCamera = defaultCameraPose()
  })
  return project
}

const isTuple = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))

const validateProject = (parsed: unknown): ProjectData => {
  if (!parsed || typeof parsed !== 'object') throw new Error('Project file must contain a JSON object')
  const candidate = parsed as Partial<ProjectData>
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported project format')
  if (typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > MAX_LABEL_LENGTH || typeof candidate.name !== 'string' || !candidate.name || candidate.name.length > MAX_LABEL_LENGTH) throw new Error('Project identity is invalid')
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length === 0 || candidate.scenes.length > MAX_SCENES) throw new Error('Project must contain between one and 100 scenes')
  if (typeof candidate.activeSceneId !== 'string') throw new Error('Project active scene is invalid')
  const sceneIds = new Set<string>()
  const objectIds = new Set<string>()
  let objectCount = 0
  for (const scene of candidate.scenes) {
    if (!scene || typeof scene !== 'object' || typeof scene.id !== 'string' || typeof scene.name !== 'string' || scene.id.length > MAX_LABEL_LENGTH || scene.name.length > MAX_LABEL_LENGTH || !Array.isArray(scene.objects)) throw new Error('Project contains an invalid scene')
    if (sceneIds.has(scene.id)) throw new Error('Project contains duplicate scene IDs')
    sceneIds.add(scene.id)
    for (const object of scene.objects) {
      objectCount += 1
      if (objectCount > MAX_OBJECTS) throw new Error('Project contains too many scene objects')
      if (!object || typeof object !== 'object' || typeof object.id !== 'string' || typeof object.name !== 'string' || typeof object.assetId !== 'string' || object.id.length > MAX_LABEL_LENGTH || object.name.length > MAX_LABEL_LENGTH || object.assetId.length > MAX_LABEL_LENGTH || !['cube', 'sphere', 'cylinder'].includes(object.assetKind) || !object.transform || !isTuple(object.transform.position) || !isTuple(object.transform.rotation) || !isTuple(object.transform.scale)) throw new Error('Project contains an invalid scene object')
      if (objectIds.has(object.id)) throw new Error('Project contains duplicate object IDs')
      objectIds.add(object.id)
    }
  }
  if (!sceneIds.has(candidate.activeSceneId)) throw new Error('Project active scene does not exist')
  return backfillScenes(parsed as ProjectData)
}

export const deserializeProject = (value: string): ProjectData => {
  try {
    return validateProject(JSON.parse(value) as unknown)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Project file contains invalid JSON')
    throw error
  }
}

export const importProjectFile = async (file: File): Promise<ProjectData> => {
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error('Project file is too large')
  if (file.type && file.type !== 'application/json' && file.type !== 'text/json') throw new Error('Choose a JSON project file')
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a .json project file')
  return deserializeProject(await file.text())
}

export const loadProjectWithSource = (): ProjectLoadResult => {
  const candidates = [[STORAGE_KEY, readStorage(STORAGE_KEY)], [BACKUP_STORAGE_KEY, readStorage(BACKUP_STORAGE_KEY)] as const]
  for (const [source, saved] of candidates) {
    if (!saved) continue
    try {
      logger.debug('Loading project draft', { source })
      return { project: deserializeProject(saved), source: source === STORAGE_KEY ? 'draft' : 'backup' }
    } catch (error) {
      logger.warn('Project draft was invalid; trying the next recovery source', { source, error })
      continue
    }
  }
  logger.info('No valid local project found; creating a clean project')
  return { project: defaultProject(), source: 'default' }
}

export const loadProject = (): ProjectData => loadProjectWithSource().project

export const saveProject = (project: ProjectData): PersistenceResult => {
  const serialized = serializeProject(project)
  const previous = readStorage(STORAGE_KEY)
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, previous ?? serialized)
    localStorage.setItem(STORAGE_KEY, serialized)
    return 'saved'
  } catch (error) {
    logger.warn('Primary project save failed; trying backup storage', { error })
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, serialized)
      return 'saved-with-backup'
    } catch (backupError) {
      logger.error('Primary and backup project saves failed', { error, backupError })
      return 'failed'
    }
  }
}

export const downloadProject = (project: ProjectData): void => {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const copyProject = (project: ProjectData): ProjectData => cloneProject(project)
