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
 * Reading, creating, and teacher "send to student". Rename, delete and publish are not here. Throws if VITE_API_URL is
 * unset: offline mode has no server to ask.
 *
 * @status
 * Current. Used by src/sections/home/ProjectListsSection.tsx.
 */
import { apiFetch, type GetToken } from './client'

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

/** Teachers only: gives the student their own copy of a project or template (named "x (2)" if they already have one). */
export function sendToStudent(getToken: GetToken, projectId: string, studentId: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}/assign`, { method: 'POST', body: { student_id: studentId } }, base)
}
