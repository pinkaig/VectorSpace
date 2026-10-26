/**
 * @file        TeacherLayout.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Frame for the teacher pages: the shared top bar with the
 *              Classes / Review / Results tabs, and the current tab's page
 *              below it (through <Outlet />).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { NavLink, Outlet } from "react-router";
import { useSession } from "../session/session";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import "./TeacherLayout.css";

// the tab that matches the current URL gets the "active" look
const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "landing-top-bar-tab active" : "landing-top-bar-tab";

export default function TeacherLayout() {
  const { signOut, displayName } = useSession();

  return (
    <div className="teacher-layout">
      <LandingPageTopBar
        roleBadge="teacher"
        tabs={
          <>
            <NavLink to="/teacher" end className={tabClass}>Classes</NavLink>
            <NavLink to="/teacher/review" className={tabClass}>Review (6)</NavLink>
            <NavLink to="/teacher/results" className={tabClass}>Results</NavLink>
          </>
        }
        userName={displayName}
        userSubline="Riverside Secondary"
        onSignOut={signOut}
      />
      <Outlet />
    </div>
  );
}