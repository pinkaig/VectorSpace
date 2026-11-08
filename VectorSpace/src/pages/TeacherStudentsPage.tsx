/**
 * @file        TeacherStudentsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Teacher → Students: the classes this teacher teaches, who is in each, and moving a
 *              student between two of them. A new class is theirs straight away. "Add someone" offers
 *              the students already in any of their classes; a student from elsewhere in the school is
 *              placed by an admin. Shown inside TeacherLayout.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { listMyStudents } from "../api/classes";
import { ClassRosterSection } from "../sections/classes/ClassRosterSection";
import { useSession } from "../session/session";

export default function TeacherStudentsPage() {
  const { getToken } = useSession();
  return (
    <ClassRosterSection
      getToken={getToken}
      studentsOnly
      loadCandidates={async () => (await listMyStudents(getToken)).map((s) => ({ ...s, role: "student" }))}
    />
  );
}
