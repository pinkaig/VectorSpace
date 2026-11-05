/**
 * @file        TeacherWalkPage.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       /teacher/review/:projectId/walk: the Review tab's "Walk through it as a visitor".
 *              The same full view as a student's live link (VisitPage), showing the save the
 *              student handed in, the one the teacher is deciding on. Approving it is what
 *              visitors will see. "Back to Review" returns to the same museum on the Review tab.
 *
 *              The save comes from the newest hand-in (GET /projects/:id/submissions); a museum
 *              never handed in shows its latest save.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { apiFetch } from "../api/client";
import { getProject, listSubmissions, type Project } from "../api/projects";
import type { ProjectData } from "../project/model";
import { deserializeProject } from "../project/serializer";
import { entranceRoomId } from "../editor/roomLayout";
import RuntimeView from "../../apps/runtime/src/RuntimeApplication";
import { useSession } from "../session/session";
import "./VisitPage.css";

// what the Review tab hands here and gets back, so it opens on the same museum and tab
export type ReviewReturn = { selectedId?: string; tab?: string } | null;

type State =
  | { kind: "loading" }
  | { kind: "ready"; row: Project; project: ProjectData }
  | { kind: "problem"; text: string };

// the chip by the title: whether visitors see this save yet
const liveChip = (row: Project): { text: string; live: boolean } =>
  row.review_status === "waiting"
    ? { text: row.status === "published" ? "Update · not live yet" : "Not live yet", live: false }
    : row.status === "published"
      ? { text: "Live", live: true }
      : { text: "Not live yet", live: false };

export default function TeacherWalkPage() {
  const { projectId = "" } = useParams();
  const back = useLocation().state as ReviewReturn;
  const navigate = useNavigate();
  const { getToken } = useSession();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    (async () => {
      const [row, handIns] = await Promise.all([
        getProject(getToken, projectId),
        listSubmissions(getToken, projectId),
      ]);
      const versionId =
        handIns[0]?.version_id ?? (row as Project & { current_version_id?: string | null }).current_version_id;
      if (!versionId) throw new Error("Nothing is saved yet.");
      const version = await apiFetch<{ data: unknown }>(getToken, `/projects/${projectId}/versions/${versionId}`);
      const loaded = deserializeProject(JSON.stringify({ ...(version.data as object), id: row.id, name: row.name }));
      // the teacher comes in at the front, as a visitor does: Room 1
      const project = { ...loaded, activeSceneId: entranceRoomId(loaded) };
      return { row, project };
    })().then(
      ({ row, project }) => current && setState({ kind: "ready", row, project }),
      (error: unknown) =>
        current && setState({ kind: "problem", text: error instanceof Error ? error.message : "Something went wrong." }),
    );
    return () => { current = false; };
  }, [projectId, getToken]);

  const backToReview = () => navigate("/teacher/review", { state: { ...back, selectedId: projectId } });

  if (state.kind !== "ready") {
    return (
      <main className="visit-message">
        <div className="visit-card" role={state.kind === "problem" ? "alert" : "status"}>
          <h1 className="visit-title">{state.kind === "problem" ? "Couldn't open this project" : "Opening the project…"}</h1>
          {state.kind === "problem" && <p className="visit-text">{state.text}</p>}
          {state.kind === "problem" && <button type="button" className="visit-button" onClick={backToReview}>Back to Review</button>}
        </div>
      </main>
    );
  }

  const { row, project } = state;
  const byline = [`By ${row.created_by_name}`, row.class_name].filter(Boolean).join(" · ");
  const chip = liveChip(row);
  return (
    <div className="visit-page">
      <header className="visit-head">
        <div className="visit-head-text">
          <h1 className="visit-title">{row.created_by_name.split(" ")[0]}'s {row.name}</h1>
          <p className="visit-byline">{byline}</p>
        </div>
        <span className={chip.live ? "visit-live" : "visit-live visit-not-live"}>{chip.text}</span>
      </header>
      <RuntimeView
        project={project}
        title="Viewing · exactly what visitors see"
        onExit={backToReview}
        exitLabel="Back to Review"
        escapeExits={false}
      />
    </div>
  );
}
