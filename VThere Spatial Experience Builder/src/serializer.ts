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
const MAX_ZONES = 500
const MAX_RULES = 5_000

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
  // Files written before WHEN→DO rules existed have neither field; both are
  // optional in the schema and default to empty, so schemaVersion stays 1 —
  // the same additive pattern as visible, enabled, and parentId.
  if (!Array.isArray(project.rules)) project.rules = []
  project.scenes.forEach((scene) => {
    if (!scene.environmentId) scene.environmentId = defaultEnvironmentId
    if (!scene.startCamera) scene.startCamera = defaultCameraPose()
    if (!Array.isArray(scene.zones)) scene.zones = []
    scene.objects.forEach((object) => {
      if (typeof object.visible !== 'boolean') object.visible = true
      if (typeof object.enabled !== 'boolean') object.enabled = true
    })
  })
  return project
}

const isTuple = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))

/**
 * Every parentId must reference another object in the same scene, and following
 * parent links must never loop; a cycle would hang any hierarchy traversal.
 */
const validateSceneHierarchy = (scene: ProjectData['scenes'][number]): void => {
  const objectsById = new Map(scene.objects.map((object) => [object.id, object]))
  for (const object of scene.objects) {
    if (object.parentId === undefined) continue
    if (object.parentId === object.id) throw new Error('Project contains an object parented to itself')
    if (!objectsById.has(object.parentId)) throw new Error('Project contains an object whose parent does not exist in its scene')
    const seen = new Set([object.id])
    let parent = objectsById.get(object.parentId)
    while (parent) {
      if (seen.has(parent.id)) throw new Error('Project contains a parent-child cycle')
      seen.add(parent.id)
      parent = parent.parentId === undefined ? undefined : objectsById.get(parent.parentId)
    }
  }
}

/**
 * Zones are spatial, so they belong to a scene. Validated for id uniqueness
 * within the scene and for a shape the zone tracker can actually test against —
 * a malformed extent would silently never match instead of failing loudly.
 */
const validateSceneZones = (scene: ProjectData['scenes'][number], zoneIds: Set<string>): void => {
  if (scene.zones === undefined) return
  if (!Array.isArray(scene.zones)) throw new Error('Project contains an invalid zone list')
  if (scene.zones.length > MAX_ZONES) throw new Error('Project contains too many zones')
  for (const zone of scene.zones) {
    if (!zone || typeof zone !== 'object' || typeof zone.id !== 'string' || !zone.id || zone.id.length > MAX_LABEL_LENGTH || typeof zone.name !== 'string' || zone.name.length > MAX_LABEL_LENGTH || !isTuple(zone.position) || !zone.shape || typeof zone.shape !== 'object') {
      throw new Error('Project contains an invalid zone')
    }
    if (zone.shape.kind === 'box') {
      if (!isTuple(zone.shape.size) || zone.shape.size.some((value) => value <= 0)) throw new Error('Project contains a zone with an invalid box size')
    } else if (zone.shape.kind === 'sphere') {
      if (typeof zone.shape.radius !== 'number' || !Number.isFinite(zone.shape.radius) || zone.shape.radius <= 0) throw new Error('Project contains a zone with an invalid sphere radius')
    } else {
      throw new Error('Project contains a zone with an unknown shape')
    }
    if (zoneIds.has(zone.id)) throw new Error('Project contains duplicate zone IDs')
    zoneIds.add(zone.id)
  }
}

/**
 * Rules are per-project, matching the backend's project_id foreign key. A rule
 * pointing at an object or zone that no longer exists would never fire and would
 * be invisible to the author, so an orphaned reference is rejected at load
 * rather than carried silently.
 */
const validateRules = (project: ProjectData, objectIds: Set<string>, zoneIds: Set<string>): void => {
  if (project.rules === undefined) return
  if (!Array.isArray(project.rules)) throw new Error('Project contains an invalid rule list')
  if (project.rules.length > MAX_RULES) throw new Error('Project contains too many interaction rules')
  const ruleIds = new Set<string>()
  for (const rule of project.rules) {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !rule.id || rule.id.length > MAX_LABEL_LENGTH || !Array.isArray(rule.triggers) || !Array.isArray(rule.actions)) {
      throw new Error('Project contains an invalid interaction rule')
    }
    if (ruleIds.has(rule.id)) throw new Error('Project contains duplicate interaction rule IDs')
    ruleIds.add(rule.id)
    if (rule.triggers.some((trigger) => typeof trigger !== 'string' || trigger.length > MAX_LABEL_LENGTH)) throw new Error('Project contains an interaction rule with an invalid trigger')
    for (const action of rule.actions) {
      if (!action || typeof action !== 'object' || typeof action.kind !== 'string' || !action.kind || action.kind.length > MAX_LABEL_LENGTH) throw new Error('Project contains an interaction rule with an invalid action')
      if (action.params !== undefined && (typeof action.params !== 'object' || action.params === null || Array.isArray(action.params))) throw new Error('Project contains an interaction rule with invalid action parameters')
    }
    if (rule.priority !== undefined && (typeof rule.priority !== 'number' || !Number.isFinite(rule.priority))) throw new Error('Project contains an interaction rule with an invalid priority')
    if (rule.objectId !== undefined && !objectIds.has(rule.objectId)) throw new Error('Project contains an interaction rule referencing an object that does not exist')
    if (rule.zoneId !== undefined && !zoneIds.has(rule.zoneId)) throw new Error('Project contains an interaction rule referencing a zone that does not exist')
  }
}

const validateProject = (parsed: unknown): ProjectData => {
  if (!parsed || typeof parsed !== 'object') throw new Error('Project file must contain a JSON object')
  const candidate = parsed as Partial<ProjectData>
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported project format')
  if (typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > MAX_LABEL_LENGTH || typeof candidate.name !== 'string' || !candidate.name || candidate.name.length > MAX_LABEL_LENGTH) throw new Error('Project identity is invalid')
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length === 0 || candidate.scenes.length > MAX_SCENES) throw new Error('Project must contain between one and 100 scenes')
  if (typeof candidate.activeSceneId !== 'string') throw new Error('Project active scene is invalid')
  const sceneIds = new Set<string>()
  const objectIds = new Set<string>()
  const zoneIds = new Set<string>()
  let objectCount = 0
  for (const scene of candidate.scenes) {
    if (!scene || typeof scene !== 'object' || typeof scene.id !== 'string' || typeof scene.name !== 'string' || scene.id.length > MAX_LABEL_LENGTH || scene.name.length > MAX_LABEL_LENGTH || !Array.isArray(scene.objects)) throw new Error('Project contains an invalid scene')
    if (sceneIds.has(scene.id)) throw new Error('Project contains duplicate scene IDs')
    sceneIds.add(scene.id)
    for (const object of scene.objects) {
      objectCount += 1
      if (objectCount > MAX_OBJECTS) throw new Error('Project contains too many scene objects')
      if (!object || typeof object !== 'object' || typeof object.id !== 'string' || typeof object.name !== 'string' || typeof object.assetId !== 'string' || object.id.length > MAX_LABEL_LENGTH || object.name.length > MAX_LABEL_LENGTH || object.assetId.length > MAX_LABEL_LENGTH || !['cube', 'sphere', 'cylinder', 'model'].includes(object.assetKind) || (object.visible !== undefined && typeof object.visible !== 'boolean') || (object.enabled !== undefined && typeof object.enabled !== 'boolean') || (object.parentId !== undefined && (typeof object.parentId !== 'string' || object.parentId.length > MAX_LABEL_LENGTH)) || !object.transform || !isTuple(object.transform.position) || !isTuple(object.transform.rotation) || !isTuple(object.transform.scale)) throw new Error('Project contains an invalid scene object')
      if (objectIds.has(object.id)) throw new Error('Project contains duplicate object IDs')
      objectIds.add(object.id)
    }
    validateSceneHierarchy(scene)
    validateSceneZones(scene, zoneIds)
  }
  if (!sceneIds.has(candidate.activeSceneId)) throw new Error('Project active scene does not exist')
  // Rules are validated after every scene, so object and zone ids from the whole
  // project are available to check references against.
  validateRules(candidate as ProjectData, objectIds, zoneIds)
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
