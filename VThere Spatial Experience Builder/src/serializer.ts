import { ProjectData, cloneProject, defaultProject } from './model'
import { createLogger } from '../packages/debugging/src/index'

const STORAGE_KEY = 'vthere-project-v1'
const BACKUP_STORAGE_KEY = 'vthere-project-v1-backup'

export type PersistenceResult = 'saved' | 'saved-with-backup' | 'failed'

const logger = createLogger('editor.persistence')

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const serializeProject = (project: ProjectData): string => JSON.stringify(project, null, 2)

export const deserializeProject = (value: string): ProjectData => {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed) || parsed.schemaVersion !== 1) {
    throw new Error('Unsupported project format')
  }
  return parsed as ProjectData
}

export const loadProject = (): ProjectData => {
  const candidates = [[STORAGE_KEY, readStorage(STORAGE_KEY)], [BACKUP_STORAGE_KEY, readStorage(BACKUP_STORAGE_KEY)] as const]
  for (const [source, saved] of candidates) {
    if (!saved) continue
    try {
      logger.debug('Loading project draft', { source })
      return deserializeProject(saved)
    } catch (error) {
      logger.warn('Project draft was invalid; trying the next recovery source', { source, error })
      continue
    }
  }
  logger.info('No valid local project found; creating a clean project')
  return defaultProject()
}

export const saveProject = (project: ProjectData): PersistenceResult => {
  const serialized = serializeProject(project)
  const previous = readStorage(STORAGE_KEY)
  try {
    if (previous) localStorage.setItem(BACKUP_STORAGE_KEY, previous)
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
