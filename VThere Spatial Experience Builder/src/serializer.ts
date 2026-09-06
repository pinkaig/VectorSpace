import { ProjectData, cloneProject, defaultProject } from './model'

const STORAGE_KEY = 'vthere-project-v1'

export const serializeProject = (project: ProjectData): string => JSON.stringify(project, null, 2)

export const deserializeProject = (value: string): ProjectData => {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed) || parsed.schemaVersion !== 1) {
    throw new Error('Unsupported project format')
  }
  return parsed as ProjectData
}

export const loadProject = (): ProjectData => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return defaultProject()
  try {
    return deserializeProject(saved)
  } catch {
    return defaultProject()
  }
}

export const saveProject = (project: ProjectData): void => {
  localStorage.setItem(STORAGE_KEY, serializeProject(project))
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
