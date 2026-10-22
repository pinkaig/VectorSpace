/**
 * @file        SetupViewportSection.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Template setup, middle panel: a preview of the room, with an "Edit room" button.
 *              The room is never edited on this page. Editing it (and the teacher tools: suggest
 *              a spot, lock things, add a starter object) belongs in the editor at
 *              /editor/:projectId, in a teacher mode, so there is only one place a scene can
 *              be changed (see docs/handover/project-templates.md, section 8.4).
 *              FOR NOW THE PREVIEW IS EMPTY SPACE (a read-only viewport goes there later) and
 *              "Edit room" opens the no-logic popup; the teacher mode is not built.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Pencil } from "lucide-react";
import { Button } from "../../ui/button";
import { useNoLogic } from "../../ui/noLogic";
import "./templateSetup.css";

export function SetupViewportSection() {
  const [noLogic, noLogicPopup] = useNoLogic();

  return (
    <section className="setup-viewport" aria-label="Room preview">
      {/*TOP: what this is, and the way to change it*/}
      <div className="viewport-bar">
        <span className="viewport-label">Room preview</span>
        <Button onClick={() => noLogic("Edit room")}>
          <Pencil size={16} /> Edit room
        </Button>
      </div>

      {/*THE ROOM: left empty until a read-only viewport goes here*/}
      <div className="viewport-stage" />

      {/*HINT: where the teacher tools are*/}
      <p className="viewport-hint">
        <strong>Edit room</strong> to suggest spots, lock things or add starter objects.
      </p>

      {noLogicPopup}
    </section>
  );
}
