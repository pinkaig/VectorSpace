/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home (Classes tab): greeting with New project (a popup
 *              that names the project, picks the class and due date, then opens
 *              template setup), how many classes are building, the "Pick up
 *              where you left off" card (the newest assigned project that is not
 *              due yet), and every other project in a box that scrolls on its
 *              own. Each project has a ⋯ menu: Duplicate, Archive (after it is
 *              due) and Delete (only when no student has started it, confirmed
 *              first). Shows a banner after a project is assigned on template
 *              setup. Shown inside TeacherLayout. With a server (VITE_API_URL),
 *              the list is the teacher's own projects from the database, New
 *              project creates one there for a real class, and Archive,
 *              Duplicate and Delete are API calls. Delete is only for a draft
 *              nobody was sent; anything published or sent is archived instead.
 *              Offline, the list is this visit's only and the classes are made up.
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
import { defaultEnvironmentId, environmentLibrary } from "../project/model";
import { loadRemoteProject } from "../project/remoteProject";
import { apiUrl } from "../api/client";
import { listMyClasses } from "../api/classes";
import {
  createClassProject,
  deleteProject,
  listMyProjects,
  saveProjectContent,
  setProjectStatus,
  type ClassSendResult,
  type Project,
} from "../api/projects";
import { useLoad } from "../api/useLoad";
import { MuseumPreview } from "../ui/museumPreview";
import { ProjectListsSection } from "../sections/home/ProjectListsSection";
import "./TeacherHomePage.css";

// Room 1 of a new project starts as Empty unless the teacher picks another room.
const firstRoomDefault = defaultEnvironmentId;

// Every room is on until the admin Rooms setting is stored per school (see api/adminFake.ts);
// a room that is off is shown greyed out and can't be picked.
const isTurnedOn = (_environmentId: string): boolean => true;

// the same colours, in the same order, as the room chips on template setup (templateSetup.css)
const ROOM_TONES = 6;

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
  onServer?: boolean; // a row from the database: its menu calls the API
  deleteHint?: string; // why Delete is off for a database row
};

// The database's rule: only a draft nobody was sent can be deleted; anything else is archived.
const deleteHintFor = (project: Project): string | undefined => {
  if (project.sent) return "Sent to students, so archive it instead";
  if (project.status !== "draft") return "Only drafts can be deleted: archive it instead";
  return undefined;
};

// "today", "yesterday" or "3 days ago", from an ISO date string
const daysAgo = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

// true once the due day is over, so the project can be archived. No due date (never
// assigned) counts as past due, same as before.
const dueHasPassed = (dueAt: string | null | undefined): boolean => {
  if (!dueAt) return true;
  const [year, month, day] = dueAt.split("-").map(Number);
  return Date.now() >= new Date(year, month - 1, day + 1).getTime();
};

// "Due Friday" when it's within a week, otherwise "Due 30 Oct" (same as the student home)
const dueLabel = (iso: string): string => {
  const [year, month, day] = iso.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days >= 0 && days < 7)
    return `Due ${due.toLocaleDateString("en-GB", { weekday: "long" })}`;
  return `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
};

// the newest edit first: the latest save, or the row's own update when never saved
const newestFirst = (a: Project, b: Project): number =>
  (b.saved_at ?? b.updated_at).localeCompare(a.saved_at ?? a.updated_at);

// one of the teacher's projects from the database, as a row in All projects
const rowFromServer = (project: Project): ProjectRow => ({
  id: project.id,
  className: project.class_name,
  name: project.name,
  details: project.saved_at
    ? `Saved ${daysAgo(project.saved_at)} · revision ${project.current_revision}`
    : "Not assigned yet",
  action: "Set up project",
  actionIsPrimary: !project.saved_at,
  hasStudentWork: deleteHintFor(project) !== undefined,
  isPastDue: dueHasPassed(project.due_at),
  archived: project.status === "archived",
  onServer: true,
  deleteHint: deleteHintFor(project),
});

// Offline mode only (no VITE_API_URL): the list as the teacher left it. It lives outside the
// component, so leaving the page (Results, template setup) and coming back keeps new,
// archived and deleted projects; a page refresh starts over.
let savedProjects: ProjectRow[] = [];

// what template setup's Assign sends back
type AssignedNote = {
  id: string;
  projectName: string;
  className: string;
  due?: string;
  sent?: ClassSendResult; // how sending to the class's students went, for a server project
  sendProblem?: string; // why sending to the class failed outright
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// the banner's sentence after "<project> is saved for <class>"
const sentLine = (note: AssignedNote): string => {
  if (note.sendProblem) return ` Couldn't send it to the students: ${note.sendProblem}`;
  if (!note.sent) return "";
  const { sent, alreadyHad, failed } = note.sent;
  const parts = [];
  if (sent > 0) parts.push(`sent to ${plural(sent, "student")}`);
  if (alreadyHad > 0) parts.push(`${plural(alreadyHad, "student")} already had it`);
  if (parts.length === 0 && failed === 0) parts.push("not sent to any students");
  const line = ` ${parts.join(", ")}.`.replace(/^ \w/, (first) => first.toUpperCase());
  return failed > 0 ? `${line} Couldn't send to ${plural(failed, "student")}: press Assign again to retry.` : line;
};

// the "assigned" banner, kept until the teacher clicks OK (even across tab switches)
let savedBanner: AssignedNote | null = null;

type ClassOption = { id: string; name: string };

// Offline mode only: with a server, the class picks are the teacher's real classes (GET /classes).
const offlineClasses: ClassOption[] = ["Class 2B", "Class 3A", "Class 3B"].map((name) => ({ id: name, name }));

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
  deleteHint?: string; // why Delete is off, when it is not because of student work
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
  deleteHint,
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
                  : (deleteHint ?? "Has student work, so archive it instead")}
              </small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function TeacherHomePage() {
  const { displayName, getToken } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  // set by template setup's Assign button: which project just went to which class
  const assigned = (location.state as { assigned?: AssignedNote } | null)
    ?.assigned;

  // With a server, the projects and the class picks come from the database; offline, the
  // projects are this visit's list and the classes are made up.
  const server = useLoad(
    () => (apiUrl ? listMyProjects(getToken) : Promise.resolve([])),
    "teacher-projects",
  );
  const serverClasses = useLoad(
    () => (apiUrl ? listMyClasses(getToken) : Promise.resolve(offlineClasses)),
    "teacher-classes",
  );
  const classOptions: ClassOption[] = serverClasses.data ?? [];

  const [localProjects, setProjects] = useState<ProjectRow[]>(() => savedProjects);
  const projects = apiUrl
    ? (server.data ?? []).map(rowFromServer)
    : localProjects;
  // a menu action that the server refused, shown above the list
  const [actionError, setActionError] = useState<string | null>(null);

  // shows the banner from this visit, or the one still waiting for OK
  const [banner, setBanner] = useState<AssignedNote | null>(
    () => assigned ?? savedBanner,
  );

  // keep the saved copy up to date after every change
  useEffect(() => {
    savedProjects = localProjects;
  }, [localProjects]);

  // a project just assigned on template setup shows the banner
  useEffect(() => {
    if (!assigned) return;
    savedBanner = assigned;
    setBanner(assigned);
  }, [assigned]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // the New project popup
  const [newOpen, setNewOpen] = useState(false);
  // the environment Room 1 starts as; null = students pick it themselves
  const [newRoom, setNewRoom] = useState<string | null>(firstRoomDefault);
  const [newName, setNewName] = useState("");
  // shown after Create and set up is pressed with no name, until one is typed
  const [nameMissing, setNameMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // the picked class's id (offline, its name); null until the classes have loaded
  const [newClass, setNewClass] = useState<string | null>(null);
  const [newDue, setNewDue] = useState(inAWeek);
  // Create and set up waits for the server; a refusal is shown in the popup
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  // runs one menu action against the server, then asks for the list again
  const onServer = async (action: () => Promise<unknown>) => {
    setOpenMenuId(null);
    setActionError(null);
    try {
      await action();
    } catch (problem) {
      setActionError((problem as Error).message);
    }
    server.reload();
  };

  // a new "Copy of …" at the top of the list, marked as new. On the server it is a new
  // project with no class, holding the same rooms and brief as the latest save.
  const duplicate = (project: ProjectRow) => {
    if (project.onServer) {
      void onServer(async () => {
        const source = await loadRemoteProject(getToken, project.id);
        const copy = await createClassProject(getToken, `Copy of ${project.name}`, null);
        if (source.revision > 0)
          await saveProjectContent(getToken, copy.id, 0, { ...source.project, id: copy.id, name: copy.name });
      });
      return;
    }
    const name = project.name;
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

  const toggleArchived = (project: ProjectRow) => {
    if (project.onServer) {
      void onServer(() => setProjectStatus(getToken, project.id, project.archived ? "draft" : "archived"));
      return;
    }
    const id = project.id;
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
    const project = confirmDelete;
    setConfirmDelete(null);
    if (project.onServer) {
      void onServer(() => deleteProject(getToken, project.id));
      return;
    }
    setProjects((current) => current.filter((p) => p.id !== project.id));
  };

  // opens the popup with empty fields each time
  const openNewProject = () => {
    setNewRoom(firstRoomDefault);
    setNewName("");
    setNameMissing(false);
    setNewClass(classOptions[0]?.id ?? null);
    setNewDue(inAWeek());
    setCreateError(null);
    setNewOpen(true);
  };

  // the classes can arrive after the popup opened: pick the first then
  useEffect(() => {
    if (newOpen && newClass === null && classOptions.length > 0) setNewClass(classOptions[0].id);
  }, [newOpen, newClass, classOptions]);

  // With a server, makes the project in the database first (named "x (2)" if the teacher
  // already has an x), then goes to template setup with it; offline, just goes there.
  // With no name it stays and asks for one.
  const createAndSetUp = async () => {
    const name = newName.trim();
    if (!name) {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    const picked = classOptions.find((option) => option.id === newClass) ?? null;
    let created: Project | null = null;
    if (apiUrl) {
      setCreating(true);
      setCreateError(null);
      try {
        created = await createClassProject(getToken, name, picked?.id ?? null);
      } catch (problem) {
        setCreateError((problem as Error).message);
        return;
      } finally {
        setCreating(false);
      }
    }
    navigate("/teacher/template", {
      state: {
        newProject: {
          projectId: created?.id,
          classId: created ? picked?.id ?? null : null,
          name: created?.name ?? name,
          className: picked?.name ?? "no class",
          due: newDue,
          firstRoom: newRoom,
        },
      },
    });
  };

  // Projects assigned and not due yet, newest first: the first one is the "Pick up where you
  // left off" card, and their classes are the ones "building right now". Server only, since
  // offline projects have no due date.
  const inProgress = (server.data ?? [])
    .filter((p) => p.status !== "archived" && p.due_at && !dueHasPassed(p.due_at))
    .sort(newestFirst);
  const pickUp = inProgress[0];
  const pickUpRow = pickUp && projects.find((p) => p.id === pickUp.id);
  const buildingClasses = new Set(inProgress.map((p) => p.class_id ?? p.class_name)).size;

  // the card's project is not listed again under All projects
  const activeProjects = projects.filter((p) => !p.archived && p.id !== pickUpRow?.id);
  const archivedProjects = projects.filter((p) => p.archived);

  // "Set up project" (or "Set up and assign") opens template setup with that project
  const openSetup = (project: ProjectRow) =>
    navigate("/teacher/template", {
      state: project.onServer ? { projectId: project.id } : null,
    });

  // the ⋯ menu for one project, on the card or in the list
  const menuFor = (project: ProjectRow) => (
    <ProjectMenu
      name={project.name}
      open={openMenuId === project.id}
      onToggle={() => toggleMenu(project.id)}
      hasClass={project.className !== null}
      archived={project.archived}
      canArchive={project.isPastDue}
      canDelete={!project.hasStudentWork}
      deleteHint={project.deleteHint}
      onDuplicate={() => duplicate(project)}
      onArchive={() => toggleArchived(project)}
      onDelete={() => askToDelete(project)}
    />
  );
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
            <strong>{banner.projectName}</strong> is saved for{" "}
            {banner.className}.{sentLine(banner)}
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
          {buildingClasses > 0 && (
            <p className="teacher-home-lead">
              {buildingClasses === 1
                ? "One class is"
                : `${buildingClasses} classes are`}{" "}
              building right now.
            </p>
          )}
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

      {pickUp && pickUpRow && (
        <>
          <h2 className="teacher-home-label">Pick up where you left off</h2>
          <article className="teacher-home-class">
            <div className="teacher-home-class-image">
              <MuseumPreview title={pickUp.name} />
            </div>

            <div>
              <div className="teacher-home-chips">
                {pickUp.class_name && (
                  <span className="teacher-home-chip teacher-home-chip-dark">
                    {pickUp.class_name}
                  </span>
                )}
                {pickUp.due_at && (
                  <span className="teacher-home-chip">{dueLabel(pickUp.due_at)}</span>
                )}
              </div>
              <h3 className="teacher-home-class-title">{pickUp.name}</h3>
              {/* the task for now; the class's progress bar goes here once the counts exist */}
              {pickUp.task && (
                <p className="teacher-home-class-task">{pickUp.task}</p>
              )}
              <div className="teacher-home-class-actions">
                <button
                  type="button"
                  className="teacher-home-primary"
                  onClick={() => openSetup(pickUpRow)}
                >
                  Set up project
                </button>
                <button
                  type="button"
                  className="teacher-home-secondary"
                  onClick={() => navigate("/teacher/review")}
                >
                  Review submissions
                </button>
              </div>
            </div>

            {menuFor(pickUpRow)}
          </article>
        </>
      )}

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
          {actionError && (
            <p className="teacher-home-field-error" role="alert">
              That didn't work: {actionError}
            </p>
          )}
          {server.error ? (
            <p className="teacher-home-field-error" role="alert">
              Could not load your projects: {server.error}
            </p>
          ) : server.loading ? (
            <p className="teacher-home-lead">Loading your projects…</p>
          ) : (
            visibleProjects.length === 0 && (
              <p className="teacher-home-lead">No projects yet.</p>
            )
          )}
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
                  onClick={() => toggleArchived(project)}
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
                      openSetup(project);
                  }}
                >
                  {project.action}
                </button>
              )}
              {menuFor(project)}
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
                  Pick the first room, name it and pick the class. You'll write
                  the brief and rules next.
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

            <div className="teacher-home-rooms-head">
              <span className="teacher-home-field-label">Room 1 starts as</span>
              <small>From the rooms VThere turned on for your school</small>
            </div>
            <div
              className="teacher-home-rooms"
              role="radiogroup"
              aria-label="Room 1 starts as"
            >
              {environmentLibrary.map((env, index) => {
                const on = isTurnedOn(env.id);
                const selected = newRoom === env.id;
                return (
                  <button
                    key={env.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!on}
                    className={[
                      "teacher-home-room",
                      selected ? "teacher-home-room-selected" : "",
                      on ? "" : "teacher-home-room-off",
                    ].join(" ")}
                    onClick={() => setNewRoom(env.id)}
                  >
                    <span
                      className={`teacher-home-room-picture teacher-home-room-tone-${index % ROOM_TONES}`}
                    />
                    <strong>{env.name}</strong>
                    <small>
                      {selected ? "Selected" : on ? "Turned on" : "Not turned on"}
                    </small>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={newRoom === null}
                className={[
                  "teacher-home-room",
                  "teacher-home-room-students",
                  newRoom === null ? "teacher-home-room-selected" : "",
                ].join(" ")}
                onClick={() => setNewRoom(null)}
              >
                <span className="teacher-home-room-picture" />
                <strong>Students pick</strong>
                <small>{newRoom === null ? "Selected" : "From your list"}</small>
              </button>
            </div>

            <label
              className="teacher-home-field-label"
              htmlFor="new-project-name"
            >
              Project name
            </label>
            <input
              ref={nameRef}
              id="new-project-name"
              className={
                nameMissing
                  ? "teacher-home-input teacher-home-input-invalid"
                  : "teacher-home-input"
              }
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                if (event.target.value.trim()) setNameMissing(false);
              }}
              placeholder="e.g. Volcano museum"
              aria-invalid={nameMissing}
              aria-describedby={nameMissing ? "new-project-name-error" : undefined}
              autoFocus
            />
            {nameMissing && (
              <p id="new-project-name-error" className="teacher-home-field-error" role="alert">
                Give your project a name.
              </p>
            )}

            <div className="teacher-home-new-row">
              <div>
                <span className="teacher-home-field-label">Class</span>
                <div
                  className="teacher-home-class-picks"
                  role="radiogroup"
                  aria-label="Class"
                >
                  {serverClasses.loading && (
                    <span className="teacher-home-picks-note">Loading your classes…</span>
                  )}
                  {serverClasses.error && (
                    <span className="teacher-home-picks-note">
                      Could not load your classes, so it will have no class.
                    </span>
                  )}
                  {serverClasses.data?.length === 0 && (
                    <span className="teacher-home-picks-note">
                      You're not in any class yet, so it will have no class.
                    </span>
                  )}
                  {classOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={newClass === option.id}
                      className={
                        newClass === option.id
                          ? "teacher-home-pick teacher-home-pick-selected"
                          : "teacher-home-pick"
                      }
                      onClick={() => setNewClass(option.id)}
                    >
                      {option.name}
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
                disabled={creating}
              >
                {creating ? "Creating…" : "Create and set up"}
              </button>
            </div>
            {createError && (
              <p className="teacher-home-field-error" role="alert">
                Couldn't create the project: {createError}
              </p>
            )}
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