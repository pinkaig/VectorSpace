/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building / Keep building / Fix my project, which
 *              opens the editor), the student's other projects, and the
 *              notification bell in the top bar. Uses the shared
 *              LandingPageTopBar. Everything shown comes from the API: the
 *              assigned project, its task, due date and teacher (assignments),
 *              and its status chip: Waiting for approval or Sent back from its
 *              newest hand-in, otherwise Published, Building or Not started.
 *              When the teacher sends it back, an amber banner and a popup
 *              show the teacher's comment. There are no notifications until
 *              the backend sends them.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../session/session";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import { MuseumPreview } from "../ui/museumPreview";
import { NotificationBell, type AppNotification } from "../ui/NotificationBell";
import { listMyProjects, type Project } from "../api/projects";
import { useLoad } from "../api/useLoad";
import { AlertTriangle, X } from "lucide-react";
import "./StudentHomePage.css";

// None until the backend sends notifications (new project, visits, approvals and grades).
const notifications: AppNotification[] = [];

// the chip on the assigned project: published, waiting for the teacher, sent back by them,
// untouched since the teacher sent it, or being built
const statusLabel = (project: Project): string => {
  // a published museum stays published while an update waits or after one is sent back
  if (project.status === "published") return project.review_status === "waiting" ? "Update waiting" : "Published";
  if (project.review_status === "sent_back") return "Sent back";
  if (project.review_status === "waiting") return "Waiting for approval";
  if (project.status === "archived") return "Archived";
  if (project.current_revision === 0) return "Not started";
  // a copy the teacher sent is saved once, by the teacher; the student's first save makes it theirs
  return project.saved_by_name === project.created_by_name
    ? "Building"
    : "Not started";
};

// the status chip's colour, from the manual's chip colours
const STATUS_CHIP: Record<string, string> = {
  "Sent back": "student-home-chip-red",
  "Waiting for approval": "student-home-chip",
  "Update waiting": "student-home-chip-green",
  Published: "student-home-chip-green",
  Building: "student-home-chip-purple",
  "Not started": "student-home-chip-muted",
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
  const {
    data: projects,
    error,
    loading,
  } = useLoad(() => listMyProjects(getToken), "my-projects");
  const firstName = displayName.split(" ")[0];
  const navigate = useNavigate();

  // the bell's dot shows while there is something new, until the student opens the list
  const [unread, setUnread] = useState(notifications.length > 0);

  // the "sent it back" popup with the teacher's comment
  const [commentOpen, setCommentOpen] = useState(false);

  useEffect(() => {
    if (!commentOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCommentOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [commentOpen]);

  // the student's projects, without archived ones
  const myProjects = (projects ?? []).filter((p) => p.status !== "archived");

  // the project the teacher assigned; until every student has one, fall back to the newest draft
  const assignedProject =
    myProjects.find((p) => p.assignment_id) ??
    myProjects.find((p) => p.status === "draft");

  // everything except the assigned one goes under "Your other projects"
  const otherProjects = myProjects.filter((p) => p.id !== assignedProject?.id);

  // the assigned project's status, and whether the teacher sent it back
  const status = assignedProject ? statusLabel(assignedProject) : "";
  const sentBack = status === "Sent back";
  const teacher = assignedProject?.assigned_by_name ?? "Your teacher";

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
              : sentBack
                ? `${teacher} left you a comment on your project.`
                : assignedProject
                  ? "You have a project waiting for you."
                  : "No projects yet. Your teacher will send you one."}
          </p>
        )}

        {sentBack && assignedProject && (
          <div className="student-home-banner" role="status">
            <span className="student-home-banner-icon">
              <AlertTriangle size={18} />
            </span>
            <span className="student-home-banner-text">
              {teacher} sent your {assignedProject.name} back with a comment.
            </span>
            <button
              type="button"
              className="student-home-banner-button"
              onClick={() => setCommentOpen(true)}
            >
              See comment
            </button>
          </div>
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
                <span
                  className={`student-home-chip ${STATUS_CHIP[status] ?? ""}`}
                >
                  {status}
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

              <div className="student-home-start-actions">
                <button
                  type="button"
                  className="student-home-start"
                  onClick={() => navigate(`/editor/${assignedProject.id}`)}
                >
                  {status === "Not started"
                    ? "Start building"
                    : sentBack
                      ? "Fix my project"
                      : status === "Published" || status === "Update waiting"
                        ? "Open my project"
                        : "Keep building"}
                </button>
                {/* the share link: the version the teacher approved, exactly as visitors see it */}
                {assignedProject.status === "published" && assignedProject.slug && (
                  <button
                    type="button"
                    className="student-home-start student-home-start-secondary"
                    onClick={() => navigate(`/visit/${assignedProject.slug}`)}
                  >
                    View live
                  </button>
                )}
              </div>
            </div>
          </article>
        )}

        {error && <p role="alert">Could not load your projects.</p>}

        {otherProjects.length > 0 && (
          <section className="student-home-all">
            <h2 className="student-home-all-title">
              All projects ({otherProjects.length})
            </h2>
            <div className="student-home-all-list">
              {!loading && otherProjects.length === 0 && (
                <p className="student-home-empty">No other projects yet.</p>
              )}
              {otherProjects.map((project) => {
                const rowStatus = statusLabel(project);
                const published = rowStatus === "Published" || rowStatus === "Update waiting";
                return (
                  <div key={project.id} className="student-home-row">
                    {project.assigned_by_name && (
                      <span className="student-home-from">
                        From {project.assigned_by_name}
                      </span>
                    )}
                    <span className="student-home-row-name">
                      {project.name}
                    </span>
                    <span
                      className={
                        published
                          ? "student-home-row-details student-home-row-details-published"
                          : "student-home-row-details"
                      }
                    >
                      {published
                        ? `Published${project.review_grade ? ` · Grade ${project.review_grade}` : ""}${rowStatus === "Update waiting" ? " · update waiting" : ""}`
                        : rowStatus === "Not started" ||
                            rowStatus === "Building"
                          ? `Draft · edited ${daysAgo(project.updated_at)}`
                          : rowStatus}
                    </span>
                    {/* the share link: the version the teacher approved, exactly as visitors see it */}
                    {project.status === "published" && project.slug && (
                      <button
                        type="button"
                        className="student-home-small"
                        onClick={() => navigate(`/visit/${project.slug}`)}
                      >
                        View live
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        published
                          ? "student-home-small"
                          : "student-home-small student-home-small-primary"
                      }
                      onClick={() => navigate(`/editor/${project.id}`)}
                    >
                      {published
                        ? "Open my project"
                        : rowStatus === "Sent back"
                          ? "Fix my project"
                          : "Keep building"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {commentOpen && assignedProject && (
          <div
            className="student-home-overlay"
            onClick={() => setCommentOpen(false)}
          >
            <div
              className="student-home-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-home-comment-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="student-home-dialog-head">
                <span className="student-home-banner-icon student-home-dialog-icon">
                  <AlertTriangle size={24} />
                </span>
                <div>
                  <h2
                    id="student-home-comment-title"
                    className="student-home-dialog-title"
                  >
                    {teacher} sent it back
                  </h2>
                  <p className="student-home-dialog-text">
                    {assignedProject.name} · {assignedProject.review_comment}
                  </p>
                </div>
                <button
                  type="button"
                  className="student-home-dialog-close"
                  aria-label="Close"
                  onClick={() => setCommentOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="student-home-dialog-actions">
                <button
                  type="button"
                  className="student-home-secondary"
                  onClick={() => setCommentOpen(false)}
                  autoFocus
                >
                  Close
                </button>
                <button
                  type="button"
                  className="student-home-start"
                  onClick={() => navigate(`/editor/${assignedProject.id}`)}
                >
                  Fix it now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
