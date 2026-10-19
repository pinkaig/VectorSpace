/**
 * @file        AdminPermissionsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Permissions: what Students and Educators may do in one school.
 *              Needs a school picked in the top bar. The grid is in
 *              src/sections/admin/permissions/. Nothing in the product enforces these
 *              settings yet; this page only stores them.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { NOT_STORED_YET } from "../api/admin";
import { useAdmin } from "../sections/admin/adminContext";
import { PermissionsGridSection } from "../sections/admin/permissions/PermissionsGridSection";
import { PickSchoolNotice } from "../sections/admin/PickSchoolNotice";
import "./AdminPermissionsPage.css";

export default function AdminPermissionsPage() {
  const { school } = useAdmin();
  return (
    <>
      {/*TITLE*/}
      <div className="admin-page-title">
        <h1>Permissions</h1>
        <p>{school ? school.name : "All schools"}</p>
      </div>

      {/*NOT SAVED: these settings have no table behind them (see api/adminFake.ts)*/}
      <p className="admin-notstored" role="note">{NOT_STORED_YET}</p>

      {/*GRID: one school's settings, or a note asking for a school to be picked*/}
      {school ? <PermissionsGridSection key={school.id} schoolId={school.id} /> : <PickSchoolNotice what="Permissions" />}
    </>
  );
}
