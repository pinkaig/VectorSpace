/**
 * @file        templates.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-18
 * @brief       What a project template looks like in the browser, and how to ask the API for the list.
 *
 * @responsibility
 * Names the fields of a template as the API returns them, and lists templates. A template is
 * a row in the API's projects table with kind 'template', so the list is the project list
 * filtered by kind; there is no separate /templates route.
 *
 * @inputs
 * A token source (session.getToken) and optional filters (status, class, part of the name).
 *
 * @outputs
 * An array of Template, newest edit first, limited to what the signed-in person may see.
 *
 * @boundary
 * Reading only. Creating a template or a project from one (POST /projects) is the next
 * slice. Throws if VITE_API_URL is unset: offline mode has no templates to list.
 *
 * @status
 * Current. Listed on both home pages by src/sections/home/ProjectListsSection.tsx.
 */
import { apiFetch, type GetToken } from './client'

export type TemplateStatus = 'draft' | 'published' | 'archived'

/** The fields a template page needs from GET /projects?kind=template (the API sends a few more). */
export interface Template {
  id: string
  organisation_id: string
  created_by_id: string
  created_by_name: string
  class_id: string | null
  class_name: string | null
  name: string
  slug: string
  status: TemplateStatus
  /** Number of the newest save; 0 when the template has never been saved. */
  current_revision: number
  created_at: string
  updated_at: string
  /** The latest save: when and by whom (null until the template has been saved once). */
  saved_at: string | null
  saved_by_name: string
}

export interface TemplateFilter {
  status?: TemplateStatus
  classId?: string
  /** Part of the name, case-insensitive. */
  q?: string
}

export function listTemplates(getToken: GetToken, filter: TemplateFilter = {}, base?: string): Promise<Template[]> {
  const params = new URLSearchParams({ kind: 'template' })
  if (filter.status) params.set('status', filter.status)
  if (filter.classId) params.set('class_id', filter.classId)
  if (filter.q) params.set('q', filter.q)
  return apiFetch<Template[]>(getToken, `/projects?${params}`, {}, base)
}
