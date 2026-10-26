/**
 * @file        TeacherTemplateSetupPage.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Teacher template setup: the teacher's copy of a template, set up before it is
 *              assigned to a class. A header bar over three panels:
 *                Mission brief (left)  |  Room preview (middle)  |  Project details (right)
 *
 *              "Assign to <class>" hands the mission brief to the editor by writing it into
 *              the editor's draft saved in this browser (saveProject). The editor shows it as
 *              the students' brief (sections/missionBrief/). Pressing Assign again replaces it.
 *              "Preview as a student" opens TeacherPreviewPage with the brief being edited
 *              (assigned or not). Nothing done in the preview is saved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Box } from "lucide-react";
import { loadProject, saveProject } from "../project/serializer";
import { Button } from "../ui/button";
import { StatusChip } from "../ui/statusChip";
import { MissionBriefSection } from "../sections/templateSetup/MissionBriefSection";
import { SetupViewportSection } from "../sections/templateSetup/SetupViewportSection";
import { ProjectDetailsSection } from "../sections/templateSetup/ProjectDetailsSection";
import { formatDueDate, tidyBrief, type MissionBrief } from "../mission/missionBrief";
import type { PreviewState } from "./TeacherPreviewPage";
import "./TeacherTemplateSetupPage.css";

// where "Preview as a student" goes. Which student page it shows is set in TeacherPreviewPage.
const STUDENT_PREVIEW_PATH = "/teacher/preview";

// SAMPLE DATA: the project shown in the header
const SAMPLE_PROJECT = {
  title: "Dinosaur museum",
  templateName: "museum template",
  room: "Room 1 · Entrance hall",
  className: "Class 2B",
};
// The brief the page starts with. Once a brief has been assigned, the page starts from that
// one instead (see startingBrief), so the teacher can carry on where they left off.
const SAMPLE_BRIEF: MissionBrief = {
  // due today; see formatDueDate in the missionBrief.ts
  due: formatDueDate(new Date()),
  todos: [
    { id: "todo-1", text: "Place 3 exhibits" },
    { id: "todo-2", text: "Give each exhibit a fact card" },
    { id: "todo-3", text: "Add one reaction" },
    { id: "todo-4", text: "Add a second room" },
  ],
  rules: [
    { id: "rule-1", text: "Use facts from your research, in your own words" },
    { id: "rule-2", text: "Keep everything school-appropriate" },
    { id: "rule-3", text: "The walls and entrance are locked" },
  ],
};

// the brief already in the editor's draft, if one was assigned before; else the sample
const startingBrief = (): MissionBrief => loadProject().missionBrief ?? SAMPLE_BRIEF;

// how the last Assign went
type AssignState = "idle" | "assigned" | "failed";

export default function TeacherTemplateSetupPage() {
  const navigate = useNavigate();
  // a brief handed back by Exit preview (it may hold edits not assigned yet)
  const returnedBrief = (useLocation().state as PreviewState)?.brief;

  // the mission brief lives here, not in its panel, so Project details reads the same one
  const [brief, setBrief] = useState<MissionBrief>(() => returnedBrief ?? startingBrief());
  const [assign, setAssign] = useState<AssignState>("idle");

  // any edit after assigning means the editor's copy is out of date again
  const editBrief = (next: MissionBrief) => {
    setBrief(next);
    if (assign !== "idle") setAssign("idle");
  };

  // hand the brief to the editor: put it on the editor's saved draft (empty rows left out)
  const assignBrief = () => {
    const result = saveProject({ ...loadProject(), missionBrief: tidyBrief(brief) });
    setAssign(result === "failed" ? "failed" : "assigned");
  };

  // show the brief as a student sees it; it travels with the visit, nothing is saved
  const previewAsStudent = () => {
    const state: PreviewState = { brief };
    navigate(STUDENT_PREVIEW_PATH, { state });
  };

  return (
    <main className="setup-shell">
      <header className="setup-header">{/*HEADER: which project this is (left), what the teacher can do with it (right)*/}
        <div className="setup-header-project">
          <Link to="/teacher" className="setup-header-icon" title="Back to home"><Box size={22} /></Link>{/* the cube goes back to the teacher home page */}
          <div>
            <h1 className="setup-header-title">{SAMPLE_PROJECT.title}</h1>
            <p className="setup-header-sub">
              Your copy of the {SAMPLE_PROJECT.templateName} · {SAMPLE_PROJECT.room}
            </p>
          </div>
          <StatusChip tone="amber">Teacher view</StatusChip>
        </div>
        <div className="setup-header-actions">
          <Button onClick={previewAsStudent}>Preview as a student</Button>
          <Button variant="primary" onClick={assignBrief}>Assign to {SAMPLE_PROJECT.className}</Button>
        </div>
      </header>
      {/*WHAT HAPPENED: one line after Assign*/}
      {assign === "assigned" && (
        <p className="setup-notice setup-notice-green">
          The mission brief has been assigned to {SAMPLE_PROJECT.className}.
        </p>
      )}
      {assign === "failed" && (
        <p className="setup-notice setup-notice-red">
          Couldn't save the brief: this browser's storage is full or turned off.
        </p>
      )}
      <div className="setup-body">{/*THE THREE PANELS, side by side*/}
        <MissionBriefSection brief={brief} onChange={editBrief} />
        <SetupViewportSection />
        <ProjectDetailsSection className={SAMPLE_PROJECT.className} due={brief.due} />
      </div>
    </main>
  );
}
