/**
 * @file        TeacherResultsPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Results tab: published student museums on the left
 *              (most visited first) and the selected museum's visitor results
 *              on the right: date range, stat tiles, most clicked exhibits and
 *              visits per day. Shown inside TeacherLayout. Uses fake data
 *              until the analytics endpoint exists (it returns 501).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import "./TeacherResultsPage.css";

type Range = "Last 7 days" | "Last 30 days" | "All time";
const ranges: Range[] = ["Last 7 days", "Last 30 days", "All time"];

// Fake data until analytics exists. Already sorted, most visited first.
const museums = [
  { id: "m1", studentName: "Marcus Lee", visits: 34 },
  { id: "m2", studentName: "Ethan Wong", visits: 27 },
  { id: "m3", studentName: "Nur Aina", visits: 21 },
  { id: "m4", studentName: "Kai Chen", visits: 15 },
  { id: "m5", studentName: "Sofia Lim", visits: 12 },
  { id: "m6", studentName: "Ryan Teo", visits: 8 },
  { id: "m7", studentName: "Mei Ling", visits: 5 },
];

// The same for every museum until analytics exists.
const statTiles = [
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

// the biggest value sets 100% of a bar, everything else is a share of it
const maxClicks = Math.max(...mostClicked.map((e) => e.clicks));
const maxVisits = Math.max(...visitsPerDay.map((d) => d.visits));

export default function TeacherResultsPage() {
  const [selectedId, setSelectedId] = useState(museums[0].id);
  const [range, setRange] = useState<Range>("Last 7 days");

  const selected = museums.find((m) => m.id === selectedId);
  const firstName = selected ? selected.studentName.split(" ")[0] : "";

  return (
    <main className="results">
      <section className="results-list-panel">
        <h1 className="results-list-title">Class 3A · Ancient Egypt</h1>
        <p className="results-list-sub">Published museums, most visited first.</p>

        <div className="results-list">
          {museums.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === selectedId ? "results-item results-item-selected" : "results-item"}
              onClick={() => setSelectedId(m.id)}
            >
              <strong>{m.studentName}</strong>
              <span>{m.visits} visits</span>
            </button>
          ))}
        </div>
      </section>

      <section className="results-detail-panel">
        {selected && (
          <>
            <header className="results-detail-header">
              <div>
                <h2 className="results-detail-title">{firstName}'s Ancient Egypt tour</h2>
                <p className="results-detail-sub">Published 12 days ago · Anyone with the link</p>
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

            <div className="results-tiles">
              <div className="results-tile">
                <span className="results-tile-label">Visits</span>
                <strong>{selected.visits}</strong>
                <span className="results-tile-sub">people who opened the link</span>
              </div>
              {statTiles.map((tile) => (
                <div key={tile.label} className="results-tile">
                  <span className="results-tile-label">{tile.label}</span>
                  <strong>{tile.value}</strong>
                  <span className="results-tile-sub">{tile.sub}</span>
                </div>
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
        )}
      </section>
    </main>
  );
}