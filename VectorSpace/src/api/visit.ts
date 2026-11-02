/**
 * @file        visit.ts
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       A published project opened from its share link (GET /visit/:slug). The token is
 *              sent when there is one: a "My class only" project needs it, the others don't.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { apiFetch, type GetToken } from "./client";
import type { ShareWith } from "./projects";
import type { ProjectData } from "../project/model";
import { deserializeProject } from "../project/serializer";

/** What the visitor's page shows: the project and who made it (first name only). */
export type VisitProject = {
  title: string;
  studentName: string;
  className: string | null;
  schoolName: string;
  shareWith: ShareWith;
  project: ProjectData;
};

type VisitRow = {
  title: string;
  student_name: string;
  class_name: string | null;
  school_name: string;
  share_with: ShareWith;
  data: unknown;
};

/** Throws ApiError 401 (sign in first) or 404 (not published, or not for this visitor). */
export async function getVisitProject(getToken: GetToken, slug: string): Promise<VisitProject> {
  const row = await apiFetch<VisitRow>(getToken, `/visit/${encodeURIComponent(slug)}`);
  return {
    title: row.title,
    studentName: row.student_name,
    className: row.class_name,
    schoolName: row.school_name,
    shareWith: row.share_with,
    project: deserializeProject(JSON.stringify({ ...(row.data as object), name: row.title })),
  };
}
