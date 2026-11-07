/**
 * @file        ImportCsvPopup.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: "Import class list (CSV)". Three steps in one popup:
 *              1. pick a school and a file; the API does a dry run and nothing is written;
 *              2. the preview says what each line would do: create, skip (already in the school), or why not;
 *              3. Create makes the accounts; the one-time sign-in links can then be downloaded as a CSV.
 *              The file is the provision CLI's format (email, display_name, role, classes), so a roster
 *              made for the CLI works here unchanged.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useRef, useState, type DragEvent } from "react";
import { ALL_SCHOOLS, type ImportRow } from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Popup } from "../../../ui/popup";
import { useAdmin } from "../adminContext";
import { downloadCsv, signInLinksCsv } from "./signInLinksCsv";

// the API's own limit is 200 rows; this stops an obviously wrong file (a photo, a spreadsheet) early
const MAX_FILE_BYTES = 200_000;

type ImportCsvPopupProps = { onClose: () => void; onImported: () => void };

const OUTCOME_LABEL: Record<ImportRow["outcome"], string> = {
  would_create: "Will be created",
  created: "Created",
  skipped_exists: "Already in this school: skipped",
  error: "Not added",
};

function reason(error: unknown): string {
  if (error instanceof ApiError && typeof error.detail === "string") return error.detail;
  return `Could not read the file: ${error instanceof Error ? error.message : String(error)}`;
}

// a blank file in the right shape, with one example line, so nobody has to type the header
const TEMPLATE = "email,display_name,role,classes\r\naisyah@school.example,Aisyah Rahman,student,1A Science;Art Club\r\n";

const STEPS = ["Choose the file", "Check what happens", "Hand out sign-in links"];

/** Where the popup is: 0 before a file is checked, 1 with a preview, 2 once accounts are made. */
function StepBar({ at }: { at: number }) {
  return (
    <ol className="admin-steps">
      {STEPS.map((label, index) => (
        <li key={label} className={index < at ? "admin-step-done" : index === at ? "admin-step-now" : undefined}>
          <span className="admin-step-dot">{index < at ? "✓" : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function ImportTable({ rows }: { rows: ImportRow[] }) {
  return (
    <div className="admin-scroll admin-import-table">
      <table className="admin-table">
        <thead>
          <tr><th>Line</th><th>Person</th><th>Role</th><th>Classes</th><th>Result</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className={row.outcome === "error" ? "admin-import-bad" : undefined}>
              <td>{row.line}</td>
              <td>
                <div className="admin-accounts-person">
                  <span>{row.name || "-"}</span>
                  <span className="admin-muted">{row.email || "-"}</span>
                </div>
              </td>
              <td>{row.role === "teacher" ? "educator" : row.role || "-"}</td>
              <td>{row.classNames.length ? row.classNames.join(", ") : "-"}</td>
              <td>{row.error ?? OUTCOME_LABEL[row.outcome]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportCsvPopup({ onClose, onImported }: ImportCsvPopupProps) {
  const { api, schools, schoolId } = useAdmin();
  const [chosenSchool, setChosenSchool] = useState(schoolId === ALL_SCHOOLS ? (schools[0]?.id ?? "") : schoolId);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [done, setDone] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const schoolName = schools.find((school) => school.id === chosenSchool)?.name ?? "this school";

  const check = async (picked: { name: string; text: string }, school: string) => {
    setBusy(true);
    setProblem(null);
    setPreview(null);
    try {
      setPreview(await api.importAccounts(school, picked.text, true));
    } catch (error) {
      setProblem(reason(error));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      setProblem(`${chosen.name} is too big for a class list. Up to 200 people per file.`);
      return;
    }
    const picked = { name: chosen.name, text: await chosen.text() };
    setFile(picked);
    await check(picked, chosenSchool);
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      setDone(await api.importAccounts(chosenSchool, file.text, false));
      onImported();
    } catch (error) {
      setProblem(reason(error));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) void pick(event.dataTransfer.files[0]);
  };

  const toCreate = preview?.filter((row) => row.outcome === "would_create").length ?? 0;
  const created = done?.filter((row) => row.outcome === "created") ?? [];
  const links = created.filter((row) => row.inviteLink).length;
  const failed = done?.filter((row) => row.outcome === "error").length ?? 0;

  const save = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`sign-in-links-${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}.csv`, signInLinksCsv(done ?? []));
  };

  return (
    <Popup
      silent // no sound for now
      title={done ? "Import finished" : "Import class list (CSV)"}
      subtitle={
        done
          ? `${schoolName}: ${created.length} created${failed ? `, ${failed} not added` : ""}.`
          : "Nothing is created until you press Create."
      }
      onClose={onClose}
      actions={
        done ? (
          <>
            {links > 0 && <Button onClick={save}>Download sign-in links (CSV)</Button>}
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={busy || toCreate === 0} onClick={apply}>
              {busy && preview ? "Creating…" : `Create ${toCreate} ${toCreate === 1 ? "account" : "accounts"}`}
            </Button>
          </>
        )
      }
    >
      <StepBar at={done ? 2 : preview ? 1 : 0} />
      {done ? (
        <div className="admin-accounts-invite">
          {links > 0 ? (
            <p>
              Each new person has a one-time sign-in link. Download them now: they are not shown again.
              The links work like passwords, so hand each one to its owner and delete the file afterwards.
              A lost link can be replaced from that person&apos;s row (New sign-in link).
            </p>
          ) : created.length > 0 ? (
            <p>
              This build signs in without Auth0, so there are no links to hand out. Against the real tenant
              a &quot;Download sign-in links&quot; button appears here.
            </p>
          ) : null}
          {failed > 0 && (
            <p>Rows marked Not added were not created. Fix them and import the same file again: rows already made are skipped.</p>
          )}
          <ImportTable rows={done} />
        </div>
      ) : (
        <>
          <Field label="School">
            <select
              value={chosenSchool}
              disabled={busy}
              onChange={(event) => {
                setChosenSchool(event.target.value);
                if (file) void check(file, event.target.value); // "already here" depends on the school
              }}
            >
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </Field>

          {/*DROP ZONE: drag the class list here, or click to choose it*/}
          <div
            className={`admin-library-drop admin-import-drop ${dragging ? "admin-library-drop-over" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <p>
              {file ? <><strong>{file.name}</strong>. Drop another file to replace it, or </> : <><strong>Drop the class list here</strong> or </>}
              <button type="button" className="admin-library-link" disabled={busy} onClick={() => picker.current?.click()}>
                {file ? "choose again" : "choose a file"}
              </button>
            </p>
            <p className="admin-muted">
              A .csv with the columns <code>email, display_name, role, classes</code>. Role is student, teacher or admin;
              classes are split by <code>;</code> and made if missing. Up to 200 people.{" "}
              <button type="button" className="admin-library-link" onClick={() => downloadCsv("class-list-template.csv", TEMPLATE)}>
                Download a template
              </button>
            </p>
            <input
              ref={picker}
              type="file"
              hidden
              accept=".csv,text/csv"
              onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }}
            />
          </div>
          {busy && !preview && <p className="admin-muted">Checking {file?.name}…</p>}
          {preview && (
            <>
              <p className="admin-import-summary">
                {file?.name}: {toCreate} to create, {preview.filter((r) => r.outcome === "skipped_exists").length} already here,{" "}
                {preview.filter((r) => r.outcome === "error").length} with a problem.
              </p>
              <ImportTable rows={preview} />
            </>
          )}
        </>
      )}
      {problem && <Motion as="p" cue="feedback.error" className="admin-accounts-problem" role="alert">{problem}</Motion>}
    </Popup>
  );
}
