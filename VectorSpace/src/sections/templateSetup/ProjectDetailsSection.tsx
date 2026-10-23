/**
 * @file        ProjectDetailsSection.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Template setup, right panel: a summary box (class, due date, template), switches
 *              for what students cannot change, and which asset catalogues the project uses.
 *              DRAWN ONLY: the class is sample data, and the switches and catalogue chips flip
 *              on screen but nothing is saved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Check } from "lucide-react";
import { Toggle } from "../../ui/toggle";
import "./templateSetup.css";

// SAMPLE DATA: the template name, locks and catalogues shown in this panel
const SAMPLE_TEMPLATE = "Museum template";
const SAMPLE_LOCKS = [
  { id: "walls", name: "Walls and floor", on: true },
  { id: "entrance", name: "Entrance door", on: true },
  { id: "spots", name: "Suggested spots", on: false },
];
const SAMPLE_CATALOGUES = [
  { id: "dinosaurs", name: "Dinosaurs", on: true },
  { id: "basics", name: "Museum basics", on: true },
  { id: "egypt", name: "Ancient Egypt", on: false },
  { id: "space", name: "Outer space", on: false },
];

type ProjectDetailsSectionProps = {
  className: string;
  // from the mission brief, so changing it there changes it here too
  due: string;
};

export function ProjectDetailsSection({ className, due }: ProjectDetailsSectionProps) {
  // kept on this screen only, so the switches and chips respond when clicked
  const [locks, setLocks] = useState(SAMPLE_LOCKS);
  const [catalogues, setCatalogues] = useState(SAMPLE_CATALOGUES);

  const flipLock = (id: string, on: boolean) =>
    setLocks((list) => list.map((lock) => (lock.id === id ? { ...lock, on } : lock)));
  const flipCatalogue = (id: string) =>
    setCatalogues((list) => list.map((cat) => (cat.id === id ? { ...cat, on: !cat.on } : cat)));

  return (
    <section className="setup-panel">
      <h2 className="setup-panel-title">Project details</h2>
      <dl className="details-summary">{/*SUMMARY: label on the left, value on the right*/}
        <div>
          <dt>Class</dt>
          <dd>{className}</dd>
        </div>
        <div><dt>Due</dt><dd>{due || "Not set"}</dd></div>
        <div><dt>Template</dt><dd>{SAMPLE_TEMPLATE}</dd></div>
      </dl>
      <h3 className="setup-heading">Locked for students</h3>{/*LOCKED FOR STUDENTS: name on the left, switch (with On / Off) on the right*/}
      <ul className="details-locks">
        {locks.map((lock) => (
          <li key={lock.id} className="details-lock">
            <span className="details-lock-name">{lock.name}</span>
            <Toggle checked={lock.on} label={`Lock ${lock.name} for students`} onChange={(on) => flipLock(lock.id, on)} />
          </li>
        ))}
      </ul>
      <h3 className="setup-heading">Catalogue for this project</h3>{/*CATALOGUE: chips that are picked (dark, with a tick) or not (white)*/}
      <div className="details-catalogues">
        {catalogues.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`details-catalogue ${cat.on ? "details-catalogue-on" : ""}`}
            onClick={() => flipCatalogue(cat.id)}
          >
            {cat.on && <Check size={14} strokeWidth={3} />}
            {cat.name}
          </button>
        ))}
      </div>
    </section>
  );
}
