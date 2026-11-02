/**
 * @file        LoadingRoom.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       The "Loading your room…" popup from the 3.05 prototype: a white card over the
 *              page with a spinning ring, the title, a moving progress bar and a tip. Shown while
 *              the editor opens: while the project is fetched and while the editor's code is
 *              downloaded (the Suspense fallbacks in App.tsx, ProjectEditorPage and
 *              TeacherPreviewPage). There is no real percentage at that point, so the bar moves
 *              on its own instead of filling up.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import "./loadingRoom.css";

type LoadingRoomProps = {
  // what is loading; the prototype's wording by default
  title?: string;
};

export function LoadingRoom({ title = "Loading your room…" }: LoadingRoomProps) {
  // every copy follows the same clock, so swapping one loading screen for the next doesn't restart the ring or the bar
  const now = performance.now();
  return (
    <div className="loading-room" role="status" aria-live="polite">
      <div className="loading-room-card">
        <span className="loading-room-ring" aria-hidden="true" style={{ animationDelay: `-${Math.round(now % 900)}ms` }} />
        <p className="loading-room-title">{title}</p>
        <div className="loading-room-track" aria-hidden="true">
          <span className="loading-room-fill" style={{ animationDelay: `-${Math.round(now % 1400)}ms` }} />
        </div>
        <p className="loading-room-tip">Tip: Big rooms can take a few seconds the first time.</p>
      </div>
    </div>
  );
}