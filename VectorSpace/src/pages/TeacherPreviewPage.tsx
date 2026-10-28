/**
 * @file        TeacherPreviewPage.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       /teacher/preview: a student page under a dark "Teacher preview" bar with an
 *              Exit preview button. Nothing done here is saved: the editor is opened in
 *              preview mode, which turns its autosave and Save off.
 *
 *              The template setup page opens this with the mission brief it is editing (as
 *              router state), so the preview shows that brief even before Assign. Exit
 *              preview hands the same brief back, so edits not assigned yet are kept.
 *
 *              WHICH PAGE IS PREVIEWED: set PREVIEW_SHOWS below.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { lazy, Suspense, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye } from "lucide-react";
import { loadProjectWithSource } from "../project/serializer";
import { tidyBrief, type MissionBrief } from "../mission/missionBrief";
import StudentHomePage from "./StudentHomePage";
import "./TeacherPreviewPage.css";

// the editor is large, so it is only downloaded when a preview shows it (as /editor does)
const EditorApplication = lazy(() => import("../../apps/editor/src/EditorApplication"));

// what the template setup page sends here, and gets back from Exit preview; projectId is the
// server project being set up, so setup opens the same one again
export type PreviewState = { brief?: MissionBrief; projectId?: string } | null;

// WHICH PAGE THE PREVIEW SHOWS. Change this one word to switch:
//   "editor"       the editor, as a student building the project sees it
//   "studentHome"  the student home page
type PreviewTarget = "editor" | "studentHome";
const PREVIEW_SHOWS: PreviewTarget = "editor";

export default function TeacherPreviewPage() {
  const navigate = useNavigate();
  const handed = useLocation().state as PreviewState;
  const brief = handed?.brief;

  // the project the editor opens: this browser's draft with the brief being set up on it.
  // In memory only; the editor's preview mode never writes it back.
  const [start] = useState(() => {
    const loaded = loadProjectWithSource();
    return brief ? { ...loaded, project: { ...loaded.project, missionBrief: tidyBrief(brief) } } : loaded;
  });

  // the pages a preview can show
  const pages: Record<PreviewTarget, () => ReactNode> = {
    editor: () => (
      <Suspense fallback={<p>Loading editor…</p>}>
        <EditorApplication start={start} preview />
      </Suspense>
    ),
    studentHome: () => <StudentHomePage />,
  };

  // back to template setup, handing the brief back
  const exitPreview = () => {
    const state: PreviewState = { brief, projectId: handed?.projectId };
    navigate("/teacher/template", { state });
  };

  return (
    <div className="preview-frame">
      <div className="preview-bar">{/*THE BAR: says this is a preview, and the way out*/}
        <Eye size={18} />
        <strong>Teacher preview</strong>
        <span className="preview-bar-text">You're seeing exactly what students see. Nothing you do here is saved.</span>
        <button type="button" className="preview-exit" onClick={exitPreview}>Exit preview</button>
      </div>
      <div className="preview-page">{pages[PREVIEW_SHOWS]()}</div>{/*THE STUDENT PAGE, under the bar*/}
    </div>
  );
}
