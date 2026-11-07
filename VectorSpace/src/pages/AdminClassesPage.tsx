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
import { PickSchoolNotice } from "../sections/admin/PickSchoolNotice";
import { ClassRosterSection } from "../sections/classes/ClassRosterSection";
import { useSession } from "../session/session";

export default function AdminClassesPage() {
  const { api, school } = useAdmin();
  const { getToken } = useSession();
  return (
    <>
      {/*TITLE*/}
      <div className="admin-page-title">
        <h1>Classes</h1>
        <p>{school ? school.name : "All schools"}</p>
      </div>

      {/*ROSTER: one school's classes, or a note asking for a school to be picked*/}
      {school ? (
        <ClassRosterSection
          key={school.id}
          getToken={getToken}
          schoolId={school.id}
          loadCandidates={async () =>
            (await api.listAccounts(school.id))
              .filter((a) => a.role !== "admin" && a.status !== "turned_off")
              .map((a) => ({ id: a.id, display_name: a.name, role: a.role }))
          }
        />
      ) : (
        <PickSchoolNotice what="Classes" />
      )}
    </>
  );
}
