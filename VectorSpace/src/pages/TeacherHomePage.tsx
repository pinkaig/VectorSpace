/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home (Classes tab): greeting with New project, the last
 *              project the teacher worked on (with Set up project and Review),
 *              and every project in a box that scrolls on its own. Shown inside
 *              TeacherLayout, which draws the top bar. Uses fake data until the
 *              backend has classes, due dates and submission counts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { MoreHorizontal, Plus } from "lucide-react";
import { useSession } from "../session/session";
import { ProjectListsSection } from "../sections/home/ProjectListsSection";
import { MuseumPreview } from "../ui/museumPreview";
import "./TeacherHomePage.css";

// Fake data until the backend has classes, due dates and submission counts.
const activeClass = {
  projectId: "fake-1",
  className: "Class 2B",
  due: "Due Friday",
  projectName: "Dinosaur museum",
  sent: 6,
  building: 15,
  notStarted: 3,
};

type ProjectRow = {
  id: string;
  className: string | null; // null = not assigned to a class yet
  name: string;
  details: string;
  published?: boolean;
  action: string;
  actionIsPrimary?: boolean;
};

const allProjects: ProjectRow[] = [
  {
    id: "fake-2",
    className: "Class 3A",
    name: "Ancient Egypt tour",
    details: "Published · 34 visits · most clicked: the mummy case",
    published: true,
    action: "See results",
  },
  {
    id: "fake-3",
    className: null,
    name: "Copy of Dinosaur museum",
    details: "Rooms, exhibits and brief copied · no student work",
    action: "Set up and assign",
    actionIsPrimary: true,
  },
];

function greetingForTime(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TeacherHomePage() {
  const { displayName } = useSession();

  return (
    <main className="teacher-home-content">
      <div className="teacher-home-header">
        <div>
          <h1 className="teacher-home-greeting">
            {greetingForTime()}, {displayName}
          </h1>
          <p className="teacher-home-lead">One class is building right now.</p>
        </div>
        <button type="button" className="teacher-home-primary teacher-home-new-button">
          <Plus size={18} />
          New project
        </button>
      </div>

      <h2 className="teacher-home-label">Pick up where you left off</h2>

      <article className="teacher-home-class">
        <div className="teacher-home-class-image">
          <MuseumPreview title={activeClass.projectName} />
        </div>

        <div className="teacher-home-class-info">
          <div className="teacher-home-chips">
            <span className="teacher-home-chip teacher-home-chip-dark">{activeClass.className}</span>
            <span className="teacher-home-chip">{activeClass.due}</span>
          </div>

          <h3 className="teacher-home-class-title">{activeClass.projectName}</h3>

          <div className="teacher-home-progress">
            <span className="teacher-home-progress-sent" style={{ flex: activeClass.sent }} />
            <span className="teacher-home-progress-building" style={{ flex: activeClass.building }} />
            <span className="teacher-home-progress-not-started" style={{ flex: activeClass.notStarted }} />
          </div>

          <p className="teacher-home-progress-legend">
            <span className="teacher-home-legend-sent"><strong>{activeClass.sent}</strong> sent for approval</span>
            <span className="teacher-home-legend-building"><strong>{activeClass.building}</strong> building</span>
            <span className="teacher-home-legend-not-started"><strong>{activeClass.notStarted}</strong> not started</span>
          </p>

          <div className="teacher-home-class-actions">
            <button type="button" className="teacher-home-primary">Set up project</button>
            <button type="button" className="teacher-home-secondary">
              Review {activeClass.sent} submissions
            </button>
          </div>
        </div>

        <button
          type="button"
          className="teacher-home-more teacher-home-class-more"
          aria-label={`More actions for ${activeClass.projectName}`}
        >
          <MoreHorizontal size={18} />
        </button>
      </article>

      <section className="teacher-home-all">
        <h2 className="teacher-home-all-title">All projects ({allProjects.length})</h2>
        <div className="teacher-home-all-list">
          {allProjects.map((project) => (
            <div key={project.id} className="teacher-home-row">
              <span
                className={
                  project.className
                    ? "teacher-home-chip teacher-home-chip-dark"
                    : "teacher-home-chip teacher-home-chip-muted"
                }
              >
                {project.className ?? "No class yet"}
              </span>
              <span className="teacher-home-row-name">{project.name}</span>
              <span
                className={
                  project.published
                    ? "teacher-home-row-details teacher-home-row-details-published"
                    : "teacher-home-row-details"
                }
              >
                {project.details}
              </span>
              <button
                type="button"
                className={project.actionIsPrimary ? "teacher-home-small teacher-home-small-primary" : "teacher-home-small"}
              >
                {project.action}
              </button>
              <button type="button" className="teacher-home-more" aria-label={`More actions for ${project.name}`}>
                <MoreHorizontal size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Temporary: Sherman's lists and the "send to a student" dev tool, until the real UI replaces them. */}
      <details className="teacher-home-dev">
        <summary>Developer: real projects and dev tools</summary>
        <ProjectListsSection />
      </details>
    </main>
  );
}