/**
 * @file        topBar.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The top bar every role shares: logo, product name, role badge, optional centre
 *              (tabs) and extra controls (admin's School picker), then the account group with
 *              Sign out. Teacher and student pages pass their own role and tabs.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Box } from "lucide-react";
import type { ReactNode } from "react";
import { SoundToggle } from "../audio";
import { useSession } from "../session/session";
import { Button } from "./button";
import "./topBar.css";

type TopBarProps = {
  role: "admin" | "teacher" | "student";
  // the grey line under the name in the account group, e.g. "VThere staff" or a school name
  subline: string;
  // the middle of the bar: filter tabs for roles that have them
  centre?: ReactNode;
  // controls that sit just left of the account group (the admin School picker)
  beforeAccount?: ReactNode;
};

const BADGE: Record<TopBarProps["role"], string> = { admin: "VThere Admin", teacher: "Teacher", student: "Student" };

export function TopBar({ role, subline, centre, beforeAccount }: TopBarProps) {
  const { displayName, signOut } = useSession();
  const initials = displayName.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="ui-topbar">
      {/* LEFT: logo, product name and which role this is */}
      <div className="ui-topbar-brand">
        <div className="ui-topbar-logo"><Box size={22} /></div>
        <span className="ui-topbar-name">VectorSpace</span>
        <span className={`ui-topbar-badge ui-topbar-badge-${role}`}>{BADGE[role]}</span>
      </div>

      {/* MIDDLE: tabs, if this role has any */}
      <div className="ui-topbar-centre">{centre}</div>

      {/* RIGHT: extra controls, the sound on/off button, a divider, then who is signed in */}
      {beforeAccount}
      <SoundToggle />
      <div className="ui-topbar-divider" />
      <div className="ui-topbar-account">
        <div className={`ui-topbar-avatar ui-topbar-avatar-${role}`}>{initials}</div>
        <div className="ui-topbar-who">
          <div className="ui-topbar-who-name">{displayName}</div>
          <div className="ui-topbar-who-sub">{subline}</div>
        </div>
        <Button size="small" onClick={signOut}>Sign out</Button>
      </div>
    </header>
  );
}
