/**
 * @file        projects.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       Ask the API for a person's own projects, and make a new one (blank or from a template).
 *
 * @responsibility
 * Lists projects (kind 'project') and creates one through POST /projects. Templates are listed
 * by templates.ts; the same table, a different kind.
 *
 * @inputs
 * A token source (session.getToken), and for creating: a name and an optional template id.
 *
 * @outputs
 * Project rows, newest edit first; the new Project after a create.
 *
 * @boundary
 * Reading, creating, teacher "send to student" and "assign to class". Rename, delete and publish are not here. Throws if VITE_API_URL is
 * unset: offline mode has no server to ask.
 *
 * @status
 * Current. Used by src/sections/home/ProjectListsSection.tsx.
 */
import { apiFetch, type GetToken } from './client'
import type { MissionBrief } from '../project/model'

/** The fields a landing page needs from GET /projects (the API sends a few more). */
export interface Project {
  id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  /** Set when the project was started from a template. */
  template_id: string | null
  template_revision: number | null
  created_by_name: string
  class_name: string | null
  current_revision: number
  updated_at: string
  /** The latest save: when, and by whom. A copy a teacher sent counts as saved by the teacher. */
  saved_at: string | null
  saved_by_name: string
  template_name: string | null
  assignment_id?: string | null
  task?: string | null
  due_at?: string | null        // "2026-10-30"
  assigned_by_name?: string | null
  /** The teacher's mission brief, from the assignment this copy belongs to. */
  mission_brief?: MissionBrief | null
}

/** One save in a project's history, newest first from GET /projects/:id/versions. */
export interface Revision {
  id: string
  revision: number
  /** Set by the server for a few saves, e.g. "Sent by Ms Tan Hui Min". */
  label: string | null
  created_at: string
  created_by_name: string
}

/** Only the caller's own projects, newest edit first. */
export function listMyProjects(getToken: GetToken, base?: string): Promise<Project[]> {
  return apiFetch<Project[]>(getToken, '/projects?kind=project&mine=true', {}, base)
}

/** A blank project, or a copy of the template's current content when templateId is given. */
export function createProject(getToken: GetToken, name: string, templateId?: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, '/projects', { method: 'POST', body: { name, template_id: templateId } }, base)
}

/** Every save of one project, newest first: the proof that an edit reached the database. */
export function listRevisions(getToken: GetToken, projectId: string, base?: string): Promise<Revision[]> {
  return apiFetch<Revision[]>(getToken, `/projects/${projectId}/versions`, {}, base)
}

/** Teachers only: the teacher's own templates whose name contains q. */
export function listMyTemplates(getToken: GetToken, q: string, base?: string): Promise<Project[]> {
  return apiFetch<Project[]>(getToken, `/projects?${new URLSearchParams({ kind: 'template', mine: 'true', q, limit: '200' })}`, {}, base)
}

/** Teachers only: a new, empty template, filed under a class when classId is given. */
export function createTemplate(getToken: GetToken, name: string, classId?: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, '/projects', { method: 'POST', body: { name, kind: 'template', class_id: classId } }, base)
}

/** Saves data as the project's next revision; baseRevision is the revision it was based on (409 if stale). */
export function saveRevision(getToken: GetToken, projectId: string, baseRevision: number, data: unknown, base?: string): Promise<{ revision: number }> {
  return apiFetch(getToken, `/projects/${projectId}/versions`, { method: 'POST', body: { base_revision: baseRevision, data } }, base)
}

export interface ClassAssignment {
  classId: string
  missionBrief: MissionBrief
  /** "2026-10-30"; shown on the student home as "Due ..." */
  dueAt?: string | null
  task?: string
}

/**
 * Teachers only: assigns the project to a whole class. The class's assignment stores the
 * mission brief, and every student without a copy gets one. Calling it again updates the
 * brief for copies already sent.
 */
export function assignToClass(
  getToken: GetToken,
  projectId: string,
  { classId, missionBrief, dueAt = null, task = '' }: ClassAssignment,
  base?: string,
): Promise<{ assignment_id: string; students: number; sent: number }> {
  return apiFetch(
    getToken,
    `/projects/${projectId}/assign-class`,
    { method: 'POST', body: { class_id: classId, mission_brief: missionBrief, due_at: dueAt, task } },
    base,
  )
}

/** Teachers only: gives the student their own copy of a project or template (named "x (2)" if they already have one). */
export function sendToStudent(getToken: GetToken, projectId: string, studentId: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}/assign`, { method: 'POST', body: { student_id: studentId } }, base)
}
