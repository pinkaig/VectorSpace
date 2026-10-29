/**
 * @file        AssignDialogSection.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       Template setup's Assign popup: pick the class, then everyone in it or only some
 *              students. Students who already have a copy are shown ticked and greyed out, since
 *              a copy is theirs and is never sent again. Confirming hands the choice back to the
 *              page, which saves the project and sends the copies (TeacherTemplateSetupPage).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listMyClasses, type ClassInfo } from "../../api/classes";
import { classRoster, type RosterStudent } from "../../api/projects";
import type { GetToken } from "../../api/client";
import { useLoad } from "../../api/useLoad";
import "./templateSetup.css";

// what the teacher picked: the class, and the students to send a copy to now
export type AssignChoice = { classId: string; className: string; studentIds: string[] };

type AssignDialogSectionProps = {
  getToken: GetToken;
  projectId: string;
  projectName: string;
  // the class the project is filed under, picked first
  classId?: string | null;
  saving: boolean;
  onCancel: () => void;
  onAssign: (choice: AssignChoice) => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function AssignDialogSection({ getToken, projectId, projectName, classId, saving, onCancel, onAssign }: AssignDialogSectionProps) {
  const classes = useLoad(() => listMyClasses(getToken), "assign-classes");
  const [picked, setPicked] = useState<string | null>(classId ?? null);
  // the class the project is in, or the first one, once the classes arrive
  useEffect(() => {
    const list = classes.data;
    if (list && list.length > 0 && !list.some((c) => c.id === picked)) setPicked(list[0].id);
  }, [classes.data]);
  const pickedClass: ClassInfo | undefined = classes.data?.find((c) => c.id === picked);

  // the picked class's students, asked again whenever the class changes
  const roster = useLoad(
    () => (picked ? classRoster(getToken, projectId, projectName, picked) : Promise.resolve([] as RosterStudent[])),
    `assign-roster-${picked}`,
  );
  const [everyone, setEveryone] = useState(true);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // a new class starts from "everyone" with nobody ticked
  useEffect(() => {
    setEveryone(true);
    setChosen(new Set());
  }, [picked]);

  const waiting = (roster.data ?? []).filter((student) => !student.hasCopy);
  const studentIds = everyone ? waiting.map((student) => student.id) : waiting.filter((s) => chosen.has(s.id)).map((s) => s.id);

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Escape closes, as on the teacher home's popups
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && !saving && onCancel();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onCancel]);

  const confirmLabel = saving
    ? "Assigning…"
    : studentIds.length > 0
      ? `Assign to ${plural(studentIds.length, "student")}`
      : "Save and assign";

  return (
    <div className="setup-assign-overlay" onClick={() => !saving && onCancel()}>
      <div
        className="setup-assign-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-assign-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="setup-assign-head">
          <div>
            <h2 id="setup-assign-title" className="setup-assign-title">Assign "{projectName}"</h2>
            <p className="setup-assign-text">Each student gets their own copy to build in. Copies they already have are kept.</p>
          </div>
          <button type="button" className="setup-assign-close" aria-label="Close" onClick={onCancel} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <span className="setup-assign-label">Class</span>
        <div className="setup-assign-picks" role="radiogroup" aria-label="Class">
          {classes.loading && <span className="setup-assign-note">Loading your classes…</span>}
          {classes.error && <span className="setup-assign-error">Could not load your classes: {classes.error}</span>}
          {classes.data?.length === 0 && <span className="setup-assign-note">You're not in any class yet.</span>}
          {classes.data?.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={picked === c.id}
              className={picked === c.id ? "setup-assign-pick setup-assign-pick-on" : "setup-assign-pick"}
              onClick={() => setPicked(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {pickedClass && (
          <>
            <span className="setup-assign-label">Students</span>
            {roster.loading && <p className="setup-assign-note">Loading the class…</p>}
            {roster.error && <p className="setup-assign-error">Could not load the class: {roster.error}</p>}
            {roster.data && (
              <>
                <div className="setup-assign-modes" role="radiogroup" aria-label="Who gets it">
                  <label>
                    <input type="radio" name="assign-who" checked={everyone} onChange={() => setEveryone(true)} />
                    Everyone in {pickedClass.name} ({plural(roster.data.length, "student")})
                  </label>
                  <label>
                    <input type="radio" name="assign-who" checked={!everyone} onChange={() => setEveryone(false)} />
                    Only some
                  </label>
                </div>
                {roster.data.length === 0 && <p className="setup-assign-note">There are no students in this class yet.</p>}
                {!everyone && roster.data.length > 0 && (
                  <ul className="setup-assign-students">
                    {roster.data.map((student) => (
                      <li key={student.id}>
                        <label className={student.hasCopy ? "setup-assign-student-done" : undefined}>
                          <input
                            type="checkbox"
                            checked={student.hasCopy || chosen.has(student.id)}
                            disabled={student.hasCopy}
                            onChange={() => toggle(student.id)}
                          />
                          {student.display_name}
                          {student.hasCopy && <small>has it</small>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {everyone && roster.data.length > waiting.length && (
                  <p className="setup-assign-note">
                    {plural(roster.data.length - waiting.length, "student")} already {roster.data.length - waiting.length === 1 ? "has" : "have"} it.
                  </p>
                )}
              </>
            )}
          </>
        )}

        <div className="setup-assign-actions">
          <button type="button" className="setup-assign-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="setup-assign-primary"
            disabled={saving || !pickedClass || !roster.data}
            onClick={() => pickedClass && onAssign({ classId: pickedClass.id, className: pickedClass.name, studentIds })}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
