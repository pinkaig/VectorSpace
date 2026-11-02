/**
 * @file        ReactionsTip.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       The Step 3 tip card, "Make things happen", from the 3.05 prototype. It shows the
 *              first time a student reaches Step 3 (Make it react), beside the Reactions panel
 *              with a pointer aimed at it: what WHEN and THEN mean, then three example rules.
 *              Got it closes it; Make my first one closes it and lets the editor start a reaction.
 *              Escape works like Got it. The room behind is not dimmed, as in the prototype.
 *
 *              Whether it was seen is remembered in this browser (reactionsTipSeen /
 *              markReactionsTipSeen), so it never shows again.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect } from "react";
import "./reactionsTip.css";

// the three example rules, as in the prototype: "When <someone clicks it> then <play a sound>"
const EXAMPLES = [
  { when: "someone clicks it", then: "play a sound" },
  { when: "someone looks at it", then: "show a card" },
  { when: "someone closes its card", then: "play a video" },
];

// Remembered in this browser only. If storage is off, the tip may show again, nothing breaks.
const SEEN_KEY = "vectorspace.reactionsTipSeen";

export const reactionsTipSeen = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === "yes";
  } catch {
    return false;
  }
};

export const markReactionsTipSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "yes");
  } catch {
    // storage is off: nothing to remember it in
  }
};

type ReactionsTipProps = {
  // Got it or Escape: just close
  onClose: () => void;
  // Make my first one: close, then the editor starts a new reaction
  onMakeFirst: () => void;
};

export function ReactionsTip({ onClose, onMakeFirst }: ReactionsTipProps) {
  // Escape works like Got it
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="reactions-tip-place">
      <div className="reactions-tip-card" role="dialog" aria-labelledby="reactions-tip-title">
        <div className="reactions-tip-label">Step 3 tip</div>
        <h2 id="reactions-tip-title" className="reactions-tip-title">
          Make things happen
        </h2>
        <p className="reactions-tip-text">
          Pick <strong className="reactions-tip-when">WHEN</strong> something happens, then{" "}
          <strong className="reactions-tip-then">THEN</strong> what it does. Sound effects, fact cards, videos and
          doors all start here.
        </p>

        <ul className="reactions-tip-examples">
          {EXAMPLES.map((example) => (
            <li key={example.when} className="reactions-tip-example">
              When <span className="reactions-tip-when">{example.when}</span> then{" "}
              <span className="reactions-tip-then">{example.then}</span>
            </li>
          ))}
        </ul>

        <div className="reactions-tip-actions">
          <button type="button" className="reactions-tip-close" onClick={onClose}>
            Got it
          </button>
          <button type="button" className="reactions-tip-make" onClick={onMakeFirst} autoFocus>
            Make my first one
          </button>
        </div>
      </div>
    </div>
  );
}