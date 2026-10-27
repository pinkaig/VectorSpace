/**
 * @file        TeacherTemplateSetupPage.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Teacher template setup: the teacher's copy of a template, set up before it is
 *              assigned to a class. A header bar over three panels:
 *                Mission brief (left)  |  Room preview (middle)  |  Project details (right)
 *
 *              "Assign to <class>" saves the scene to the server as the teacher's template,
 *              then assigns it to the class with the mission brief (POST
 *              /projects/{id}/assign-class): the brief is stored on the class's assignment
 *              and every student without a copy gets one. Students open their copy at
 *              /editor/:projectId, which reads the brief from the assignment, so the editor
 *              shows it (sections/missionBrief/). Assigning again updates it for everyone.
 *              It also still writes the brief into this browser's draft (saveProject), which
 *              is all it does in offline mode (no VITE_API_URL).
 *              "Preview as a student" opens TeacherPreviewPage with the brief being edited
 *              (assigned or not). Nothing done in the preview is saved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Box } from "lucide-react";
import { loadProject, saveProject } from "../project/serializer";
import { apiUrl } from "../api/client";
import { listMyClasses, type ClassRow } from "../api/classes";
import { assignToClass, createTemplate, listMyTemplates, saveRevision } from "../api/projects";
import { useSession } from "../session/session";
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
type AssignState = "idle" | "assigning";

export default function TeacherTemplateSetupPage() {
  const navigate = useNavigate();
  const { getToken } = useSession();
  // what arrived with the visit: a brief handed back by Exit preview, or the
  // name, class and due date picked in the teacher home's New project popup
  const routeState = useLocation().state as
    | (PreviewState & { newProject?: { name: string; className: string; due: string } })
    | null;
  const returnedBrief = routeState?.brief;
  const newProject = routeState?.newProject;

  // the project in the header: the one just created, or the sample
  const project = newProject
    ? { ...SAMPLE_PROJECT, title: newProject.name, className: newProject.className }
    : SAMPLE_PROJECT;

  // the mission brief lives here, not in its panel, so Project details reads the same one.
  // A new project starts from the sample brief with the due date picked in the popup.
  const [brief, setBrief] = useState<MissionBrief>(() => {
    if (returnedBrief) return returnedBrief;
    if (newProject) {
      const [year, month, day] = newProject.due.split("-").map(Number);
      return { ...SAMPLE_BRIEF, due: formatDueDate(new Date(year, month - 1, day)) };
    }
    return startingBrief();
  });
  const [assign, setAssign] = useState<AssignState>("idle");
  // what went wrong with the last Assign, shown in the red notice
  const [problem, setProblem] = useState("");

  // the teacher's real classes on the server (empty in offline mode). The class picked in
  // the New project popup is used when a server class has the same name; else the first.
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  useEffect(() => {
    if (!apiUrl) return;
    let current = true;
    listMyClasses(getToken).then(
      (rows) => {
        if (!current) return;
        setClasses(rows);
        setClassId((rows.find((c) => c.name === project.className) ?? rows[0])?.id ?? "");
      },
      () => current && setProblem("Couldn't load your classes from the server."),
    );
    return () => { current = false; };
    // once per visit: getToken changes identity on re-render, the classes do not
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chosenClass = classes.find((c) => c.id === classId);
  const className = chosenClass?.name ?? project.className;

  // any edit clears the red notice
  const editBrief = (next: MissionBrief) => {
    setBrief(next);
    if (problem) setProblem("");
  };

  // save the brief (empty rows left out) to the server with the project, then back to the
  // teacher home, which shows the "assigned" banner. The browser draft gets the brief too,
  // so the local editor and the preview keep showing it.
  const assignBrief = async () => {
    const missionBrief = tidyBrief(brief);
    const draft = { ...loadProject(), name: project.title, missionBrief };
    const savedLocally = saveProject(draft) !== "failed";
    const fail = (text: string) => {
      setProblem(text);
      setAssign("idle");
    };

    if (apiUrl) {
      if (!chosenClass) return fail("You aren't in any class on the server, so there is no one to assign to.");
      setAssign("assigning");
      try {
        // 1. the teacher's template with this name, or a new one in this class
        const template =
          (await listMyTemplates(getToken, project.title)).find((t) => t.name === project.title) ??
          (await createTemplate(getToken, project.title, chosenClass.id));
        // 2. the scene as its newest revision: what each student's copy starts from
        await saveRevision(getToken, template.id, template.current_revision, { ...draft, id: template.id });
        // 3. the brief onto the class's assignment, and a copy for each student without one
        await assignToClass(getToken, template.id, {
          classId: chosenClass.id,
          missionBrief,
          dueAt: newProject?.due ?? null,
        });
      } catch (error) {
        return fail(`Couldn't assign on the server: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    } else if (!savedLocally) {
      return fail("Couldn't save the brief: this browser's storage is full or turned off.");
    }

    navigate("/teacher", {
      state: {
        assigned: {
          id: crypto.randomUUID(),
          projectName: project.title,
          className,
          due: brief.due,
        },
      },
    });
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
            <h1 className="setup-header-title">{project.title}</h1>
            <p className="setup-header-sub">
              Your copy of the {project.templateName} · {project.room}
            </p>
          </div>
          <StatusChip tone="amber">Teacher view</StatusChip>
        </div>
        <div className="setup-header-actions">
          <Button onClick={previewAsStudent}>Preview as a student</Button>
          {classes.length > 1 && (
            <select
              className="setup-class-select"
              aria-label="Class to assign to"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={assign === "assigning"}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <Button variant="primary" onClick={assignBrief} disabled={assign === "assigning"}>
            {assign === "assigning" ? "Assigning…" : `Assign to ${className}`}
          </Button>
        </div>
      </header>
      {/*WHAT HAPPENED: one line after Assign*/}
      {problem && (
        <p className="setup-notice setup-notice-red">
          {problem}
        </p>
      )}
      <div className="setup-body">{/*THE THREE PANELS, side by side*/}
        <MissionBriefSection brief={brief} onChange={editBrief} />
        <SetupViewportSection />
                <ProjectDetailsSection className={className} due={brief.due} />
      </div>
    </main>
  );
}
