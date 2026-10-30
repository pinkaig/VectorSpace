/**
 * @file        TeacherTemplateSetupPage.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @author      Daniel Tee
 * @brief       Teacher template setup: the teacher's copy of a template, set up before it is
 *              assigned to a class. A header bar over three panels:
 *                Mission brief (left)  |  Room preview (middle)  |  Project details (right)
 *
 *              "Assign to <class>" saves the mission brief and the rooms added in the middle
 *              panel. A project from the server (made by the teacher home's New project, or
 *              opened from its list) first asks which class and which students
 *              (AssignDialogSection), then is saved there as its next revision, filed under that
 *              class, and a copy is sent to each picked student. Offline, they are
 *              written into the editor's draft saved in this browser (saveProject). The editor
 *              shows it as the students' brief (sections/missionBrief/). Pressing Assign again
 *              replaces it.
 *              "Preview as a student" opens TeacherPreviewPage with the brief being edited
 *              (assigned or not). Nothing done in the preview is saved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Box } from "lucide-react";
import { loadProject, saveProject } from "../project/serializer";
import { defaultEnvironmentId, findEnvironment, type ProjectData } from "../project/model";
import { studentRoomEnv } from "../editor/roomLayout";
import { loadRemoteProject } from "../project/remoteProject";
import { removeEditorScene, selectEditorScene, updateEditorScene } from "../editor/editorOperations";
import { ApiError, apiUrl } from "../api/client";
import { getProject, saveProjectContent, sendToStudents, setProjectClass, type ClassSendResult } from "../api/projects";
import { useSession } from "../session/session";
import { Button } from "../ui/button";
import { StatusChip } from "../ui/statusChip";
import { MissionBriefSection } from "../sections/templateSetup/MissionBriefSection";
import { SetupViewportSection } from "../sections/templateSetup/SetupViewportSection";
import { ProjectDetailsSection } from "../sections/templateSetup/ProjectDetailsSection";
import { AssignDialogSection, type AssignChoice } from "../sections/templateSetup/AssignDialogSection";
import { formatDueDate, tidyBrief, type MissionBrief } from "../mission/missionBrief";
import { assignDetailsFromBrief } from "../api/assignmentFromBrief";
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

// the draft with every room but Room 1 removed (removeEditorScene also drops what pointed at
// them), and Room 1 in the middle of the rooms map
const onlyFirstRoom = (from: ProjectData): ProjectData => {
  const project = from.scenes.slice(1).reduce((next, room) => removeEditorScene(next, room.id).project, from);
  return updateEditorScene(selectEditorScene(project, project.scenes[0].id).project, project.scenes[0].id, { layout: { x: 0, z: 0 } }).project;
};

// Room 1 as the room picked in the New project popup, named after it like a room added on
// this page. Nothing picked (students pick) or a room no longer in the library starts it as
// Empty, never as whatever the last draft in this browser had.
const withFirstRoom = (project: ProjectData, environmentId: string | null | undefined): ProjectData => {
  const env = findEnvironment(environmentId ?? defaultEnvironmentId);
  return updateEditorScene(project, project.scenes[0].id, { environmentId: env.id, name: env.name }).project;
};

// what the teacher home's New project popup sends; projectId (and classId, if a class was
// picked) are set when the project was made on the server
type NewProject = {
  projectId?: string;
  classId?: string | null;
  name: string;
  className: string;
  due: string;
  firstRoom?: string | null;
};

// what arrived with the visit: a brief handed back by Exit preview, the New project popup's
// picks, or the id of a project on the server opened from the teacher home's list
type SetupRouteState = (PreviewState & { newProject?: NewProject }) | null;

// what the page opens with
type SetupStart = {
  project: typeof SAMPLE_PROJECT;
  brief: MissionBrief;
  draft: ProjectData;
  // the project on the server Assign saves to, and the revision it was loaded at
  // (0 before its first save); no id = saved in this browser only
  projectId?: string;
  revision: number;
  // the class whose students Assign sends a copy to; none = saved only
  classId?: string | null;
};

// a brand new project's start: the popup's picks over Room 1 of this browser's draft
const newStart = (newProject: NewProject, returnedBrief?: MissionBrief): SetupStart => {
  const [year, month, day] = newProject.due.split("-").map(Number);
  return {
    project: { ...SAMPLE_PROJECT, title: newProject.name, className: newProject.className },
    brief: returnedBrief ?? { ...SAMPLE_BRIEF, due: formatDueDate(new Date(year, month - 1, day)) },
    draft: withFirstRoom(onlyFirstRoom(loadProject()), newProject.firstRoom),
    projectId: newProject.projectId,
    revision: 0,
    classId: newProject.classId,
  };
};

// offline, or no project picked: this browser's draft, as before there was a server
const localStart = (returnedBrief?: MissionBrief): SetupStart => ({
  project: SAMPLE_PROJECT,
  brief: returnedBrief ?? startingBrief(),
  draft: loadProject(),
  revision: 0,
});

export default function TeacherTemplateSetupPage() {
  const routeState = useLocation().state as SetupRouteState;
  const { getToken } = useSession();
  const returnedBrief = routeState?.brief;
  const newProject = routeState?.newProject;
  // a project already on the server, opened from the list or back from the preview
  const openId = !newProject && apiUrl ? routeState?.projectId : undefined;

  const [start, setStart] = useState<SetupStart | null>(() => {
    if (newProject) return newStart(newProject, returnedBrief);
    return openId ? null : localStart(returnedBrief);
  });
  const [problem, setProblem] = useState<string | null>(null);

  // opens a project on the server: its row (name, class) and its latest save. One that was
  // never saved starts like a new project, on an Empty Room 1.
  useEffect(() => {
    if (!openId) return;
    let current = true; // false once the page moved on, so a slow answer is not shown late
    Promise.all([getProject(getToken, openId), loadRemoteProject(getToken, openId)]).then(
      ([row, remote]) => {
        if (!current) return;
        const saved = remote.revision > 0;
        setStart({
          project: { ...SAMPLE_PROJECT, title: row.name, className: row.class_name ?? "no class" },
          brief: returnedBrief ?? (saved ? remote.project.missionBrief : undefined) ?? SAMPLE_BRIEF,
          draft: saved ? remote.project : withFirstRoom(onlyFirstRoom(loadProject()), null),
          projectId: openId,
          revision: remote.revision,
          classId: row.class_id,
        });
      },
      (error: Error) => current && setProblem(error.message),
    );
    return () => {
      current = false;
    };
    // the id is what says "open another project"
  }, [openId]);

  if (problem) return <p role="alert">Couldn't open the project: {problem}</p>;
  if (!start) return <p>Opening project…</p>;
  return <SetupScreen start={start} />;
}

function SetupScreen({ start }: { start: SetupStart }) {
  const navigate = useNavigate();
  const { getToken } = useSession();
  const { project, projectId } = start;

  // the mission brief lives here, not in its panel, so Project details reads the same one
  const [brief, setBrief] = useState<MissionBrief>(start.brief);
  const [draft, setDraft] = useState(start.draft);
  // the server's revision this page last loaded or saved, sent with the next save
  const [revision, setRevision] = useState(start.revision);
  const [saving, setSaving] = useState(false);
  // why the last Assign failed, shown under the header
  const [failed, setFailed] = useState<string | null>(null);

  const editBrief = (next: MissionBrief) => {
    setBrief(next);
    setFailed(null);
  };
  const editDraft = (next: ProjectData) => {
    setDraft(next);
    setFailed(null);
  };

  // a server project's Assign first asks which class and which students (AssignDialogSection)
  const [choosing, setChoosing] = useState(false);
  const closeChooser = useCallback(() => setChoosing(false), []);

  // Save the brief (empty rows left out) and rooms: to the server for a server project, else
  // as the editor's draft in this browser. For a server project, `choice` (from the popup)
  // files it under the picked class and sends a copy to each picked student. Then back to the
  // teacher home, which shows the banner.
  const assignBrief = async (choice?: AssignChoice) => {
    // the room types students can add are saved as a list even when the teacher left the
    // defaults, so a student deleting a room later can't take its kind off their list
    const content = {
      ...draft,
      missionBrief: tidyBrief(brief),
      validateEnvironment: studentRoomEnv(draft).map((env) => env.id),
    };
    let className = project.className;
    let sent: ClassSendResult | undefined;
    let sendProblem: string | undefined;
    if (projectId) {
      setSaving(true);
      try {
        // the server's id and name win over whatever the draft carried
        const saved = await saveProjectContent(getToken, projectId, revision, { ...content, id: projectId, name: project.title });
        setRevision(saved.revision);
        if (choice) {
          className = choice.className;
          // saved first, so the copies hold this save; a failed send leaves the save in place
          try {
            if (choice.classId !== start.classId) await setProjectClass(getToken, projectId, choice.classId);
            const result = await sendToStudents(getToken, projectId, choice.studentIds, assignDetailsFromBrief(content.missionBrief));
            sent = { ...result, alreadyHad: 0 };
          } catch (error) {
            sendProblem = (error as Error).message;
          }
        }
      } catch (error) {
        setFailed(
          error instanceof ApiError && error.status === 409
            ? "Couldn't save: this project was saved somewhere else since you opened it. Open it again from the teacher home to get those changes."
            : `Couldn't save to the server: ${(error as Error).message}`,
        );
        setChoosing(false);
        return;
      } finally {
        setSaving(false);
      }
    } else if (saveProject(content) === "failed") {
      setFailed("Couldn't save the brief: this browser's storage is full or turned off.");
      return;
    }

    navigate("/teacher", {
      state: {
        assigned: {
          id: projectId ?? crypto.randomUUID(),
          projectName: project.title,
          className,
          due: brief.due,
          sent,
          sendProblem,
        },
      },
    });
  };

  // show the brief as a student sees it; it travels with the visit, nothing is saved. A server
  // project's id goes along so Exit preview comes back to it.
  const previewAsStudent = () => {
    const state: PreviewState = { brief, projectId };
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
          <Button variant="primary" onClick={() => (projectId ? setChoosing(true) : void assignBrief())} disabled={saving}>
            {saving ? "Saving…" : projectId ? "Assign…" : `Assign to ${project.className}`}
          </Button>
        </div>
      </header>
      {/*WHAT HAPPENED: one line after a failed Assign*/}
      {failed && <p className="setup-notice setup-notice-red">{failed}</p>}
      <div className="setup-body">{/*THE THREE PANELS, side by side*/}
        <MissionBriefSection brief={brief} onChange={editBrief} />
        <SetupViewportSection draft={draft} onChange={editDraft} />
        <ProjectDetailsSection className={project.className} due={brief.due} draft={draft} onChange={editDraft} />
      </div>
      {choosing && projectId && (
        <AssignDialogSection
          getToken={getToken}
          projectId={projectId}
          projectName={project.title}
          classId={start.classId}
          saving={saving}
          onCancel={closeChooser}
          onAssign={(choice) => void assignBrief(choice)}
        />
      )}
    </main>
  );
}
