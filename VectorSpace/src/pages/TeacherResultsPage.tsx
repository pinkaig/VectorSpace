/**
 * @file        TeacherResultsPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Results tab: opens on the whole class (published count,
 *              visits, where the class is at, most clicked), then any student's
 *              museum from the list or the Visits by student bars, with a back
 *              button to the class. Shown inside TeacherLayout. Uses fake data
 *              until the analytics endpoint exists (it returns 501).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { ChevronLeft, Users } from "lucide-react";
import "./TeacherResultsPage.css";

type Range = "Last 7 days" | "Last 30 days" | "All time";
const ranges: Range[] = ["Last 7 days", "Last 30 days", "All time"];

// ── Fake data until analytics exists ─────────────────────────────────────

const classInfo = {
  name: "Class 3A · Ancient Egypt",
  projectTitle: "Class 3A · Ancient Egypt tour",
  students: 24,
  due: "Friday, 9 Oct",
};

// published museums, most visited first; visits for each date range
const museums: { id: string; studentName: string; visits: Record<Range, number> }[] = [
  { id: "m1", studentName: "Marcus Lee", visits: { "Last 7 days": 34, "Last 30 days": 88, "All time": 116 } },
  { id: "m2", studentName: "Ethan Wong", visits: { "Last 7 days": 27, "Last 30 days": 70, "All time": 92 } },
  { id: "m3", studentName: "Nur Aina", visits: { "Last 7 days": 21, "Last 30 days": 55, "All time": 71 } },
  { id: "m4", studentName: "Kai Chen", visits: { "Last 7 days": 15, "Last 30 days": 39, "All time": 51 } },
  { id: "m5", studentName: "Sofia Lim", visits: { "Last 7 days": 12, "Last 30 days": 31, "All time": 41 } },
  { id: "m6", studentName: "Ryan Teo", visits: { "Last 7 days": 8, "Last 30 days": 21, "All time": 27 } },
  { id: "m7", studentName: "Mei Ling", visits: { "Last 7 days": 5, "Last 30 days": 13, "All time": 17 } },
];

const classStatus = [
  { label: "Published", count: 7, colour: "results-status-published" },
  { label: "Waiting for approval", count: 2, colour: "results-status-waiting" },
  { label: "Building", count: 10, colour: "results-status-building" },
  { label: "Not started", count: 5, colour: "results-status-not-started" },
];

const classMostClicked: { name: string; museums: number; clicks: Record<Range, number> }[] = [
  { name: "Mummy case", museums: 7, clicks: { "Last 7 days": 128, "Last 30 days": 333, "All time": 435 } },
  { name: "Sphinx statue", museums: 6, clicks: { "Last 7 days": 91, "Last 30 days": 237, "All time": 309 } },
  { name: "Hieroglyph wall", museums: 5, clicks: { "Last 7 days": 64, "Last 30 days": 166, "All time": 218 } },
  { name: "Pyramid model", museums: 7, clicks: { "Last 7 days": 40, "Last 30 days": 104, "All time": 136 } },
];

// one student's museum: the same for every student for now
const studentTiles = [
  { label: "Average visit", value: "3m 12s", sub: "time spent inside" },
  { label: "Reached room 2", value: "62%", sub: "walked through the door" },
  { label: "Cards opened", value: "118", sub: "fact cards read" },
];

const mostClicked = [
  { name: "Mummy case", clicks: 41 },
  { name: "Sphinx statue", clicks: 27 },
  { name: "Hieroglyph wall", clicks: 19 },
  { name: "Pyramid model", clicks: 12 },
  { name: "Wall torch", clicks: 6 },
];

const visitsPerDay = [
  { day: "Mon", visits: 3 },
  { day: "Tue", visits: 8 },
  { day: "Wed", visits: 6 },
  { day: "Thu", visits: 9 },
  { day: "Fri", visits: 4 },
  { day: "Sat", visits: 2 },
  { day: "Sun", visits: 2 },
];

const maxClicks = Math.max(...mostClicked.map((e) => e.clicks));
const maxVisits = Math.max(...visitsPerDay.map((d) => d.visits));

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

// the whole class: tiles, visits by student, where the class is at, most clicked
function ClassResults({ range, onPickStudent }: { range: Range; onPickStudent: (id: string) => void }) {
  // worked out for the chosen date range
  const totalVisits = museums.reduce((sum, m) => sum + m.visits[range], 0);
  const maxStudentVisits = Math.max(...museums.map((m) => m.visits[range]));

  const classTiles = [
    { label: "Museums published", value: `${museums.length} of ${classInfo.students}`, sub: "2 waiting for you to approve" },
    { label: "Visits", value: String(totalVisits), sub: "across all published museums" },
    { label: "Average visit", value: "3m 41s", sub: "time spent inside" },
    { label: "Reached room 2", value: "54%", sub: "walked through the door" },
  ];

  return (
    <>
      <div className="results-tiles">
        {classTiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="results-class-grid">
        <div className="results-chart results-visits-card">
          <div className="results-chart-head">
            <h3 className="results-chart-title">Visits by student</h3>
            <span className="results-chart-hint">Click a name to see their museum</span>
          </div>
          <ul className="results-bars">
            {museums.map((m) => (
              <li key={m.id}>
                <button type="button" className="results-student-row" onClick={() => onPickStudent(m.id)}>
                  <span className="results-student-name">{m.studentName}</span>
                  <span className="results-bar-track">
                    <span className="results-bar-fill" style={{ width: `${(m.visits[range] / maxStudentVisits) * 100}%` }} />
                  </span>
                  <span className="results-bar-value">{m.visits[range]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="results-chart">
          <h3 className="results-chart-title">Where the class is at</h3>
          <div className="results-status-bar">
            {classStatus.map((s) => (
              <span key={s.label} className={s.colour} style={{ flex: s.count }} />
            ))}
          </div>
          <ul className="results-status-legend">
            {classStatus.map((s) => (
              <li key={s.label}>
                <span className={`results-status-dot ${s.colour}`} />
                {s.label}
                <strong>{s.count}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="results-chart">
          <h3 className="results-chart-title">Most clicked across the class</h3>
          <ul className="results-top-list">
            {classMostClicked.map((e) => (
              <li key={e.name}>
                <span className="results-top-name">{e.name}</span>
                <span className="results-top-where">in {e.museums} museums</span>
                <strong>{e.clicks[range]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// one student's museum: tiles, most clicked exhibits, visits per day
function StudentResults({ visits }: { visits: number }) {
  return (
    <>
      <div className="results-tiles">
        <StatTile label="Visits" value={String(visits)} sub="people who opened the link" />
        {studentTiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="results-charts">
        <div className="results-chart">
          <h3 className="results-chart-title">Most clicked exhibits</h3>
          <ul className="results-bars">
            {mostClicked.map((e) => (
              <li key={e.name} className="results-bar-row">
                <span className="results-bar-name">{e.name}</span>
                <span className="results-bar-track">
                  <span className="results-bar-fill" style={{ width: `${(e.clicks / maxClicks) * 100}%` }} />
                </span>
                <span className="results-bar-value">{e.clicks}</span>
              </li>
            ))}
          </ul>
          <p className="results-chart-note">Clicks on each exhibit's fact card or reaction.</p>
        </div>

        <div className="results-chart">
          <h3 className="results-chart-title">Visits per day</h3>
          <div className="results-days">
            {visitsPerDay.map((d) => (
              <div key={d.day} className="results-day">
                <span className="results-day-value">{d.visits}</span>
                <span className="results-day-bar" style={{ height: `${(d.visits / maxVisits) * 100}%` }} />
                <span className="results-day-label">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── The page ─────────────────────────────────────────────────────────────

export default function TeacherResultsPage() {
  // null = the whole class, otherwise one student's museum
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("Last 7 days");

  const selected = museums.find((m) => m.id === selectedId);
  const firstName = selected ? selected.studentName.split(" ")[0] : "";

  return (
    <main className="results">
      <section className="results-list-panel">
        <h1 className="results-list-title">{classInfo.name}</h1>
        <p className="results-list-sub">Start with the whole class, then pick a student.</p>

        <button
          type="button"
          className={selectedId === null ? "results-item results-class-item results-item-selected" : "results-item results-class-item"}
          onClick={() => setSelectedId(null)}
        >
          <span className="results-class-icon"><Users size={16} /></span>
          <strong>Whole class</strong>
          <span>{classInfo.students} students</span>
        </button>

        <h2 className="results-list-label">Published · most visited first</h2>

        <div className="results-list">
          {museums.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === selectedId ? "results-item results-item-selected" : "results-item"}
              onClick={() => setSelectedId(m.id)}
            >
              <strong>{m.studentName}</strong>
              <span>{m.visits[range]} visits</span>   
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
                {selected ? `${firstName}'s Ancient Egypt tour` : classInfo.projectTitle}
              </h2>
              <p className="results-detail-sub">
                {selected
                  ? "Published 12 days ago · Anyone with the link"
                  : `Whole class · ${classInfo.students} students · was due ${classInfo.due}`}
              </p>
            </div>
          </div>

          <div className="results-range" role="group" aria-label="Date range">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                className={r === range ? "results-range-option results-range-selected" : "results-range-option"}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </header>

        {selected ? (
          <StudentResults visits={selected.visits[range]} />
        ) : (
          <ClassResults range={range} onPickStudent={setSelectedId} />
        )}
      </section>
    </main>
  );
}