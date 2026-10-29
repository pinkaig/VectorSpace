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
 * Reading, creating, saving content, archiving, deleting drafts, and teacher "send to student".
 * Rename and publish are not here. Throws if VITE_API_URL is unset: offline mode has no server to ask.
 *
 * @status
 * Current. Used by src/sections/home/ProjectListsSection.tsx, the teacher home (New project, the
 * project list) and template setup (Assign saves the rooms and brief).
 */
import { apiFetch, type GetToken } from './client'
import { listMyStudents } from './classes'

/** The fields a landing page needs from GET /projects (the API sends a few more). */
export interface Project {
  id: string
  name: string
  status: 'draft' | 'published' | 'archived'
  created_by_id?: string
  /** Set when the project was started from a template. */
  template_id: string | null
  template_revision: number | null
  created_by_name: string
  class_id?: string | null
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
  /** A copy has been sent to at least one student: it can then only be archived, not deleted. */
  sent?: boolean
  /** A teacher chose it for the public sign-in page (published museums only). */
  showcase?: boolean
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

/** A blank project for one of the teacher's classes (or none): the teacher home's New project. */
export function createClassProject(getToken: GetToken, name: string, classId: string | null, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, '/projects', { method: 'POST', body: { name, class_id: classId } }, base)
}

/** One project's row: its name, class and latest save. */
export function getProject(getToken: GetToken, projectId: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}`, {}, base)
}

/** Deletes a draft nobody was sent, with its saves. The API refuses (409) anything else. */
export function deleteProject(getToken: GetToken, projectId: string, base?: string): Promise<void> {
  return apiFetch<void>(getToken, `/projects/${projectId}`, { method: 'DELETE' }, base)
}

/** Teachers only: the projects the students in the teacher's classes own, archived ones left out. */
export async function listStudentMuseums(getToken: GetToken, base?: string): Promise<Project[]> {
  const [students, projects] = await Promise.all([
    listMyStudents(getToken, base),
    apiFetch<Project[]>(getToken, '/projects?kind=project&limit=200', {}, base),
  ])
  const studentIds = new Set(students.map((student) => student.id))
  return projects.filter((project) => studentIds.has(project.created_by_id ?? '') && project.status !== 'archived')
}

/** Teachers only: puts a published museum on the public sign-in page, or takes it off. */
export function setShowcase(getToken: GetToken, projectId: string, showcase: boolean, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}`, { method: 'PATCH', body: { showcase } }, base)
}

/** Archive a project, or put it back as a draft. */
export function setProjectStatus(getToken: GetToken, projectId: string, status: Project['status'], base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}`, { method: 'PATCH', body: { status } }, base)
}

/**
 * Saves the whole scene as the project's next revision. baseRevision is the revision this copy
 * started from (0 before the first save); the API answers 409 if someone saved in between.
 */
export function saveProjectContent(getToken: GetToken, projectId: string, baseRevision: number, data: object, base?: string): Promise<{ revision: number }> {
  return apiFetch<{ revision: number }>(getToken, `/projects/${projectId}/versions`, { method: 'POST', body: { base_revision: baseRevision, data } }, base)
}

/** Every save of one project, newest first: the proof that an edit reached the database. */
export function listRevisions(getToken: GetToken, projectId: string, base?: string): Promise<Revision[]> {
  return apiFetch<Revision[]>(getToken, `/projects/${projectId}/versions`, {}, base)
}

/** What the teacher sets for the whole class when assigning. Left out = the server keeps what it has. */
export type AssignDetails = { task?: string; dueAt?: string } // dueAt is "YYYY-MM-DD"

export function sendToStudent(getToken: GetToken, projectId: string, studentId: string, details: AssignDetails = {}, base?: string): Promise<Project> {
  return apiFetch<Project>(
    getToken,
    `/projects/${projectId}/assign`,
    { method: 'POST', body: { student_id: studentId, task: details.task, due_at: details.dueAt } },
    base,
  )
}

/** Teachers only: a copy of the project's latest save for each of these students. */
export async function sendToStudents(getToken: GetToken, projectId: string, studentIds: string[], details: AssignDetails = {}, base?: string): Promise<{ sent: number; failed: number }> {
  const outcomes = await Promise.allSettled(studentIds.map((id) => sendToStudent(getToken, projectId, id, details, base)))
  const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length
  return { sent: studentIds.length - failed, failed }
}

/** How sending to a class went: copies made now, students who had one already, and sends that failed. */
export interface ClassSendResult {
  sent: number
  alreadyHad: number
  failed: number
}

// a student's copy of "Volcano museum" is named that, or "Volcano museum (2)" if the name was taken
const isCopyOf = (copyName: string, name: string): boolean =>
  copyName === name || (copyName.startsWith(`${name} (`) && /\(\d+\)$/.test(copyName))

/** One student in a class, and whether they already have a copy of the project being assigned. */
export interface RosterStudent {
  id: string
  display_name: string
  hasCopy: boolean
}

/**
 * Teachers only: the students in a class, each marked if they already have a copy of the project
 * there (by name, since a copy does not record where it came from).
 */
export async function classRoster(getToken: GetToken, projectId: string, projectName: string, classId: string, base?: string): Promise<RosterStudent[]> {
  const [members, classProjects] = await Promise.all([
    apiFetch<{ id: string; display_name: string; role: string }[]>(getToken, `/classes/${classId}/members`, {}, base),
    apiFetch<Project[]>(getToken, `/projects?kind=project&class_id=${classId}&limit=200`, {}, base),
  ])
  const haveOne = new Set(
    classProjects.filter((project) => project.id !== projectId && isCopyOf(project.name, projectName)).map((project) => project.created_by_id),
  )
  return members
    .filter((member) => member.role === 'student')
    .map((member) => ({ id: member.id, display_name: member.display_name, hasCopy: haveOne.has(member.id) }))
}

/** Teachers only: files the project under one of the teacher's classes. */
export function setProjectClass(getToken: GetToken, projectId: string, classId: string, base?: string): Promise<Project> {
  return apiFetch<Project>(getToken, `/projects/${projectId}`, { method: 'PATCH', body: { class_id: classId } }, base)
}

/**
 * Teachers only: gives every student in the class their own copy of the project's latest save,
 * skipping students who already have a copy in that class, so pressing Assign again only reaches
 * students who joined since. A copy is the student's to change; sending never overwrites it.
 */
export async function sendToClass(getToken: GetToken, projectId: string, projectName: string, classId: string, base?: string): Promise<ClassSendResult> {
  const roster = await classRoster(getToken, projectId, projectName, classId, base)
  const waiting = roster.filter((student) => !student.hasCopy)
  const { sent, failed } = await sendToStudents(getToken, projectId, waiting.map((student) => student.id), {}, base)
  return { sent, alreadyHad: roster.length - waiting.length, failed }
}
