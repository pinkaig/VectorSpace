import { ProjectData, cloneProject, defaultProject } from './model'

const STORAGE_KEY = 'vthere-project-v1'
const BACKUP_STORAGE_KEY = 'vthere-project-v1-backup'

export type PersistenceResult = 'saved' | 'saved-with-backup' | 'failed'

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
  const candidates = [readStorage(STORAGE_KEY), readStorage(BACKUP_STORAGE_KEY)]
  for (const saved of candidates) {
    if (!saved) continue
    try {
      return deserializeProject(saved)
    } catch {
      continue
    }
  }
  return defaultProject()
}

export const saveProject = (project: ProjectData): PersistenceResult => {
  const serialized = serializeProject(project)
  const previous = readStorage(STORAGE_KEY)
  try {
    if (previous) localStorage.setItem(BACKUP_STORAGE_KEY, previous)
    localStorage.setItem(STORAGE_KEY, serialized)
    return 'saved'
  } catch {
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, serialized)
      return 'saved-with-backup'
    } catch {
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
