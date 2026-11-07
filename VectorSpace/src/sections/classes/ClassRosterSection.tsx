/**
 * @file        ClassRosterSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Organise classes: the classes on the left (with New class), the picked class's
 *              people on the right, each with Move to another class and Remove, and Add someone.
 *              Shared by Admin → Classes (any school's classes: pass schoolId) and the teacher's
 *              Students tab (only the classes they teach). The API decides who may do what: a
 *              teacher only moves students, and only between classes they teach. A move is one call
 *              and the student keeps their work; projects already sent to the new class are not
 *              copied to them, so the note under the list says to send them again.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { GetToken } from "../../api/client";
import {
  addMember, createClass, listClasses, listMembers, moveMember, removeMember, type ClassInfo,
} from "../../api/classes";
import { useLoad } from "../../api/useLoad";
import { Button } from "../../ui/button";
import { LoadingRows } from "../../ui/loadingRows";
import "./classRoster.css";

export type Candidate = { id: string; display_name: string; role: string };

type ClassRosterProps = {
  getToken: GetToken;
  // an admin's picked school; left out for a teacher, whose classes are the ones they teach
  schoolId?: string;
  // who "Add someone" offers: the school's students and teachers for an admin, the teacher's own students
  loadCandidates: () => Promise<Candidate[]>;
  // a teacher may move or remove students only (the API answers 403 for anyone else), so other rows show no actions
  studentsOnly?: boolean;
};

export function ClassRosterSection({ getToken, schoolId, loadCandidates, studentsOnly = false }: ClassRosterProps) {
  const [version, setVersion] = useState(0); // bumped after every change, so both lists reload
  const reload = () => setVersion((v) => v + 1);
  const key = `${schoolId ?? "mine"}:${version}`;

  const classes = useLoad(() => listClasses(getToken, schoolId), key);
  const [picked, setPicked] = useState<string | null>(null);
  const current: ClassInfo | null = classes.data?.find((c) => c.id === picked) ?? classes.data?.[0] ?? null;
  const members = useLoad(() => (current ? listMembers(getToken, current.id) : Promise.resolve([])), `${current?.id}:${version}`);
  const candidates = useLoad(loadCandidates, key);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState("");
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // every change goes through here: one message on success, the API's own reason on failure
  const act = async (work: () => Promise<unknown>, message: string) => {
    setProblem(null);
    setDone(null);
    try {
      await work();
      setDone(message);
      reload();
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  const others = (classes.data ?? []).filter((c) => c.id !== current?.id);
  const memberIds = new Set((members.data ?? []).map((m) => m.id));
  const addable = (candidates.data ?? []).filter((c) => !memberIds.has(c.id));

  return (
    <div className="roster">
      {/*CLASSES: every class in scope, and New class*/}
      <section className="admin-panel roster-classes">
        <div className="admin-panel-head"><h2>Classes</h2></div>
        {classes.error && <p className="roster-problem" role="alert">{classes.error}</p>}
        <LoadingRows loading={classes.loading} rows={3} />
        {classes.data && classes.data.length === 0 && <p className="roster-muted">No classes yet.</p>}
        <ul className="roster-class-list">
          {(classes.data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`roster-class ${c.id === current?.id ? "roster-class-picked" : ""}`}
                onClick={() => { setPicked(c.id); setDone(null); setProblem(null); }}
              >
                <span>{c.name}</span>
                <span className="roster-muted">{c.member_count}</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className="roster-new"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newName.trim();
            if (name) act(() => createClass(getToken, name, schoolId), `Made ${name}`).then(() => setNewName(""));
          }}
        >
          <input aria-label="New class name" placeholder="New class name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button variant="add" size="small" disabled={!newName.trim()} onClick={(e) => e.currentTarget.form?.requestSubmit()}>+ New class</Button>
        </form>
      </section>

      {/*PEOPLE: the picked class's roster, with Move and Remove, and Add someone*/}
      <section className="admin-panel roster-people">
        <div className="admin-panel-head">
          <h2>{current ? current.name : "Pick a class"}</h2>
        </div>
        {done && <p className="roster-done" role="status">{done}</p>}
        {problem && <p className="roster-problem" role="alert">{problem}</p>}
        {current && (
          <>
            <LoadingRows loading={members.loading} rows={4} />
            {members.error && <p className="roster-problem" role="alert">{members.error}</p>}
            {members.data && (
              <div className="admin-scroll">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Move to</th><th /></tr></thead>
                  <tbody>
                    {members.data.map((m) => (
                      <tr key={m.id}>
                        <td>{m.display_name}</td>
                        <td>{m.role === "teacher" ? "Educator" : m.role === "student" ? "Student" : "Admin"}</td>
                        {studentsOnly && m.role !== "student" ? (
                          <><td /><td /></>
                        ) : (<>
                        <td>
                          <select
                            aria-label={`Class to move ${m.display_name} to`}
                            value={moveTo[m.id] ?? ""}
                            onChange={(e) => setMoveTo({ ...moveTo, [m.id]: e.target.value })}
                          >
                            <option value="">Choose a class</option>
                            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="admin-actions">
                          <Button
                            size="small"
                            disabled={!moveTo[m.id]}
                            onClick={() => {
                              const to = others.find((c) => c.id === moveTo[m.id]);
                              if (to) act(() => moveMember(getToken, current.id, m.id, to.id), `Moved ${m.display_name} to ${to.name}`);
                            }}
                          >
                            Move
                          </Button>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => act(() => removeMember(getToken, current.id, m.id), `Took ${m.display_name} out of ${current.name}`)}
                          >
                            Remove
                          </Button>
                        </td>
                        </>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {members.data.length === 0 && <p className="roster-muted">Nobody in this class yet.</p>}
              </div>
            )}
            <div className="roster-add">
              <select aria-label="Person to add" value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Add someone to {current.name}</option>
                {addable.map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name}{c.role === "teacher" ? " (educator)" : ""}</option>
                ))}
              </select>
              <Button
                size="small"
                disabled={!adding}
                onClick={() => {
                  const person = addable.find((c) => c.id === adding);
                  if (person) act(() => addMember(getToken, current.id, person.id), `Added ${person.display_name} to ${current.name}`).then(() => setAdding(""));
                }}
              >
                Add
              </Button>
            </div>
            <p className="roster-muted roster-note">
              Moving a student keeps all their work. Projects already sent to the new class are not copied to them:
              send those again from the project.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
