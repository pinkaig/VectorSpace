/**
 * @file        SchoolsSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Overview section: the schools table and the "+ Add a school" popup.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { School } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Popup } from "../../../ui/popup";
import { StatusChip } from "../../../ui/statusChip";
import { useAdmin } from "../adminContext";

type SchoolsSectionProps = { schools: School[]; onAdded: () => void };

export function SchoolsSection({ schools, onAdded }: SchoolsSectionProps) {
  const { api } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const close = () => {
    setAdding(false);
    setName("");
  };
  const add = async () => {
    await api.addSchool(name.trim());
    close();
    onAdded();
  };

  return (
    <section className="admin-panel admin-overview-schools">
      <div className="admin-panel-head">
        <h2>Schools</h2>
        <Button variant="primary" onClick={() => setAdding(true)}>+ Add a school</Button>
      </div>

      <div className="admin-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>School</th><th>Students</th><th>Educators</th><th>Status</th></tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.id}>
                <td>{school.name}</td>
                <td>{school.students}</td>
                <td>{school.educators}</td>
                <td>
                  <StatusChip tone={school.status === "active" ? "green" : "amber"}>
                    {school.status === "active" ? "Active" : "Setting up"}
                  </StatusChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Popup
          title="Add a school"
          subtitle="It starts as Setting up. Add its people and rooms next."
          onClose={close}
          actions={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button variant="primary" disabled={!name.trim()} onClick={add}>Add school</Button>
            </>
          }
        >
          <Field label="School name">
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>
        </Popup>
      )}
    </section>
  );
}
