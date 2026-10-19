/**
 * @file        SchoolPicker.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The School dropdown in the admin top bar. What it picks filters every admin page.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { ALL_SCHOOLS } from "../../api/admin";
import "../../ui/field.css"; // the .ui-input look
import { useAdmin } from "./adminContext";

export function SchoolPicker() {
  const { schools, schoolId, setSchoolId } = useAdmin();
  return (
    <label className="admin-school-picker">
      <span>School</span>
      <select className="ui-input" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
        <option value={ALL_SCHOOLS}>All schools</option>
        {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
      </select>
    </label>
  );
}
