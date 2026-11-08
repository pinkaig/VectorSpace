/**
 * @file        LandingPageTopBar.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Top bar shared by the home pages: logo, product name, optional
 *              role badge, optional centre tabs, and the account box with
 *              Sign out. Same on every role, per the V3 manual.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ReactNode } from "react";
import { Link } from "react-router";
import { Box } from "lucide-react";
import { SoundToggle } from "../audio";
import { homePath, useSession } from "../session/session";
import "./LandingPageTopBar.css";

type LandingPageTopBarProps = {
  roleBadge?: "teacher" | "admin"; // students have no badge
  tabs?: ReactNode; // teacher tabs go here; empty for students
  userName: string; // "Ms Tan"
  userSubline: string; // "Riverside Secondary"
  actions?: ReactNode;
  onSignOut: () => void;
};

export function LandingPageTopBar({
  roleBadge,
  tabs,
  userName,
  userSubline,
  actions,
  onSignOut,
}: LandingPageTopBarProps) {
  // the logo goes to this person's home page, the same rule as sign-in and the editor's cube
  const { role, admin } = useSession();
  const home = role ? homePath(role, admin) : "/";
  return (
    <header className="landing-top-bar">
            <div className="landing-top-bar-brand">
        {/* logo and name: back to the home (landing) page, e.g. from the Review or Results tab */}
        <Link to={home} className="landing-top-bar-home" title="Back to home">
          <div className="landing-top-bar-logo">
            <Box size={22} />
          </div>
          <span className="landing-top-bar-name">VectorSpace</span>
        </Link>
        {roleBadge === "teacher" && (
          <span className="landing-top-bar-badge teacher">Teacher</span>
        )}
        {roleBadge === "admin" && (
          <span className="landing-top-bar-badge admin">VThere Admin</span>
        )}
      </div>

      <nav className="landing-top-bar-tabs">{tabs}</nav>

      {actions && <div className="landing-top-bar-actions">{actions}</div>}
      <SoundToggle />
      <div className="landing-top-bar-divider" />

      <div className="landing-top-bar-account">
        <div className={`landing-top-bar-avatar ${roleBadge ?? "student"}`}>
          {userName[0]}
        </div>
        <div className="landing-top-bar-user">
          <strong>{userName}</strong>
          <span>{userSubline}</span>
        </div>
        <button
          type="button"
          className="landing-top-bar-signout"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
