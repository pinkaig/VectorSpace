/**
 * @file        SetupViewportSection.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Template setup, middle panel: a preview of the room, with an "Edit room" button.
 *              The room is never edited on this page. Editing it (and the teacher tools: suggest
 *              a spot, lock things, add a starter object) belongs in the editor at
 *              /editor/:projectId, in a teacher mode, so there is only one place a scene can
 *              be changed (see docs/handover/project-templates.md, section 8.4).
 *              The preview is empty space and "Edit room" opens the no-logic popup.
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
    <section className="setup-viewport">
      <div className="viewport-bar">{/*TOP: what this is, and the way to change it*/}
        <span className="viewport-label">Room preview</span>
        <Button onClick={() => noLogic("Edit room")}>
          <Pencil size={16} /> Edit room
        </Button>
      </div>
      <div className="viewport-stage" />{/*THE ROOM: empty space*/}
      <p className="viewport-hint">{/*HINT: where the teacher tools are*/}
        <strong>Edit room</strong> to suggest spots, lock things or add starter objects.
      </p>

      {noLogicPopup}
    </section>
  );
}
