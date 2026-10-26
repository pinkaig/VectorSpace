/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building, which opens the editor), and the
 *              student's other projects. Uses the shared LandingPageTopBar.
 *              Until the backend marks which project is assigned, the newest
 *              draft stands in for it; its due date and task are still fake.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useSession } from "../session/session";
import { useNavigate } from "react-router";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import { MuseumPreview } from "../ui/museumPreview";
import { listMyProjects } from "../api/projects";
import { useLoad } from "../api/useLoad";
import "./StudentHomePage.css";

// Fake data for what the backend doesn't have yet. The ? fields don't exist in the backend.
type StudentProject = {
  id: string;
  name: string;
  statusLabel: "Not started" | "Building" | "Published" | "Draft";
  teacherName?: string; // missing in backend
  due?: string; // missing in backend
  task?: string; // missing in backend
  templateName?: string;
};

// "Due Friday" when it's within a week, otherwise "Due 30 Oct"
const dueLabel = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days >= 0 && days < 7)
    return `Due ${due.toLocaleDateString("en-GB", { weekday: "long" })}`;
  return `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
};

const assigned: StudentProject = {
  id: "fake-1",
  name: "Dinosaur museum",
  statusLabel: "Not started",
  teacherName: "Ms Tan",
  due: "Due Friday",
  task: "Build a virtual exhibition about dinosaurs. Add at least 3 exhibits with facts, and one thing that reacts when visitors click.",
  templateName: "the museum template",
};

// "today", "yesterday" or "3 days ago", from an ISO date string
const daysAgo = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export default function StudentHomePage() {
  const { signOut, displayName, getToken } = useSession();
  const { data: projects, error } = useLoad(
    () => listMyProjects(getToken),
    "my-projects",
  );
  const firstName = displayName.split(" ")[0];
  const navigate = useNavigate();

  // NEW: the student's projects, without archived ones
  const myProjects = (projects ?? []).filter((p) => p.status !== "archived");

  // the project the teacher assigned; until every student has one, fall back to the newest draft
  const assignedProject =
    myProjects.find((p) => p.assignment_id) ??
    myProjects.find((p) => p.status === "draft");

  // CHANGED: everything except the stand-in goes under "Your other projects"
  const otherProjects = myProjects.filter((p) => p.id !== assignedProject?.id);

  return (
    <div className="student-home">
      <LandingPageTopBar
        userName={firstName}
        userSubline="Sec 2B · Student"
        onSignOut={signOut}
      />
      <main className="student-home-content">
        <h1 className="student-home-greeting">Hi {firstName}</h1>
        <p className="student-home-lead">
          You have one project waiting for you.
        </p>

        {assignedProject?.assigned_by_name && (
          <h2 className="student-home-label">
            From {assignedProject.assigned_by_name}
          </h2>
        )}

        <article className="student-home-assigned">
          <div className="student-home-assigned-image">
            <MuseumPreview title={assignedProject?.name ?? assigned.name} />
          </div>

          <div className="student-home-assigned-info">
            <div className="student-home-chips">
              {assignedProject?.due_at && (
                <span className="student-home-chip">
                  {dueLabel(assignedProject.due_at)}
                </span>
              )}
              <span className="student-home-chip student-home-chip-muted">
                {assigned.statusLabel}
              </span>
            </div>

            {/* CHANGED: the real project's name, the fake one while loading */}
            <h3 className="student-home-assigned-title">
              {assignedProject?.name ?? assigned.name}
            </h3>

            {assignedProject?.task && (
              <p className="student-home-task">{assignedProject.task}</p>
            )}
            {assigned.templateName && (
              <p className="student-home-template">
                Starts from {assigned.templateName} · 2 rooms ready for you
              </p>
            )}

            {/* CHANGED: opens the real project; greyed out while loading or with no draft */}
            <button
              type="button"
              className="student-home-start"
              disabled={!assignedProject}
              onClick={() =>
                assignedProject && navigate(`/editor/${assignedProject.id}`)
              }
            >
              Start building
            </button>
          </div>
        </article>

        {error && <p role="alert">Could not load your projects.</p>}

        {otherProjects.length > 0 && (
          <section className="student-home-others">
            <h2 className="student-home-label">Your other projects</h2>

            <div className="student-home-others-grid">
              {otherProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="student-home-other"
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  <span className="student-home-other-name">
                    {project.name}
                  </span>
                  {project.status === "published" ? (
                    <span className="student-home-other-sub student-home-other-sub-published">
                      Published
                    </span>
                  ) : (
                    <span className="student-home-other-sub">
                      Draft · edited {daysAgo(project.updated_at)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
