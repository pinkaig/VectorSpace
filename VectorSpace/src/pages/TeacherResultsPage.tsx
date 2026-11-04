/**
 * @file        TeacherResultsPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @author      Goh Pin Kai
 * @brief       Teacher Results tab: pick one of the projects sent to a class; it opens on the
 *              whole class (published count, visits, where the class is at, who is waiting),
 *              then any published museum from the list or the Visits by student bars.
 *              Shown inside TeacherLayout.
 *
 *              Visits come from GET /analytics/visits: the visitor's page records one each time a
 *              published museum is opened by anyone but its owner. Clicks, time inside and rooms
 *              reached are not recorded yet, so they are not shown.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronLeft, ExternalLink, Users } from "lucide-react";
import { apiUrl } from "../api/client";
import {
  listMuseumVisits,
  listMyProjects,
  listStudentMuseums,
  type MuseumVisits,
  type Project,
} from "../api/projects";
import { useLoad } from "../api/useLoad";
import { useSession } from "../session/session";
import "./TeacherResultsPage.css";

type Range = "Last 7 days" | "Last 30 days" | "All time";
const ranges: Range[] = ["Last 7 days", "Last 30 days", "All time"];
const rangeDays: Record<Range, number | undefined> = {
  "Last 7 days": 7,
  "Last 30 days": 30,
  "All time": undefined,
};

type Stage = "published" | "waiting" | "building" | "not-started";

const stages: { stage: Stage; label: string; colour: string }[] = [
  { stage: "published", label: "Published", colour: "results-status-published" },
  { stage: "waiting", label: "Waiting for approval", colour: "results-status-waiting" },
  { stage: "building", label: "Building", colour: "results-status-building" },
  { stage: "not-started", label: "Not started", colour: "results-status-not-started" },
];

// where one student's copy is: a copy is "not started" until the student saves it themselves
const stageOf = (copy: Project): Stage => {
  if (copy.status === "published") return "published";
  if (copy.review_status === "waiting") return "waiting";
  if (copy.saved_by_name && copy.saved_by_name === copy.created_by_name) return "building";
  return "not-started";
};

const shareLabel: Record<string, string> = {
  public: "Anyone, listed on the showcase",
  unlisted: "Anyone with the link",
  sign_in_only: "Signed-in classmates only",
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const dateLabel = (iso: string, withWeekday = false) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    ...(withWeekday ? { weekday: "long" } : {}),
    day: "numeric",
    month: "short",
  });
};

// the last 7 days' short names, oldest first, today last
const lastSevenDays = (): string[] =>
  Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    return index === 6 ? "Today" : day.toLocaleDateString("en-GB", { weekday: "short" });
  });

// ── Small pieces ─────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="results-tile">
      <span className="results-tile-label">{label}</span>
      <strong>{value}</strong>
      <span className="results-tile-sub">{sub}</span>
    </div>
  );
}

type Museum = { copy: Project; visits: number; days: number[] };

// the whole class: tiles, visits by student, where the class is at, who is waiting
function ClassResults({
  copies,
  museums,
  dueAt,
  onPickStudent,
  onReview,
}: {
  copies: Project[];
  museums: Museum[];
  dueAt: string | null | undefined;
  onPickStudent: (id: string) => void;
  onReview: () => void;
}) {
  const counts = stages.map((item) => ({
    ...item,
    count: copies.filter((copy) => stageOf(copy) === item.stage).length,
  }));
  const waiting = copies.filter((copy) => stageOf(copy) === "waiting");
  const totalVisits = museums.reduce((sum, museum) => sum + museum.visits, 0);
  const mostVisits = Math.max(1, ...museums.map((museum) => museum.visits));
  const notStarted = counts.find((item) => item.stage === "not-started")?.count ?? 0;

  return (
    <>
      <div className="results-tiles">
        <StatTile
          label="Projects published"
          value={`${museums.length} of ${copies.length}`}
          sub={waiting.length ? `${waiting.length} waiting for you to approve` : "none waiting for you"}
        />
        <StatTile label="Visits" value={String(totalVisits)} sub="across all published projects" />
        <StatTile
          label="Not started"
          value={String(notStarted)}
          sub={notStarted === 1 ? "student hasn't saved yet" : "students haven't saved yet"}
        />
        <StatTile
          label="Due"
          value={dueAt ? dateLabel(dueAt) : "No date"}
          sub={dueAt ? dateLabel(dueAt, true) : "no due date was set"}
        />
      </div>

      <div className="results-class-grid">
        <div className="results-chart results-visits-card">
          <div className="results-chart-head">
            <h3 className="results-chart-title">Visits by student</h3>
            {museums.length > 0 && (
              <span className="results-chart-hint">Click a name to see their project</span>
            )}
          </div>
          {museums.length === 0 ? (
            <p className="results-chart-note">
              Nobody's project is published yet. Approve one from Review and it shows here.
            </p>
          ) : (
            <ul className="results-bars">
              {museums.map((museum) => (
                <li key={museum.copy.id}>
                  <button
                    type="button"
                    className="results-student-row"
                    onClick={() => onPickStudent(museum.copy.id)}
                  >
                    <span className="results-student-name">{museum.copy.created_by_name}</span>
                    <span className="results-bar-track">
                      <span
                        className="results-bar-fill"
                        style={{ width: `${(museum.visits / mostVisits) * 100}%` }}
                      />
                    </span>
                    <span className="results-bar-value">{museum.visits}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="results-chart">
          <h3 className="results-chart-title">Where the class is at</h3>
          <div className="results-status-bar">
            {counts
              .filter((item) => item.count > 0)
              .map((item) => (
                <span key={item.stage} className={item.colour} style={{ flex: item.count }} />
              ))}
          </div>
          <ul className="results-status-legend">
            {counts.map((item) => (
              <li key={item.stage}>
                <span className={`results-status-dot ${item.colour}`} />
                {item.label}
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="results-chart">
          <div className="results-chart-head">
            <h3 className="results-chart-title">Waiting for you</h3>
            {waiting.length > 0 && (
              <button type="button" className="results-chart-link" onClick={onReview}>
                Open Review
              </button>
            )}
          </div>
          {waiting.length === 0 ? (
            <p className="results-chart-note">Nothing to approve for this project.</p>
          ) : (
            <ul className="results-top-list">
              {waiting.map((copy) => (
                <li key={copy.id}>
                  <span className="results-top-name">{copy.created_by_name}</span>
                  <span className="results-top-where">
                    {copy.submitted_at ? `sent ${dateLabel(copy.submitted_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// one student's museum: tiles, visits per day, the review it got
function StudentResults({ museum, range }: { museum: Museum; range: Range }) {
  const { copy } = museum;
  const dayNames = lastSevenDays();
  const mostInADay = Math.max(1, ...museum.days);
  const weekTotal = museum.days.reduce((sum, count) => sum + count, 0);

  return (
    <>
      <div className="results-tiles">
        <StatTile
          label="Visits"
          value={String(museum.visits)}
          sub={range === "All time" ? "since it was published" : range.toLowerCase()}
        />
        <StatTile label="This week" value={String(weekTotal)} sub="visits in the last 7 days" />
        <StatTile label="Grade" value={copy.review_grade || "None"} sub="from your approval" />
        <StatTile
          label="Last changed"
          value={copy.saved_at ? dateLabel(copy.saved_at) : "-"}
          sub={copy.saved_by_name ? `by ${copy.saved_by_name}` : "never saved"}
        />
      </div>

      <div className="results-charts">
        <div className="results-chart">
          <h3 className="results-chart-title">Visits per day</h3>
          <div className="results-days">
            {museum.days.map((count, index) => (
              <div key={dayNames[index]} className="results-day">
                <span className="results-day-value">{count}</span>
                <span
                  className="results-day-bar"
                  style={{ height: `${(count / mostInADay) * 100}%` }}
                />
                <span className="results-day-label">{dayNames[index]}</span>
              </div>
            ))}
          </div>
          <p className="results-chart-note">A visit is anyone but {copy.created_by_name.split(" ")[0]} opening the project's link.</p>
        </div>

        <div className="results-chart">
          <h3 className="results-chart-title">Your feedback</h3>
          <p className="results-chart-note">
            {copy.review_comment || "You approved it without a comment."}
          </p>
          {copy.slug && (
            <a
              className="results-chart-link"
              href={`#/visit/${copy.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Visit the project <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ── The page ─────────────────────────────────────────────────────────────

export default function TeacherResultsPage() {
  const { getToken } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  // See results on the teacher home names the project to open on
  const askedFor = (location.state as { projectId?: string } | null)?.projectId;

  const [range, setRange] = useState<Range>("Last 7 days");
  const [projectId, setProjectId] = useState<string | null>(askedFor ?? null);
  // null = the whole class, otherwise one student's museum
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const own = useLoad(() => (apiUrl ? listMyProjects(getToken) : Promise.resolve([])), "results-projects");
  const students = useLoad(
    () => (apiUrl ? listStudentMuseums(getToken) : Promise.resolve([])),
    "results-copies",
  );
  const visits = useLoad(
    () => (apiUrl ? listMuseumVisits(getToken, rangeDays[range]) : Promise.resolve([] as MuseumVisits[])),
    `results-visits-${range}`,
  );

  // the projects sent to students, most published first
  const sentProjects = useMemo(
    () =>
      (own.data ?? [])
        .filter((project) => project.sent && project.status !== "archived")
        .sort((a, b) => (b.published_copies ?? 0) - (a.published_copies ?? 0)),
    [own.data],
  );
  const project = sentProjects.find((item) => item.id === projectId) ?? sentProjects[0];

  // this project's copies, and its published ones with their visits, most visited first
  const copies = useMemo(() => {
    const ids = new Set(project?.assignment_ids ?? []);
    return (students.data ?? [])
      .filter((copy) => copy.assignment_id && ids.has(copy.assignment_id))
      .sort((a, b) => a.created_by_name.localeCompare(b.created_by_name));
  }, [project, students.data]);
  const museums: Museum[] = useMemo(() => {
    const byProject = new Map((visits.data ?? []).map((row) => [row.project_id, row]));
    return copies
      .filter((copy) => copy.status === "published")
      .map((copy) => ({
        copy,
        visits: byProject.get(copy.id)?.visits ?? 0,
        days: byProject.get(copy.id)?.last_7_days ?? [0, 0, 0, 0, 0, 0, 0],
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [copies, visits.data]);

  const selected = museums.find((museum) => museum.copy.id === selectedId);
  const problem = own.error ?? students.error ?? visits.error;
  const loading = own.loading || students.loading;

  const pickProject = (id: string) => {
    setProjectId(id);
    setSelectedId(null);
  };

  if (!apiUrl || (!loading && !problem && !project)) {
    return (
      <main className="results">
        <section className="results-list-panel">
          <h1 className="results-list-title">Results</h1>
          <p className="results-list-sub">Published projects show here, most visited first.</p>
        </section>
        <section className="results-detail-panel">
          <header className="results-detail-header">
            <div className="results-detail-heading">
              <div>
                <h2 className="results-detail-title">No results yet</h2>
                <p className="results-detail-sub">
                  {apiUrl
                    ? "Assign a project to a class from Classes. Its results show here once students start."
                    : "Results need the database: set VITE_API_URL."}
                </p>
              </div>
            </div>
          </header>
        </section>
      </main>
    );
  }

  return (
    <main className="results">
      <section className="results-list-panel">
        {sentProjects.length > 1 ? (
          <select
            className="results-project-picker"
            aria-label="Project"
            value={project?.id ?? ""}
            onChange={(event) => pickProject(event.target.value)}
          >
            {sentProjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.class_name ? `${item.class_name} · ${item.name}` : item.name}
              </option>
            ))}
          </select>
        ) : (
          <h1 className="results-list-title">
            {project ? (project.class_name ? `${project.class_name} · ${project.name}` : project.name) : "Results"}
          </h1>
        )}
        <p className="results-list-sub">Start with the whole class, then pick a student.</p>

        <button
          type="button"
          className={
            selectedId === null
              ? "results-item results-class-item results-item-selected"
              : "results-item results-class-item"
          }
          onClick={() => setSelectedId(null)}
        >
          <span className="results-class-icon">
            <Users size={16} />
          </span>
          <strong>Whole class</strong>
          <span>{plural(copies.length, "student")}</span>
        </button>

        <h2 className="results-list-label">Published · most visited first</h2>

        <div className="results-list">
          {museums.length === 0 && !loading && (
            <p className="results-list-sub">None published yet.</p>
          )}
          {museums.map((museum) => (
            <button
              key={museum.copy.id}
              type="button"
              className={museum.copy.id === selectedId ? "results-item results-item-selected" : "results-item"}
              onClick={() => setSelectedId(museum.copy.id)}
            >
              <strong>{museum.copy.created_by_name}</strong>
              <span>{plural(museum.visits, "visit")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="results-detail-panel">
        <header className="results-detail-header">
          <div className="results-detail-heading">
            {selected && (
              <button
                type="button"
                className="results-back"
                aria-label="Back to the whole class"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="results-detail-title">
                {selected
                  ? `${selected.copy.created_by_name.split(" ")[0]}'s ${selected.copy.name}`
                  : project
                    ? project.class_name
                      ? `${project.class_name} · ${project.name}`
                      : project.name
                    : "Loading results"}
              </h2>
              <p className="results-detail-sub">
                {selected
                  ? `Published · ${shareLabel[selected.copy.share_with ?? ""] ?? "Signed-in classmates only"}`
                  : `Whole class · ${plural(copies.length, "student")}`}
              </p>
            </div>
          </div>

          <div className="results-range" role="group" aria-label="Date range">
            {ranges.map((item) => (
              <button
                key={item}
                type="button"
                className={item === range ? "results-range-option results-range-selected" : "results-range-option"}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        {problem ? (
          <p className="results-chart-note">Couldn't load the results: {problem}</p>
        ) : selected ? (
          <StudentResults museum={selected} range={range} />
        ) : (
          <ClassResults
            copies={copies}
            museums={museums}
            dueAt={project?.due_at}
            onPickStudent={setSelectedId}
            onReview={() => navigate("/teacher/review")}
          />
        )}
      </section>
    </main>
  );
}
