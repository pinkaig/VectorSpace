/**
 * @file        AdminClassesPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin → Classes: make classes in the picked school and move people between them.
 *              Classes belong to one school, so with All schools picked it asks for a school first.
 *              "Add someone" offers the school's students and educators (from Accounts).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useAdmin } from "../sections/admin/adminContext";
import { ChooseSchoolSection } from "../sections/admin/ChooseSchoolSection";
import { ClassRosterSection } from "../sections/classes/ClassRosterSection";
import { useSession } from "../session/session";
import { AdminPageTitle } from "../sections/admin/AdminPageTitle";

export default function AdminClassesPage() {
  const { api, school } = useAdmin();
  const { getToken } = useSession();
  return (
    <>
      {/*TITLE*/}
      <AdminPageTitle title="Classes" subtitle="Make a school's classes, then put its students and educators in them. Educators see only the classes they teach." scope={school ? school.name : "All schools"} />

      {/*ROSTER: one school's classes, or a note asking for a school to be picked*/}
      {school ? (
        <ClassRosterSection
          key={school.id}
          getToken={getToken}
          schoolId={school.id}
          loadCandidates={async () =>
            (await api.listAccounts(school.id))
              .filter((a) => a.role !== "admin" && a.status !== "turned_off")
              .map((a) => ({ id: a.id, display_name: a.name, role: a.role, email: a.email }))
          }
        />
      ) : (
        <ChooseSchoolSection what="Classes" />
      )}
    </>
  );
}
