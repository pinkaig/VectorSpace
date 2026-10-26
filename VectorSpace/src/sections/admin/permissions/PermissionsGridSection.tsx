/**
 * @file        PermissionsGridSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Permissions section: the grid of nine settings with an On/Off switch for
 *              Students, one for Educators and a Can adjust tick, plus Save changes.
 *              Edits go to a draft copy; Save changes sends the draft to the API.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { PermissionRow } from "../../../api/admin";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { LoadingRows } from "../../../ui/loadingRows";
import { TickBox, Toggle } from "../../../ui/toggle";
import { useLoad } from "../../../api/useLoad";
import { useAdmin } from "../adminContext";

export function PermissionsGridSection({ schoolId }: { schoolId: string }) {
  const { api } = useAdmin();
  const { data: saved, setData: setSaved, error, loading } = useLoad(() => api.getPermissions(schoolId), schoolId);

  // the admin's changes so far, or null before the first click; what is shown is the changed
  // copy if there is one, otherwise what was saved
  const [edited, setEdited] = useState<PermissionRow[] | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const draft = edited ?? saved ?? [];

  const dirty = saved !== null && edited !== null && JSON.stringify(saved) !== JSON.stringify(edited);

  const change = (key: string, patch: Partial<PermissionRow>) => {
    setJustSaved(false);
    setEdited(draft.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const save = async () => {
    await api.savePermissions(schoolId, draft);
    setSaved(draft);
    setEdited(null);
    setJustSaved(true);
  };

  // the nine rows arrive in group order, so a heading is printed whenever the group changes
  const groups = draft.map((row, index) => (index === 0 || draft[index - 1].group !== row.group ? row.group : null));

  return (
    <section className="admin-panel admin-permissions">
      <div className="admin-panel-head">
        <h2>What each role can do</h2>
        {/*SAVE: the label beside it says whether there is anything to save*/}
        <div className="admin-permissions-save">
          {dirty && <span className="admin-permissions-state"><span className="admin-permissions-dot" />Unsaved changes</span>}
          {!dirty && justSaved && <Motion as="span" cue="feedback.saved" className="admin-permissions-state"><span className="admin-permissions-dot admin-permissions-dot-saved" />Saved</Motion>}
          <Button variant="primary" disabled={!dirty} onClick={save}>Save changes</Button>
        </div>
      </div>

      {error && <Motion as="p" cue="feedback.error" role="alert">Could not load permissions: {error}</Motion>}
      <LoadingRows loading={loading} />
      {/* the key changes when the answer arrives, so the grid fades in then and not before */}
      <Motion key={saved ? "loaded" : "loading"} cue="panel.content.enter" className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>Setting</th><th>Students</th><th>Educators</th><th>Can adjust</th></tr>
          </thead>
          <tbody>
            {draft.map((row, index) => (
              <PermissionRows key={row.key} row={row} group={groups[index]} onChange={change} />
            ))}
          </tbody>
        </table>
      </Motion>
    </section>
  );
}

type PermissionRowsProps = {
  row: PermissionRow;
  group: string | null;
  onChange: (key: string, patch: Partial<PermissionRow>) => void;
};

// one setting: an optional group heading row, then the setting row itself
function PermissionRows({ row, group, onChange }: PermissionRowsProps) {
  return (
    <>
      {group && <tr><th colSpan={4} className="admin-permissions-group">{group}</th></tr>}
      <tr>
        <td>{row.label}</td>
        <td className="admin-permissions-cell">
          <Toggle checked={row.students} label={`${row.label}: students`} onChange={(next) => onChange(row.key, { students: next })} />
        </td>
        <td className="admin-permissions-cell">
          <Toggle checked={row.educators} label={`${row.label}: educators`} onChange={(next) => onChange(row.key, { educators: next })} />
        </td>
        <td className="admin-permissions-cell">
          <TickBox checked={row.canAdjust} label={`${row.label}: educators can adjust`} onChange={(next) => onChange(row.key, { canAdjust: next })} />
        </td>
      </tr>
    </>
  );
}
