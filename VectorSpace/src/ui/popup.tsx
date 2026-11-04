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

import { useEffect, useRef, type ReactNode } from "react";
import { uiSound, type UiCue } from "../audio";
import { exitAsGhost } from "../motion/exitAsGhost";
import { motion } from "../motion/motion";
import "./popup.css";

type PopupProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  // the buttons, placed bottom-right: pass the secondary one first, then the primary
  actions: ReactNode;
  children: ReactNode;
  // the sound it opens with (a cue in src/audio/cue-map.json), e.g. "ui.error" for a popup that
  // reports a problem; null for none. Closing always plays the close sound
  cue?: UiCue;
};

export function Popup({ title, subtitle, onClose, actions, children, cue = "ui.dialog.open" }: PopupProps) {
  // Escape closes the dialog, as people expect
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // opens with a cue; leaves with one too. Callers unmount this the same instant they close it,
  // so the exit is played on a copy (see motion/exitAsGhost.ts) and no caller has to change
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;
    motion.play("popup.backdrop.enter", backdrop);
    motion.play("popup.enter", card);
    // the sounds replace the click of the button that opened or closed it (one sound per action)
    uiSound.play(cue);
    return () => {
      uiSound.play("ui.close");
      exitAsGhost(backdrop, "popup.backdrop.exit", [{ selector: ".ui-popup", cue: "popup.exit" }]);
    };
  }, []);

  return (
    <div ref={backdropRef} className="ui-popup-backdrop" onMouseDown={onClose}>
      {/* stopPropagation: a click inside the card must not count as a click on the backdrop */}
      <div ref={cardRef} className="ui-popup" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="ui-popup-title">{title}</h2>
        {subtitle && <p className="ui-popup-sub">{subtitle}</p>}
        <div className="ui-popup-body">{children}</div>
        <div className="ui-popup-actions">{actions}</div>
      </div>
    </div>
  );
}
