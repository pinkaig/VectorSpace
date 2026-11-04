/**
 * @file        showcase.ts
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Published student museums shown in the sign-in page carousel: the ones a teacher
 *              switched on (GET /showcase, which needs no sign-in). None offline, or when the
 *              server cannot be reached, so the carousel stays hidden.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { apiFetch, apiUrl } from "./client";

/** One museum card in the sign-in carousel. */
export type ShowcaseMuseum = {
  id: string;
  title: string;
  studentName: string; // first name only
  className: string | null;
  schoolName: string;
  exhibitCount: number;
  roomCount: number;
};

type ShowcaseRow = {
  title: string;
  student_name: string;
  class_name: string | null;
  school_name: string;
  exhibit_count: number;
  room_count: number;
};

// the sign-in page is shown before anyone signs in, so no token is sent
const noToken = async () => null;

/** Gets the museums for the carousel, newest first. */
export async function getShowcaseMuseums(): Promise<ShowcaseMuseum[]> {
  if (!apiUrl) return [];
  try {
    const rows = await apiFetch<ShowcaseRow[]>(noToken, "/showcase");
    return rows.map((row, index) => ({
      id: `${index}-${row.title}`,
      title: row.title,
      studentName: row.student_name,
      className: row.class_name,
      schoolName: row.school_name,
      exhibitCount: row.exhibit_count,
      roomCount: row.room_count,
    }));
  } catch {
    // a sign-in page with no carousel still works
    return [];
  }
}
