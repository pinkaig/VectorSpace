/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home (Classes tab): greeting, the teacher's active
 *              class card (with Set up project and Review), published
 *              projects, and starting a new project from the museum template.
 *              Shown inside TeacherLayout, which draws the top bar. Uses fake
 *              data until the backend has classes, due dates and submission
 *              counts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Box, Plus } from "lucide-react";
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

const publishedProjects = [
  {
    projectId: "fake-2",
    className: "Class 3A",
    projectName: "Ancient Egypt tour",
    visits: 34,
    mostClicked: "the mummy case",
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
      <h1 className="teacher-home-greeting">
        {greetingForTime()}, {displayName}
      </h1>
      <p className="teacher-home-lead">One class is building right now.</p>

      <h2 className="teacher-home-label">Your classes</h2>

      <article className="teacher-home-class">
        <div className="teacher-home-class-image">
          <MuseumPreview title={activeClass.projectName} />
        </div>

        <div className="teacher-home-class-info">
          <div className="teacher-home-chips">
            <span className="teacher-home-chip teacher-home-chip-dark">
              {activeClass.className}
            </span>
            <span className="teacher-home-chip">{activeClass.due}</span>
          </div>

          <h3 className="teacher-home-class-title">
            {activeClass.projectName}
          </h3>

          <div className="teacher-home-progress">
            <span
              className="teacher-home-progress-sent"
              style={{ flex: activeClass.sent }}
            />
            <span
              className="teacher-home-progress-building"
              style={{ flex: activeClass.building }}
            />
            <span
              className="teacher-home-progress-not-started"
              style={{ flex: activeClass.notStarted }}
            />
          </div>

          <p className="teacher-home-progress-legend">
            <span className="teacher-home-legend-sent">
              <strong>{activeClass.sent}</strong> sent for approval
            </span>
            <span className="teacher-home-legend-building">
              <strong>{activeClass.building}</strong> building
            </span>
            <span className="teacher-home-legend-not-started">
              <strong>{activeClass.notStarted}</strong> not started
            </span>
          </p>

          <div className="teacher-home-class-actions">
            <button type="button" className="teacher-home-primary">
              Set up project
            </button>
            <button type="button" className="teacher-home-secondary">
              Review {activeClass.sent} submissions
            </button>
          </div>
        </div>
      </article>

      {publishedProjects.map((project) => (
        <div key={project.projectId} className="teacher-home-published">
          <span className="teacher-home-chip teacher-home-chip-dark">
            {project.className}
          </span>
          <span className="teacher-home-published-name">
            {project.projectName}
          </span>
          <span className="teacher-home-published-stats">
            Published · {project.visits} visits · most clicked:{" "}
            {project.mostClicked}
          </span>
          <button type="button" className="teacher-home-small">
            See results
          </button>
        </div>
      ))}

      <section className="teacher-home-new-section">
        <h2 className="teacher-home-label">Start a new project</h2>

        <div className="teacher-home-new">
          <div className="teacher-home-new-icon">
            <Box size={22} />
          </div>
          <div className="teacher-home-new-text">
            <strong>Museum template</strong>
            <span>
              Two rooms ready for exhibits. You get your own copy to set up for
              your class.
            </span>
          </div>
          <button
            type="button"
            className="teacher-home-primary teacher-home-new-button"
          >
            <Plus size={18} />
            New project
          </button>
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
