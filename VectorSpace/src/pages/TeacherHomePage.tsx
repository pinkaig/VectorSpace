/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home (Classes tab): greeting with New project (a popup
 *              that names the project, picks the class and due date, then opens
 *              template setup), the last project the teacher worked on, and
 *              every project in a box that scrolls on its own. Each project has
 *              a ⋯ menu: Duplicate, Archive (after it is due) and Delete (only
 *              when no student has started it, confirmed first). Shows a banner
 *              after a project is assigned on template setup. Shown inside
 *              TeacherLayout. Uses fake data until the backend has classes and
 *              submission counts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Archive,
  Box,
  Check,
  Copy,
  Info,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  X,
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
  justAssigned?: boolean; // just assigned from template setup: shown with a green border
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

// The list as the teacher left it. It lives outside the component, so leaving the page
// (Results, template setup) and coming back keeps new, archived and deleted projects.
// Fake until the API stores projects; a page refresh starts over.
let savedProjects: ProjectRow[] = startingProjects;

// what template setup's Assign sends back
type AssignedNote = {
  id: string;
  projectName: string;
  className: string;
  due?: string;
};

// the "assigned" banner, kept until the teacher clicks OK (even across tab switches)
let savedBanner: AssignedNote | null = null;

// Fake until the frontend loads the teacher's real classes (GET /classes).
const classOptions = ["Class 2B", "Class 3A", "Class 3B"];

// a week from today as "2026-11-02", the format a date box uses
const inAWeek = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

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
  const location = useLocation();

  // set by template setup's Assign button: which project just went to which class
  const assigned = (location.state as { assigned?: AssignedNote } | null)
    ?.assigned;

  // a project just assigned shows first in the list, with a green border
  const [projects, setProjects] = useState<ProjectRow[]>(() => savedProjects);

  // shows the banner from this visit, or the one still waiting for OK
  const [banner, setBanner] = useState<AssignedNote | null>(
    () => assigned ?? savedBanner,
  );

  // keep the saved copy up to date after every change
  useEffect(() => {
    savedProjects = projects;
  }, [projects]);

  // a project just assigned on template setup goes first in the list, with a green border.
  // Its id makes sure it's only added once, even if this runs twice.
  useEffect(() => {
    if (!assigned) return;
    savedBanner = assigned;
    setBanner(assigned);
    setProjects((current) =>
      current.some((p) => p.id === assigned.id)
        ? current
        : [
            {
              id: assigned.id,
              className: assigned.className,
              name: assigned.projectName,
              details: `${assigned.due ? `Due ${assigned.due} · ` : ""}Assigned just now · 0 of 24 started`,
              action: "Set up project",
              hasStudentWork: false,
              isPastDue: false,
              justAssigned: true,
            },
            ...current.map((p) => ({ ...p, justAssigned: false })),
          ],
    );
  }, [assigned]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // the New project popup
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState(classOptions[0]);
  const [newDue, setNewDue] = useState(inAWeek);

  // OK hides the banner for good, and clears it from this visit so Back doesn't bring it back
  const dismissAssigned = () => {
    savedBanner = null;
    setBanner(null);
    navigate(location.pathname, { replace: true, state: null });
  };

  // close the open ⋯ menu on a click outside any menu, on Escape, scroll or resize
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

  // Escape closes the New project popup
  useEffect(() => {
    if (!newOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNewOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [newOpen]);

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

  // opens the popup with empty fields each time
  const openNewProject = () => {
    setNewName("");
    setNewClass(classOptions[0]);
    setNewDue(inAWeek());
    setNewOpen(true);
  };

  // goes to template setup with what was picked; an empty name becomes "New museum"
  const createAndSetUp = () => {
    navigate("/teacher/template", {
      state: {
        newProject: {
          name: newName.trim() || "New museum",
          className: newClass,
          due: newDue,
        },
      },
    });
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);
  // archived ones go at the bottom, only when shown
  const visibleProjects = showArchived
    ? [...activeProjects, ...archivedProjects]
    : activeProjects;

  return (
    <main className="teacher-home-content">
      {banner && (
        <div className="teacher-home-banner" role="status">
          <Check size={18} />
          <span>
            <strong>{banner.projectName}</strong> is assigned to{" "}
            {banner.className}. Students will see it the next time they sign in.
          </span>
          <button
            type="button"
            className="teacher-home-small"
            onClick={dismissAssigned}
          >
            OK
          </button>
        </div>
      )}

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
          onClick={openNewProject}
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
            <button
              type="button"
              className="teacher-home-primary"
              onClick={() => navigate("/teacher/template")}
            >
              Set up project
            </button>
            <button
              type="button"
              className="teacher-home-secondary"
              onClick={() => navigate("/teacher/review")}
            >
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
                project.justAssigned ? "teacher-home-row-assigned" : "",
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
                  className={
                    project.actionIsPrimary
                      ? "teacher-home-small teacher-home-small-primary"
                      : "teacher-home-small"
                  }
                  onClick={() => {
                    if (project.action === "See results")
                      navigate("/teacher/results");
                    if (
                      project.action === "Set up and assign" ||
                      project.action === "Set up project"
                    )
                      navigate("/teacher/template");
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

      {newOpen && (
        <div className="teacher-home-overlay" onClick={() => setNewOpen(false)}>
          <div
            className="teacher-home-dialog teacher-home-dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-home-new-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="teacher-home-dialog-head">
              <div>
                <h2
                  id="teacher-home-new-title"
                  className="teacher-home-dialog-title"
                >
                  New project
                </h2>
                <p className="teacher-home-dialog-text">
                  Name it and pick the class. You'll write the brief and rules
                  next.
                </p>
              </div>
              <button
                type="button"
                className="teacher-home-more"
                aria-label="Close"
                onClick={() => setNewOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="teacher-home-template">
              <span className="teacher-home-template-icon">
                <Box size={18} />
              </span>
              <span className="teacher-home-template-text">
                <strong>Museum template</strong>
                <small>Two rooms ready for exhibits</small>
              </span>
            </div>

            <label
              className="teacher-home-field-label"
              htmlFor="new-project-name"
            >
              Project name
            </label>
            <input
              id="new-project-name"
              className="teacher-home-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Volcano museum"
              autoFocus
            />

            <div className="teacher-home-new-row">
              <div>
                <span className="teacher-home-field-label">Class</span>
                <div
                  className="teacher-home-class-picks"
                  role="radiogroup"
                  aria-label="Class"
                >
                  {classOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={newClass === name}
                      className={
                        newClass === name
                          ? "teacher-home-pick teacher-home-pick-selected"
                          : "teacher-home-pick"
                      }
                      onClick={() => setNewClass(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  className="teacher-home-field-label"
                  htmlFor="new-project-due"
                >
                  Due
                </label>
                <input
                  id="new-project-due"
                  type="date"
                  className="teacher-home-input"
                  value={newDue}
                  onChange={(event) => setNewDue(event.target.value)}
                />
              </div>
            </div>

            <p className="teacher-home-note">
              <Info size={15} />
              This makes your own copy. The VThere template stays the same for
              every teacher.
            </p>

            <div className="teacher-home-dialog-actions">
              <button
                type="button"
                className="teacher-home-secondary"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="teacher-home-primary"
                onClick={createAndSetUp}
              >
                Create and set up
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
