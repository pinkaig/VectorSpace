/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building, which opens the editor), and the
 *              student's other projects. Uses the shared LandingPageTopBar.
 *              Uses fake data until the backend has due dates, tasks and
 *              assignment info.
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

// Fake data shaped like the API's Project. The ? fields don't exist in the backend yet.
type StudentProject = {
  id: string;
  name: string;
  statusLabel: "Not started" | "Building" | "Published" | "Draft";
  subline?: string; // "Published · 34 visits" / "Draft · edited 3 days ago"
  teacherName?: string; // missing in backend
  due?: string; // missing in backend
  task?: string; // missing in backend
  templateName?: string;
};

// "today", "yesterday" or "3 days ago", from an ISO date string
const daysAgo = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
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

export default function StudentHomePage() {
  const { signOut, displayName, getToken } = useSession();
  const { data: projects, error } = useLoad(
    () => listMyProjects(getToken),
    "my-projects",
  );
  const otherProjects = (projects ?? []).filter((p) => p.status !== "archived");
  const firstName = displayName.split(" ")[0];
  const navigate = useNavigate();

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

        {assigned.teacherName && (
          <h2 className="student-home-label">From {assigned.teacherName}</h2>
        )}

        <article className="student-home-assigned">
          <div className="student-home-assigned-image">
            <MuseumPreview title={assigned.name} />
          </div>

          <div className="student-home-assigned-info">
            <div className="student-home-chips">
              {assigned.due && (
                <span className="student-home-chip">{assigned.due}</span>
              )}
              <span className="student-home-chip student-home-chip-muted">
                {assigned.statusLabel}
              </span>
            </div>
            <h3 className="student-home-assigned-title">{assigned.name}</h3>
            {assigned.task && (
              <p className="student-home-task">{assigned.task}</p>
            )}
            {assigned.templateName && (
              <p className="student-home-template">
                Starts from {assigned.templateName} · 2 rooms ready for you
              </p>
            )}
            <button
              type="button"
              className="student-home-start"
              onClick={() => navigate(`/editor/${assigned.id}`)}
            >
              Start building
            </button>
          </div>
        </article>

        {otherProjects.length > 0 && (
          <section className="student-home-others">
            <h2 className="student-home-label">Your other projects</h2>

            <div className="student-home-others-grid">
              {error && <p role="alert">Could not load your projects.</p>}
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
