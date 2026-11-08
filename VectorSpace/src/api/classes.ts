/**
 * @file        classes.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       The signed-in teacher's classes, and the students in them for "send to student".
 *
 * @responsibility
 * Reads GET /classes (the New project popup's class picks), and each class roster, returning
 * the students once each.
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

export interface ClassInfo {
  id: string
  school_id: string
  name: string
  member_count: number
}

export type ClassMemberInfo = Member

/** The classes the signed-in person is in (every class in the school for an admin), by name. */
export function listMyClasses(getToken: GetToken, base?: string): Promise<ClassInfo[]> {
  return apiFetch<ClassInfo[]>(getToken, '/classes', {}, base)
}

// ── Organising classes (POST/DELETE /classes...). An admin works on any school's classes and passes
// schoolId; a teacher works only on classes they teach and only moves students. The API enforces both.

/** An admin's classes for one school, or a teacher's own classes when schoolId is left out. */
export function listClasses(getToken: GetToken, schoolId?: string, base?: string): Promise<ClassInfo[]> {
  return apiFetch<ClassInfo[]>(getToken, schoolId ? `/classes?school=${encodeURIComponent(schoolId)}` : '/classes', {}, base)
}

export function listMembers(getToken: GetToken, classId: string, base?: string): Promise<ClassMemberInfo[]> {
  return apiFetch<ClassMemberInfo[]>(getToken, `/classes/${classId}/members`, {}, base)
}

/** A teacher's new class is in their own school and they teach it; an admin names the school. */
export function createClass(getToken: GetToken, name: string, schoolId?: string, base?: string): Promise<ClassInfo> {
  return apiFetch<ClassInfo>(getToken, '/classes', { method: 'POST', body: schoolId ? { name, school_id: schoolId } : { name } }, base)
}

export function addMember(getToken: GetToken, classId: string, actorId: string, base?: string): Promise<ClassMemberInfo> {
  return apiFetch<ClassMemberInfo>(getToken, `/classes/${classId}/members`, { method: 'POST', body: { actor_id: actorId } }, base)
}

export function removeMember(getToken: GetToken, classId: string, actorId: string, base?: string): Promise<void> {
  return apiFetch<void>(getToken, `/classes/${classId}/members/${actorId}`, { method: 'DELETE' }, base)
}

/** Out of one class and into another in one call. The student's own work stays theirs. */
export function moveMember(getToken: GetToken, fromClassId: string, actorId: string, toClassId: string, base?: string): Promise<unknown> {
  return apiFetch(getToken, `/classes/${fromClassId}/members/${actorId}/move`, { method: 'POST', body: { to_class_id: toClassId } }, base)
}

export async function listMyStudents(getToken: GetToken, base?: string): Promise<Student[]> {
  const classes = await apiFetch<{ id: string }[]>(getToken, '/classes', {}, base)
  const rosters = await Promise.all(classes.map((c) => apiFetch<Member[]>(getToken, `/classes/${c.id}/members`, {}, base)))
  const students = new Map<string, Student>()
  for (const member of rosters.flat()) if (member.role === 'student') students.set(member.id, { id: member.id, display_name: member.display_name })
  return [...students.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
}
