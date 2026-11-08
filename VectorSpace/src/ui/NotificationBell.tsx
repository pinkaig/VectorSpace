/**
 * @file        NotificationBell.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       The bell in the top bar and its Notifications dropdown. A dot shows
 *              while there are unread ones; opening the list marks them read
 *              ("All caught up"). Closes on a click outside or Escape. The page
 *              passes the notifications in; this only shows them.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useRef, useState } from "react";
import { Bell, Box, Check, Eye } from "lucide-react";
import "./NotificationBell.css";

export type NotificationKind = "project" | "visits" | "approved";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string; // "Ms Tan gave you a new project: Dinosaur museum"
  meta: string; // "Monday · due Friday"
};

// one icon and colour per kind
const ICONS = { project: Box, visits: Eye, approved: Check };

type NotificationBellProps = {
  notifications: AppNotification[];
  unread: boolean; // shows the dot
  onOpen: () => void; // the page marks them read
  footer?: string; // a quiet line under the list
};

export function NotificationBell({ notifications, unread, onOpen, footer }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // a click outside or Escape closes it
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen();
    setOpen(!open);
  };

  return (
    <div className="notification-bell" ref={anchorRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label={unread ? "Notifications, new" : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell size={20} />
        {unread && <span className="notification-bell-dot" />}
      </button>

      {open && (
        <div className="notification-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notification-bell-head">
            <h2>Notifications</h2>
            <span>All caught up</span>
          </div>

          {notifications.length === 0 ? (
            <p className="notification-bell-empty">Nothing new yet.</p>
          ) : (
            <ul className="notification-bell-list">
              {notifications.map((n) => {
                const Icon = ICONS[n.kind];
                return (
                  <li key={n.id} className="notification-bell-item">
                    <span className={`notification-bell-icon notification-bell-icon-${n.kind}`}>
                      <Icon size={18} />
                    </span>
                    <span className="notification-bell-text">
                      <strong>{n.title}</strong>
                      <small>{n.meta}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {footer && <p className="notification-bell-footer">{footer}</p>}
        </div>
      )}
    </div>
  );
}