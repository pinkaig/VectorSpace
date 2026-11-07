/**
 * @file        ClassRosterSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Organise classes, as a guided two-step page: the classes on the left (step 1, with
 *              + New class), the picked class's people on the right (step 2, with + Add people).
 *              Each step that has nothing in it yet says what to do and offers the button for it,
 *              and a new class goes straight on to "Add people". Each person's row has Move to…
 *              and Remove; the choices happen in popups, so the table stays in the Accounts style.
 *              Shared by Admin → Classes (any school's classes: pass schoolId) and the teacher's
 *              Students tab (only the classes they teach). The API decides who may do what: a
 *              teacher only moves students, and only between classes they teach. A move is one call
 *              and the student keeps their work; projects already sent to the new class are not
 *              copied to them, so the move popup says to send them again.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { GetToken } from "../../api/client";
import {
  addMember, createClass, listClasses, listMembers, moveMember, removeMember, type ClassInfo, type ClassMemberInfo,
} from "../../api/classes";
import { useLoad } from "../../api/useLoad";
import { Motion } from "../../motion/useMotion";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { initials } from "../../ui/initials";
import { LoadingRows } from "../../ui/loadingRows";
import { Popup } from "../../ui/popup";
import { StatusChip } from "../../ui/statusChip";
import "./classRoster.css";

export type Candidate = { id: string; display_name: string; role: string; email?: string };

type ClassRosterProps = {
  getToken: GetToken;
  // an admin's picked school; left out for a teacher, whose classes are the ones they teach
  schoolId?: string;
  // who "Add people" offers: the school's students and teachers for an admin, the teacher's own students
  loadCandidates: () => Promise<Candidate[]>;
  // a teacher may move or remove students only (the API answers 403 for anyone else), so other rows show no actions
  studentsOnly?: boolean;
};

// which popup is open; Add and Move carry their class, so a class made a moment ago is the one they act on
type Open =
  | { kind: "new" }
  | { kind: "add"; classId: string; className: string; fresh: boolean }
  | { kind: "move"; member: ClassMemberInfo }
  | null;

const roleLabel = (role: string) => (role === "teacher" ? "Educator" : role === "student" ? "Student" : "Admin");

export function ClassRosterSection({ getToken, schoolId, loadCandidates, studentsOnly = false }: ClassRosterProps) {
  const [version, setVersion] = useState(0); // bumped after every change, so both lists reload
  const reload = () => setVersion((v) => v + 1);
  const key = `${schoolId ?? "mine"}:${version}`;

  const classes = useLoad(() => listClasses(getToken, schoolId), key);
  const [picked, setPicked] = useState<string | null>(null);
  const current: ClassInfo | null = classes.data?.find((c) => c.id === picked) ?? classes.data?.[0] ?? null;
  const members = useLoad(() => (current ? listMembers(getToken, current.id) : Promise.resolve([])), `${current?.id}:${version}`);
  // who can be added changes with the school, not with each move, so it is not reloaded after every change
  const candidates = useLoad(loadCandidates, schoolId ?? "mine");

  const [open, setOpen] = useState<Open>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // every change goes through here: one message on success, the API's own reason on failure
  const act = async (work: () => Promise<unknown>, message: string): Promise<boolean> => {
    setProblem(null);
    setDone(null);
    try {
      await work();
      setDone(message);
      reload();
      return true;
    } catch (error) {
      setProblem((error as Error).message);
      return false;
    }
  };

  const emails = new Map((candidates.data ?? []).map((c) => [c.id, c.email]));
  const others = (classes.data ?? []).filter((c) => c.id !== current?.id);
  const canChange = (m: ClassMemberInfo) => !studentsOnly || m.role === "student";
  const startAdding = () => current && setOpen({ kind: "add", classId: current.id, className: current.name, fresh: false });
  const noClasses = classes.data?.length === 0;

  return (
    <div className="roster">
      {/*STEP 1, CLASSES: every class in scope, and + New class*/}
      <section className="admin-panel roster-classes">
        <div className="admin-panel-head">
          <h2><span className="roster-step">1</span>Classes</h2>
          {!noClasses && <Button variant="add" size="small" onClick={() => setOpen({ kind: "new" })}>+ New class</Button>}
        </div>
        {classes.error && <p className="roster-problem" role="alert">{classes.error}</p>}
        <LoadingRows loading={classes.loading} rows={3} />
        {noClasses && (
          <div className="roster-empty">
            <strong>Start by making a class</strong>
            <p>A class is who gets a project when a teacher sends it: for example 1A Science or Art Club.</p>
            <Button variant="primary" onClick={() => setOpen({ kind: "new" })}>+ New class</Button>
          </div>
        )}
        <ul className="roster-class-list">
          {(classes.data ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`roster-class ${c.id === current?.id ? "roster-class-picked" : ""}`}
                onClick={() => { setPicked(c.id); setDone(null); setProblem(null); }}
              >
                <span>{c.name}</span>
                <span className="roster-count">{c.member_count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/*STEP 2, PEOPLE: the picked class's people, with Move to… and Remove, and + Add people*/}
      <section className="admin-panel roster-people">
        <div className="admin-panel-head">
          <h2>
            <span className="roster-step">2</span>
            {current ? current.name : "People"}
            {members.data && current && <span className="roster-sub">{members.data.length} {members.data.length === 1 ? "person" : "people"}</span>}
          </h2>
          {current && members.data && members.data.length > 0 && (
            <Button variant="primary" size="small" onClick={startAdding}>+ Add people</Button>
          )}
        </div>
        {done && <p className="roster-done" role="status">{done}</p>}
        {problem && <Motion as="p" cue="feedback.error" className="roster-problem" role="alert">{problem}</Motion>}

        {!current && !classes.loading && (
          <p className="admin-muted">Make a class first. Its people show here, and you add them from here.</p>
        )}
        {current && (
          <>
            <LoadingRows loading={members.loading} rows={4} />
            {members.error && <p className="roster-problem" role="alert">{members.error}</p>}
            {members.data && members.data.length === 0 && (
              <div className="roster-empty">
                <strong>Nobody in {current.name} yet</strong>
                <p>
                  {studentsOnly
                    ? "Add the students who belong in it."
                    : "Add its students and the educator who teaches it. People are made on the Accounts page first."}
                </p>
                <Button variant="primary" onClick={startAdding}>+ Add people</Button>
              </div>
            )}
            {members.data && members.data.length > 0 && (
              <div className="admin-scroll">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Role</th><th /></tr></thead>
                  <tbody>
                    {members.data.map((m, index) => (
                      <Motion as="tr" cue="table.rows.enter" staggerIndex={index} key={m.id}>
                        <td>
                          <div className="admin-person">
                            <span className="admin-avatar" aria-hidden="true">{initials(m.display_name)}</span>
                            <span>
                              <strong>{m.display_name}</strong>
                              {emails.get(m.id) && <span className="admin-muted">{emails.get(m.id)}</span>}
                            </span>
                          </div>
                        </td>
                        <td><StatusChip tone={m.role === "student" ? "purple" : "amber"}>{roleLabel(m.role)}</StatusChip></td>
                        <td className="admin-actions">
                          {canChange(m) && others.length > 0 && (
                            <Button size="small" onClick={() => setOpen({ kind: "move", member: m })}>Move to…</Button>
                          )}
                          {canChange(m) && (
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => act(() => removeMember(getToken, current.id, m.id), `Took ${m.display_name} out of ${current.name}`)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </Motion>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {open?.kind === "new" && (
        <NewClassPopup
          onClose={() => setOpen(null)}
          onCreate={async (name) => {
            let made: ClassInfo | null = null;
            const ok = await act(async () => { made = await createClass(getToken, name, schoolId); }, `Made ${name}`);
            if (ok && made) {
              const fresh = made as ClassInfo;
              setPicked(fresh.id);
              // the guided next step: a new class is empty, so go straight on to filling it
              setOpen({ kind: "add", classId: fresh.id, className: fresh.name, fresh: true });
            }
            return ok;
          }}
        />
      )}

      {open?.kind === "add" && (
        <AddPeoplePopup
          className={open.className}
          fresh={open.fresh}
          loading={candidates.loading && !candidates.data}
          people={(candidates.data ?? []).filter((c) =>
            open.classId !== current?.id || !(members.data ?? []).some((m) => m.id === c.id))}
          onClose={() => setOpen(null)}
          onAdd={async (people) => {
            const failed: string[] = [];
            for (const person of people) {
              try {
                await addMember(getToken, open.classId, person.id);
              } catch (error) {
                failed.push(`${person.display_name}: ${(error as Error).message}`);
              }
            }
            reload();
            const added = people.length - failed.length;
            setDone(added ? `Added ${added} ${added === 1 ? "person" : "people"} to ${open.className}` : null);
            setProblem(failed.length ? `Not added. ${failed.join(". ")}` : null);
            setOpen(null);
          }}
        />
      )}

      {open?.kind === "move" && current && (
        <MovePopup
          member={open.member}
          from={current}
          to={others}
          onClose={() => setOpen(null)}
          onMove={async (to) => {
            const ok = await act(
              () => moveMember(getToken, current.id, open.member.id, to.id),
              `Moved ${open.member.display_name} to ${to.name}`,
            );
            if (ok) setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function NewClassPopup({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    if (!(await onCreate(name.trim()))) setBusy(false);
  };
  return (
    <Popup
      title="New class"
      subtitle="Next you add its people."
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || busy} onClick={submit}>Make class</Button>
        </>
      }
    >
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Field label="Class name">
          <input value={name} placeholder="1A Science" onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
      </form>
    </Popup>
  );
}

type AddPeopleProps = {
  className: string;
  // true straight after New class: the subtitle says the class was made
  fresh: boolean;
  people: Candidate[];
  loading: boolean;
  onClose: () => void;
  onAdd: (people: Candidate[]) => Promise<void>;
};

function AddPeoplePopup({ className, fresh, people, loading, onClose, onAdd }: AddPeopleProps) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const needle = search.trim().toLowerCase();
  const shown = people.filter((p) => !needle || `${p.display_name} ${p.email ?? ""}`.toLowerCase().includes(needle));
  const toggle = (id: string) => setChosen((set) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const count = chosen.size;

  return (
    <Popup
      title={`Add people to ${className}`}
      subtitle={fresh ? `${className} is made. Tick who belongs in it.` : "Tick who belongs in this class."}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{fresh ? "Later" : "Cancel"}</Button>
          <Button
            variant="primary"
            disabled={count === 0 || busy}
            onClick={async () => { setBusy(true); await onAdd(people.filter((p) => chosen.has(p.id))); }}
          >
            {busy ? "Adding…" : `Add ${count || ""} ${count === 1 ? "person" : "people"}`.replace("  ", " ")}
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingRows loading rows={4} />
      ) : people.length === 0 ? (
        <p className="admin-muted">Everyone who could join is already in {className}. New people are made on the Accounts page.</p>
      ) : (
        <>
          <input
            className="ui-input roster-search"
            aria-label="Search people"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <ul className="roster-pick-list">
            {shown.map((p) => (
              <li key={p.id}>
                <label className={`roster-pick ${chosen.has(p.id) ? "roster-pick-on" : ""}`}>
                  <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="admin-avatar" aria-hidden="true">{initials(p.display_name)}</span>
                  <span className="roster-pick-name">
                    <strong>{p.display_name}</strong>
                    {p.email && <span className="admin-muted">{p.email}</span>}
                  </span>
                  <StatusChip tone={p.role === "student" ? "purple" : "amber"}>{roleLabel(p.role)}</StatusChip>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="admin-muted">Nobody matches.</li>}
          </ul>
        </>
      )}
    </Popup>
  );
}

type MoveProps = {
  member: ClassMemberInfo;
  from: ClassInfo;
  to: ClassInfo[];
  onClose: () => void;
  onMove: (to: ClassInfo) => Promise<void>;
};

function MovePopup({ member, from, to, onClose, onMove }: MoveProps) {
  const [target, setTarget] = useState(to[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const chosen = to.find((c) => c.id === target);
  return (
    <Popup
      title={`Move ${member.display_name}`}
      subtitle={`Out of ${from.name} and into another class, in one step.`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!chosen || busy}
            onClick={async () => { if (!chosen) return; setBusy(true); await onMove(chosen); setBusy(false); }}
          >
            {chosen ? `Move to ${chosen.name}` : "Move"}
          </Button>
        </>
      }
    >
      <Field label="New class">
        <select value={target} onChange={(event) => setTarget(event.target.value)}>
          {to.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.member_count})</option>)}
        </select>
      </Field>
      <p className="admin-muted roster-note">
        {member.display_name} keeps all their work. Projects already sent to the new class are not copied to them:
        send those again from the project.
      </p>
    </Popup>
  );
}
