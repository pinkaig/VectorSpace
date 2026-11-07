/**
 * @file        AdminPermissionsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Permissions: what Students and Educators may do in one school.
 *              Needs a school picked in the top bar. The grid is in
 *              src/sections/admin/permissions/. Settings are saved per school
 *              (school_permissions). Only some are checked by the product yet; the grid
 *              marks the others "Not enforced yet".
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useAdmin } from "../sections/admin/adminContext";
import { PermissionsGridSection } from "../sections/admin/permissions/PermissionsGridSection";
import "./AdminPermissionsPage.css";
import { AdminPageTitle } from "../sections/admin/AdminPageTitle";

export default function AdminPermissionsPage() {
  const { schools } = useAdmin();
  return (
    <>
      {/*TITLE*/}
      <AdminPageTitle title="Permissions" subtitle="What students and educators may do. One set of settings for every school." scope="All schools" />

      {/*SAVED, NOT ALL ENFORCED: say which switches the product checks, so none promises more than it does*/}
      {schools.length > 0 && (
        <p className="admin-notstored" role="note">
          Settings are saved for every school. Those marked "Not enforced yet" are kept for later: nothing checks them yet.
        </p>
      )}

      {/*GRID: the settings every school shares; with no school yet there is nothing to save to*/}
      {schools.length > 0
        ? <PermissionsGridSection schoolIds={schools.map((s) => s.id)} />
        : <p className="admin-muted">Add a school on the Overview page first.</p>}
    </>
  );
}
