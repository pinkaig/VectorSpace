/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building, which opens the editor), the student's
 *              other projects, and the notification bell in the top bar. Uses
 *              the shared LandingPageTopBar. Everything shown comes from the
 *              API: the assigned project, its task, due date and teacher
 *              (assignments), and its status, worked out from who saved it
 *              last. There are no notifications until the backend sends them.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../session/session";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import { MuseumPreview } from "../ui/museumPreview";
import { NotificationBell, type AppNotification } from "../ui/NotificationBell";
import { listMyProjects, type Project } from "../api/projects";
import { useLoad } from "../api/useLoad";
import "./StudentHomePage.css";

// None until the backend sends notifications (new project, visits, approvals and grades).
const notifications: AppNotification[] = [];

// the chip on the assigned project: published, waiting for the teacher, sent back by them,
// untouched since the teacher sent it, or being built
const statusLabel = (project: Project): string => {
  if (project.status === "published") return "Published";
  if (project.status === "archived") return "Archived";
  if (project.review_status === "waiting") return "Waiting for approval";
  if (project.review_status === "sent_back") return "Sent back";
  if (project.current_revision === 0) return "Not started";
  // a copy the teacher sent is saved once, by the teacher; the student's first save makes it theirs
  return project.saved_by_name === project.created_by_name ? "Building" : "Not started";
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

// "today", "yesterday" or "3 days ago", from an ISO date string
const daysAgo = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export default function StudentHomePage() {
  const { signOut, displayName, getToken } = useSession();
  const { data: projects, error, loading } = useLoad(
    () => listMyProjects(getToken),
    "my-projects",
  );
  const firstName = displayName.split(" ")[0];
  const navigate = useNavigate();

  // the bell's dot shows while there is something new, until the student opens the list
  const [unread, setUnread] = useState(notifications.length > 0);

  // the student's projects, without archived ones
  const myProjects = (projects ?? []).filter((p) => p.status !== "archived");

  // the project the teacher assigned; until every student has one, fall back to the newest draft
  const assignedProject =
    myProjects.find((p) => p.assignment_id) ??
    myProjects.find((p) => p.status === "draft");

  // everything except the assigned one goes under "Your other projects"
  const otherProjects = myProjects.filter((p) => p.id !== assignedProject?.id);

  return (
    <div className="student-home">
      <LandingPageTopBar
        userName={firstName}
        userSubline="Student"
        onSignOut={signOut}
        actions={
          <NotificationBell
            notifications={notifications}
            unread={unread}
            onOpen={() => setUnread(false)}
            footer="Grades show only to you, your teacher and VThere staff."
          />
        }
      />
      <main className="student-home-content">
        <h1 className="student-home-greeting">Hi {firstName}</h1>
        {!error && (
          <p className="student-home-lead">
            {loading
              ? "Loading your projects…"
              : assignedProject
                ? "You have a project waiting for you."
                : "No projects yet. Your teacher will send you one."}
          </p>
        )}

        {assignedProject?.assigned_by_name && (
          <h2 className="student-home-label">
            From {assignedProject.assigned_by_name}
          </h2>
        )}

        {assignedProject && (
          <article className="student-home-assigned">
            <div className="student-home-assigned-image">
              <MuseumPreview title={assignedProject.name} />
            </div>

            <div className="student-home-assigned-info">
              <div className="student-home-chips">
                {assignedProject.due_at && (
                  <span className="student-home-chip">
                    {dueLabel(assignedProject.due_at)}
                  </span>
                )}
                <span className="student-home-chip student-home-chip-muted">
                  {statusLabel(assignedProject)}
                </span>
              </div>

              <h3 className="student-home-assigned-title">
                {assignedProject.name}
              </h3>

              {assignedProject.task && (
                <p className="student-home-task">{assignedProject.task}</p>
              )}
              {assignedProject.template_name && (
                <p className="student-home-template">
                  Starts from {assignedProject.template_name}
                </p>
              )}

              <button
                type="button"
                className="student-home-start"
                onClick={() => navigate(`/editor/${assignedProject.id}`)}
              >
                {statusLabel(assignedProject) === "Not started"
                  ? "Start building"
                  : "Keep building"}
              </button>
            </div>
          </article>
        )}

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
                  ) : project.review_status === "waiting" ? (
                    <span className="student-home-other-sub">
                      Waiting for approval
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