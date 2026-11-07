/**
 * @file        ChooseSchoolSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Shown instead of a page's content when All schools is picked on a page that only
 *              makes sense for one school (Classes): every school as a
 *              row, and picking one opens this page for it (it sets the top bar's School picker).
 *              With no schools yet, it points to Overview, where a school is added.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Link } from "react-router";
import { Motion } from "../../motion/useMotion";
import { initials } from "../../ui/initials";
import { StatusChip } from "../../ui/statusChip";
import { useAdmin } from "./adminContext";

// what: the page's subject, as in "Classes are set per school"
export function ChooseSchoolSection({ what }: { what: string }) {
  const { schools, setSchoolId } = useAdmin();
  return (
    <section className="admin-panel admin-choose">
      <div className="admin-panel-head">
        <h2>Choose a school</h2>
        <span className="admin-muted">{what} are set per school</span>
      </div>

      {schools.length === 0 ? (
        <p className="admin-muted">
          There are no schools yet. <Link to="/admin">Add one on the Overview page</Link>, then come back here.
        </p>
      ) : (
        <ul className="admin-choose-list">
          {schools.map((school, index) => (
            <li key={school.id}>
              <Motion cue="table.rows.enter" staggerIndex={index}>
              <button type="button" className="admin-choose-card" onClick={() => setSchoolId(school.id)}>
                <span className="admin-avatar" aria-hidden="true">{initials(school.name)}</span>
                <span className="admin-choose-name">
                  <strong>{school.name}</strong>
                  <span className="admin-muted">
                    {school.students} {school.students === 1 ? "student" : "students"} · {school.educators}{" "}
                    {school.educators === 1 ? "educator" : "educators"}
                  </span>
                </span>
                <StatusChip tone={school.status === "active" ? "green" : "amber"}>
                  {school.status === "active" ? "Active" : "Setting up"}
                </StatusChip>
                <span className="admin-choose-open" aria-hidden="true">Open →</span>
              </button>
              </Motion>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

