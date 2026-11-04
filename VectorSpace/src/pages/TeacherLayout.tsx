/**
 * @file        TeacherLayout.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Frame for the teacher pages: the shared top bar with the
 *              Classes / Review (N) / Results tabs, and the current tab's page
 *              below it (through <Outlet />). N is how many students' museums
 *              are waiting for review, checked on every tab change, every 30
 *              seconds, and straight after Review approves or sends one back
 *              (refreshWaiting, passed to the tab pages as outlet context).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { apiUrl } from "../api/client";
import { listStudentMuseums } from "../api/projects";
import { useSession } from "../session/session";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import { usePendingLinkCount } from "../sections/mediaLibrary/LinkApprovalAlert";
import "./TeacherLayout.css";

// what the tab pages get from this layout (useOutletContext): Review calls refreshWaiting after
// it approves or sends something back, so the tab's number drops at once
export type TeacherOutletContext = { refreshWaiting: () => void };

// how often the Review tab's number is checked again while a teacher page is open
const WAITING_CHECK_MS = 30_000;

// the tab that matches the current URL gets the "active" look
const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "landing-top-bar-tab active" : "landing-top-bar-tab";

export default function TeacherLayout() {
  const { signOut, displayName, getToken } = useSession();
  const { pathname } = useLocation();

  // how many museums wait for this teacher, shown on the Review tab
  const [waiting, setWaiting] = useState(0);
  // and how many YouTube or image links students added wait for approval
  const pendingLinks = usePendingLinkCount();
  const refreshWaiting = useCallback(() => {
    if (!apiUrl) return;
    listStudentMuseums(getToken).then(
      (museums) => setWaiting(museums.filter((m) => m.review_status === "waiting").length),
      () => {},
    );
  }, [getToken]);

  // checked on every tab change and every 30 seconds, so a new hand-in shows up by itself
  useEffect(() => {
    refreshWaiting();
    const timer = window.setInterval(refreshWaiting, WAITING_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [pathname, refreshWaiting]);

  return (
    <div className="teacher-layout">
      <LandingPageTopBar
        roleBadge="teacher"
        tabs={
          <>
            <NavLink to="/teacher" end className={tabClass}>Classes</NavLink>
            <NavLink to="/teacher/review" className={tabClass}>{`Review (${waiting})`}{pendingLinks > 0 && <span className="review-tab-links" title="Links waiting for your approval"> · {pendingLinks} {pendingLinks === 1 ? "link" : "links"}</span>}</NavLink>
            <NavLink to="/teacher/results" className={tabClass}>Results</NavLink>
          </>
        }
        userName={displayName}
        userSubline="Teacher"
        onSignOut={signOut}
      />
      <Outlet context={{ refreshWaiting } satisfies TeacherOutletContext} />
    </div>
  );
}