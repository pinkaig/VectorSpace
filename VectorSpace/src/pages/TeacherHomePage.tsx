/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home (Classes tab): greeting with New project, the last
 *              project the teacher worked on, and every project in a box that
 *              scrolls on its own. Each project has a ⋯ menu: Duplicate,
 *              Archive (after it is due) and Delete (only when no student has
 *              started it, confirmed first). Shown inside TeacherLayout. Uses
 *              fake data until the backend has classes and submission counts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import {
  Archive,
  Copy,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
  hasStudentWork: boolean; // then it can't be deleted
  isPastDue: boolean; // only then can it be archived
  archived?: boolean;
  isNew?: boolean; // just duplicated: shown with a purple border
};

const startingProjects: ProjectRow[] = [
  {
    id: "fake-2",
    className: "Class 3A",
    name: "Ancient Egypt tour",
    details: "Published · 34 visits · most clicked: the mummy case",
    published: true,
    action: "See results",
    hasStudentWork: true,
    isPastDue: true,
  },
  {
    id: "fake-3",
    className: null,
    name: "Copy of Dinosaur museum",
    details: "Rooms, exhibits and brief copied · no student work",
    action: "Set up and assign",
    actionIsPrimary: true,
    hasStudentWork: false,
    isPastDue: false,
  },
];

function greetingForTime(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

type ProjectMenuProps = {
  name: string;
  open: boolean;
  onToggle: () => void;
  hasClass: boolean; // projects with no class yet have no Archive option
  archived?: boolean;
  canArchive: boolean; // only after it is due
  canDelete: boolean; // only when no student has started it
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

// The ⋯ button and its dropdown. It floats above the page (position: fixed), so the
// scrolling list can't cut it off, and opens upward when there's no room below.
function ProjectMenu({
  name,
  open,
  onToggle,
  hasClass,
  archived,
  canArchive,
  canDelete,
  onDuplicate,
  onArchive,
  onDelete,
}: ProjectMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});

  // works out where on screen the menu goes, from where the ⋯ button is
  const handleToggle = () => {
    const box = buttonRef.current?.getBoundingClientRect();
    if (box) {
      const right = window.innerWidth - box.right;
      const opensUp = box.bottom + 240 > window.innerHeight;
      setPlace(
        opensUp
          ? { bottom: window.innerHeight - box.top + 6, right }
          : { top: box.bottom + 6, right },
      );
    }
    onToggle();
  };

  return (
    <div className="teacher-home-menu-anchor">
      <button
        ref={buttonRef}
        type="button"
        className="teacher-home-more"
        aria-label={`More actions for ${name}`}
        aria-expanded={open}
        onClick={handleToggle}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="teacher-home-menu" role="menu" style={place}>
          {archived ? (
            <button
              type="button"
              role="menuitem"
              className="teacher-home-menu-item"
              onClick={onArchive}
            >
              <RotateCcw size={16} />
              <span>
                <strong>Restore</strong>
                <small>Put it back in Your classes</small>
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="teacher-home-menu-item"
                onClick={onDuplicate}
              >
                <Copy size={16} />
                <span>
                  <strong>Duplicate</strong>
                  <small>
                    {hasClass
                      ? "A copy you can give another class"
                      : "Another copy"}
                  </small>
                </span>
              </button>

              {hasClass && (
                <button
                  type="button"
                  role="menuitem"
                  className="teacher-home-menu-item"
                  disabled={!canArchive}
                  onClick={onArchive}
                >
                  <Archive size={16} />
                  <span>
                    <strong>Archive</strong>
                    <small>
                      {canArchive
                        ? "Hide it here. Its visitor link still works"
                        : "Available after it is due"}
                    </small>
                  </span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            role="menuitem"
            className="teacher-home-menu-item teacher-home-menu-item-danger"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 size={16} />
            <span>
              <strong>Delete</strong>
              <small>
                {canDelete
                  ? "It has no student work yet"
                  : "Has student work, so archive it instead"}
              </small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function TeacherHomePage() {
  const { displayName } = useSession();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(startingProjects);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // close the open menu on a click outside any menu, or on Escape
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".teacher-home-menu-anchor"))
        close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true); // true = also catches the list's own scrolling
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openMenuId]);

  const toggleMenu = (id: string) =>
    setOpenMenuId((current) => (current === id ? null : id));

  // a new "Copy of …" at the top of the list, marked as new
  const duplicate = (name: string) => {
    setProjects((current) => [
      {
        id: crypto.randomUUID(),
        className: null,
        name: `Copy of ${name}`,
        details: "Rooms, exhibits and brief copied · no student work",
        action: "Set up and assign",
        actionIsPrimary: true,
        hasStudentWork: false,
        isPastDue: false,
        isNew: true,
      },
      ...current.map((p) => ({ ...p, isNew: false })),
    ]);
    setOpenMenuId(null);
  };

  const toggleArchived = (id: string) => {
    setProjects((current) =>
      current.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)),
    );
    setOpenMenuId(null);
  };

  const askToDelete = (project: ProjectRow) => {
    setConfirmDelete(project);
    setOpenMenuId(null);
  };

  const deleteConfirmed = () => {
    if (!confirmDelete) return;
    setProjects((current) => current.filter((p) => p.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);
  // archived ones go at the bottom, only when shown
  const visibleProjects = showArchived
    ? [...activeProjects, ...archivedProjects]
    : activeProjects;

  return (
    <main className="teacher-home-content">
      <div className="teacher-home-header">
        <div>
          <h1 className="teacher-home-greeting">
            {greetingForTime()}, {displayName}
          </h1>
          <p className="teacher-home-lead">One class is building right now.</p>
        </div>
        <button
          type="button"
          className="teacher-home-primary teacher-home-new-button"
        >
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
            <button type="button" className="teacher-home-secondary" onClick={()=>navigate("/teacher/review")}>
              Review {activeClass.sent} submissions
            </button>
          </div>
        </div>

        {/* students are building it and it isn't due yet: duplicate only */}
        <ProjectMenu
          name={activeClass.projectName}
          open={openMenuId === activeClass.projectId}
          onToggle={() => toggleMenu(activeClass.projectId)}
          hasClass={true}
          canArchive={false}
          canDelete={false}
          onDuplicate={() => duplicate(activeClass.projectName)}
          onArchive={() => {}}
          onDelete={() => {}}
        />
      </article>

      <section className="teacher-home-all">
        <div className="teacher-home-all-head">
          <h2 className="teacher-home-all-title">
            All projects ({visibleProjects.length})
          </h2>
          {archivedProjects.length > 0 && (
            <button
              type="button"
              className="teacher-home-small teacher-home-archived-toggle"
              onClick={() => setShowArchived((value) => !value)}
            >
              <Archive size={15} />
              {showArchived
                ? "Hide archived"
                : `Archived (${archivedProjects.length})`}
            </button>
          )}
        </div>

        <div className="teacher-home-all-list">
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              className={[
                "teacher-home-row",
                project.isNew ? "teacher-home-row-new" : "",
                project.archived ? "teacher-home-row-archived" : "",
              ].join(" ")}
            >
              <span
                className={
                  project.archived
                    ? "teacher-home-chip teacher-home-chip-outline"
                    : project.className
                      ? "teacher-home-chip teacher-home-chip-dark"
                      : "teacher-home-chip teacher-home-chip-muted"
                }
              >
                {project.className ?? "No class yet"}
              </span>
              <span className="teacher-home-row-name">{project.name}</span>
              <span
                className={
                  project.published && !project.archived
                    ? "teacher-home-row-details teacher-home-row-details-published"
                    : "teacher-home-row-details"
                }
              >
                {project.archived
                  ? "Archived · visitor link still works"
                  : project.details}
              </span>
              {project.archived ? (
                <button
                  type="button"
                  className="teacher-home-small teacher-home-small-restore"
                  onClick={() => toggleArchived(project.id)}
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className={project.actionIsPrimary ? "teacher-home-small teacher-home-small-primary" : "teacher-home-small"}
                  onClick={() => {
                    if (project.action === "See results") navigate("/teacher/results");
                  }}
                >
                  {project.action}
                </button>
              )}
              <ProjectMenu
                name={project.name}
                open={openMenuId === project.id}
                onToggle={() => toggleMenu(project.id)}
                hasClass={project.className !== null}
                archived={project.archived}
                canArchive={project.isPastDue}
                canDelete={!project.hasStudentWork}
                onDuplicate={() => duplicate(project.name)}
                onArchive={() => toggleArchived(project.id)}
                onDelete={() => askToDelete(project)}
              />
            </div>
          ))}
        </div>
      </section>

      {confirmDelete && (
        <div
          className="teacher-home-overlay"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="teacher-home-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-home-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="teacher-home-dialog-icon">
              <Trash2 size={20} />
            </span>
            <h2
              id="teacher-home-delete-title"
              className="teacher-home-dialog-title"
            >
              Delete {confirmDelete.name}?
            </h2>
            <p className="teacher-home-dialog-text">
              Nobody has started it yet, so no student work is lost. This can't
              be undone.
            </p>
            <div className="teacher-home-dialog-actions">
              <button
                type="button"
                className="teacher-home-secondary"
                onClick={() => setConfirmDelete(null)}
                autoFocus
              >
                Keep it
              </button>
              <button
                type="button"
                className="teacher-home-danger"
                onClick={deleteConfirmed}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporary: Sherman's lists and the "send to a student" dev tool, until the real UI replaces them. */}
      <details className="teacher-home-dev">
        <summary>Developer: real projects and dev tools</summary>
        <ProjectListsSection />
      </details>
    </main>
  );
}
