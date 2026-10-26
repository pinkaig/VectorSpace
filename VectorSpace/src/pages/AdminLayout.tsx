/**
 * @file        AdminLayout.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The frame around every VThere Admin page: top bar (with the School picker),
 *              the left sidebar with the four pages, and the page itself in the middle.
 *              App.tsx makes it a layout route, so the page appears where <Outlet /> is.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Boxes, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useMotionOnChange } from "../motion/useMotion";
import { TopBar } from "../ui/topBar";
import { AdminProvider } from "../sections/admin/adminContext";
import { SchoolPicker } from "../sections/admin/SchoolPicker";
import "./AdminLayout.css";

// the four pages, in the order the manual lists them; `end` stops Overview ("/admin") from
// also lighting up on /admin/accounts
const PAGES = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, end: false },
  { to: "/admin/accounts", label: "Accounts", icon: Users, end: false },
  { to: "/admin/rooms", label: "Rooms & assets", icon: Boxes, end: false },
];

export default function AdminLayout() {
  // a new page fades in whenever the address changes; opacity only, so the sticky table headers keep working
  const mainRef = useMotionOnChange<HTMLElement>("nav.page.swap", useLocation().pathname);
  return (
    <AdminProvider>
      <div className="admin-shell">
        {/*TOP: logo, role badge, School picker, account group*/}
        <TopBar role="admin" subline="VThere staff" beforeAccount={<SchoolPicker />} />

        <div className="admin-body">
          {/*LEFT: the four admin pages*/}
          <nav className="admin-sidebar" aria-label="Admin pages">
            {PAGES.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-nav-link ${isActive ? "admin-nav-active" : ""}`}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/*MIDDLE: whichever page the address bar names*/}
          <main ref={mainRef} className="admin-main">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
