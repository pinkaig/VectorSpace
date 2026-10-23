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
import { Box } from "lucide-react";
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
  return (
    <header className="landing-top-bar">
      <div className="landing-top-bar-brand">
        <div className="landing-top-bar-logo">
          <Box size={22} />
        </div>
        <span className="landing-top-bar-name">VectorSpace</span>
        {roleBadge === "teacher" && (
          <span className="landing-top-bar-badge teacher">Teacher</span>
        )}
        {roleBadge === "admin" && (
          <span className="landing-top-bar-badge admin">VThere Admin</span>
        )}
      </div>

      <nav className="landing-top-bar-tabs">{tabs}</nav>

      {actions && <div className="landing-top-bar-actions">{actions}</div>}
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
