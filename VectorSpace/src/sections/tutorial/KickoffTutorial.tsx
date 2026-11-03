/**
 * @file        KickoffTutorial.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       The kick-off tutorial a student sees the first time they open the editor: three
 *              tips over a dimmed room ("Tip 1 of 3"), with Skip tutorial and Next (the last tip
 *              says Let's build). Its tips follow the manual: (1) welcome, you build in 4 steps,
 *              (2) look around the room, (3) add your first exhibit. "Getting started" in the
 *              "?" menu of the editor's top bar opens it again from the first tip.
 *
 *              Whether it was seen is remembered in this browser (tutorialSeen / markTutorialSeen),
 *              so it only shows once. Escape skips it, like Skip tutorial.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import "./kickoffTutorial.css";

// the three tips, in order (manual: Student flow, 2. Opening a project)
const TIPS = [
  {
    title: "Welcome to your museum!",
    text: "You will build it in 4 steps. The bar at the top always shows which step you are on.",
  },
  {
    title: "Look around",
    text: "Drag on the room to look around. Use the View buttons in the corner to see it from the top, front or side.",
  },
  {
    title: "Add your first exhibit",
    text: "Pick something in the catalogue at the bottom, then click the floor to drop it in.",
  },
];

// Remembered in this browser only. The storage can be turned off or full, so a failure just
// means the tutorial may show again, never that the editor breaks.
const SEEN_KEY = "vectorspace.kickoffTutorialSeen";

export const tutorialSeen = (): boolean => {
  // automated browser tests (Playwright) skip it, so it does not sit over the editor they click through
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  try {
    return localStorage.getItem(SEEN_KEY) === "yes";
  } catch {
    return false;
  }
};

export const markTutorialSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "yes");
  } catch {
    // storage is off: nothing to remember it in
  }
};

type KickoffTutorialProps = {
  // Skip tutorial, Let's build or Escape: the editor closes it and marks it seen
  onClose: () => void;
};

export function KickoffTutorial({ onClose }: KickoffTutorialProps) {
  const [index, setIndex] = useState(0);
  const tip = TIPS[index];
  const last = index === TIPS.length - 1;

  // Escape skips it, like the Skip tutorial button
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="kickoff-overlay">
      <div className="kickoff-card" role="dialog" aria-modal="true" aria-labelledby="kickoff-title">
        <div className="kickoff-count">
          Tip {index + 1} of {TIPS.length}
        </div>
        <h2 id="kickoff-title" className="kickoff-title">
          {tip.title}
        </h2>
        <p className="kickoff-text">{tip.text}</p>
        <div className="kickoff-actions">
          <button type="button" className="kickoff-skip" onClick={onClose}>
            Skip tutorial
          </button>
          <button
            type="button"
            className="kickoff-next"
            // the next tip, or close after the last one
            onClick={() => (last ? onClose() : setIndex(index + 1))}
            autoFocus
          >
            {last ? "Let's build" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}