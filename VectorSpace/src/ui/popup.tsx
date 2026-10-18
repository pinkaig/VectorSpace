/**
 * @file        popup.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A centred dialog on a dimmed backdrop: title, one sub-line, content, buttons bottom-right.
 *              The only thing in the app that has a shadow (manual rule).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, type ReactNode } from "react";
import "./popup.css";

type PopupProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  // the buttons, placed bottom-right: pass the secondary one first, then the primary
  actions: ReactNode;
  children: ReactNode;
};

export function Popup({ title, subtitle, onClose, actions, children }: PopupProps) {
  // Escape closes the dialog, as people expect
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-popup-backdrop" onMouseDown={onClose}>
      {/* stopPropagation: a click inside the card must not count as a click on the backdrop */}
      <div className="ui-popup" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="ui-popup-title">{title}</h2>
        {subtitle && <p className="ui-popup-sub">{subtitle}</p>}
        <div className="ui-popup-body">{children}</div>
        <div className="ui-popup-actions">{actions}</div>
      </div>
    </div>
  );
}
