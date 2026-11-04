/**
 * @file        remoteProject.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-18
 * @brief       Opening a project from the API by id and saving it back as numbered revisions.
 *
 * @responsibility
 * loadRemoteProject fetches a project and its current scene; ServerSyncTransport sends each
 * queued save to /projects/{id}/versions and reports the outcome in the terms the sync queue
 * understands (done, retry later, or conflict). A registry remembers, per project id, which
 * revision the server last had and whose token to use.
 *
 * @inputs
 * A token source (session.getToken) and a project id; for saving, the queued change.
 *
 * @outputs
 * A ProjectData whose id is the server's project id, so the sync queue can tell which
 * project a change belongs to; and a SyncResult per save.
 *
 * @boundary
 * Does not touch localStorage or the editor. A project this module did not load is not
 * ours: the transport hands it to the fallback (the offline stub), so the editor's
 * local-only project keeps working while signed in to a server.
 *
 * @status
 * Current. A save left in the queue by a previous visit is sent against the revision
 * the next visit loaded, so it replaces whatever was saved in between.
 */
import {
  syncConflict,
  syncPermanentFailure,
  syncRetryableFailure,
  syncSuccess,
  type QueuedChange,
  type SyncResult,
  type SyncTransport,
} from '../../packages/sync/src/index'
import { ApiError, apiFetch, type GetToken } from '../api/client'
import { defaultProject, type ProjectData } from './model'
import { deserializeProject, type ProjectSharing } from './serializer'

type ProjectRow = {
  id: string
  name: string
  status: RemoteProject['status']
  current_version_id: string | null
  mission_brief?: unknown
  slug?: string
  assigned_by_name?: string | null
  review_status?: ProjectSharing['reviewStatus']
  review_comment?: string | null
  review_grade?: string | null
  share_with?: ProjectSharing['shareWith']
}
type VersionSaved = { revision: number }
type VersionDetail = VersionSaved & { data: unknown }

type Registration = { revision: number; getToken: GetToken }
const registry = new Map<string, Registration>()

/** True for a project this browser opened from the server (its saves go to the server). */
export const isRemoteProject = (id: string): boolean => registry.has(id)

export interface RemoteProject {
  project: ProjectData
  revision: number
  status: 'draft' | 'published' | 'archived'
  sharing: ProjectSharing
}

export async function loadRemoteProject(getToken: GetToken, projectId: string, base?: string): Promise<RemoteProject> {
  const row = await apiFetch<ProjectRow>(getToken, `/projects/${projectId}`, {}, base)
  let revision = 0
  let project: ProjectData = { ...defaultProject(), name: row.name }
  if (row.current_version_id) {
    const version = await apiFetch<VersionDetail>(getToken, `/projects/${projectId}/versions/${row.current_version_id}`, {}, base)
    revision = version.revision
    // the project row is the authority on who this is: its id and name win over whatever the
    // saved scene carries (a scene started from a template keeps the template's name), and a
    // save that lacks either still opens
    project = deserializeProject(JSON.stringify({ ...(version.data as object), id: row.id, name: row.name }))
  }
  project = withAssignedBrief({ ...project, id: row.id }, row.mission_brief)
  registry.set(row.id, { revision, getToken })
  const sharing: ProjectSharing = {
    reviewStatus: row.review_status ?? null,
    shareWith: row.share_with ?? null,
    reviewComment: row.review_comment ?? null,
    reviewGrade: row.review_grade ?? null,
    teacherName: row.assigned_by_name ?? null,
    slug: row.slug ?? null,
  }
  return { project, revision, status: row.status, sharing }
}

/**
 * The assignment's brief replaces whatever brief the saved scene carries, so a brief the
 * teacher changes after sending reaches copies already sent. It goes through the same
 * checks as a brief in a file; a brief that fails them is left off rather than stopping
 * the project from opening.
 */
function withAssignedBrief(project: ProjectData, brief: unknown): ProjectData {
  if (!brief) return project
  try {
    return deserializeProject(JSON.stringify({ ...project, missionBrief: brief }))
  } catch {
    return project
  }
}

export class ServerSyncTransport implements SyncTransport<ProjectData> {
  constructor(private readonly fallback: SyncTransport<ProjectData>, private readonly base?: string) {}

  async send(change: QueuedChange<ProjectData>): Promise<SyncResult> {
    const project = change.payload
    const registration = registry.get(project.id)
    if (!registration) return this.fallback.send(change)
    try {
      const saved = await apiFetch<VersionSaved>(
        registration.getToken,
        `/projects/${project.id}/versions`,
        { method: 'POST', body: { base_revision: registration.revision, data: project } },
        this.base,
      )
      registration.revision = saved.revision
      return syncSuccess(saved.revision)
    } catch (error) {
      if (!(error instanceof ApiError)) return syncRetryableFailure() // offline or the server is down
      if (error.status === 409) {
        const current = (error.detail as { current_revision?: number } | undefined)?.current_revision
        return syncConflict(typeof current === 'number' ? current : registration.revision + 1)
      }
      // 5xx may pass; 401/403/404/422 will not change by trying again
      return error.status >= 500 ? syncRetryableFailure() : syncPermanentFailure()
    }
  }
}
