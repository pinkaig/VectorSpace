/**
 * @file        classes.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       The students in the signed-in teacher's classes, for "send to student".
 *
 * @responsibility
 * Reads GET /classes and each class roster, and returns the students once each.
 *
 * @boundary
 * Reading only. A student cannot list a roster (the API answers 403), so call this as a teacher.
 *
 * @status
 * Current. Used by src/sections/home/ProjectListsSection.tsx.
 */
import { apiFetch, type GetToken } from './client'

export interface Student {
  id: string
  display_name: string
}

interface Member extends Student {
  role: string
}

/** One class the signed-in person is in, from GET /classes. */
export interface ClassRow {
  id: string
  name: string
  member_count: number
}

/** The signed-in person's classes, by name (template setup's "Assign to <class>"). */
export function listMyClasses(getToken: GetToken, base?: string): Promise<ClassRow[]> {
  return apiFetch<ClassRow[]>(getToken, '/classes', {}, base)
}

export async function listMyStudents(getToken: GetToken, base?: string): Promise<Student[]> {
  const classes = await apiFetch<{ id: string }[]>(getToken, '/classes', {}, base)
  const rosters = await Promise.all(classes.map((c) => apiFetch<Member[]>(getToken, `/classes/${c.id}/members`, {}, base)))
  const students = new Map<string, Student>()
  for (const member of rosters.flat()) if (member.role === 'student') students.set(member.id, { id: member.id, display_name: member.display_name })
  return [...students.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
}
