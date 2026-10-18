/**
 * @file        AddAccountPopup.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the "+ Add an account" form. The new person starts as
 *              Invited. With All schools picked the form asks which school.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { ALL_SCHOOLS, type Account } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Popup } from "../../../ui/popup";
import { useAdmin } from "../adminContext";

type AddAccountPopupProps = { onClose: () => void; onAdded: (account: Account) => void };

export function AddAccountPopup({ onClose, onAdded }: AddAccountPopupProps) {
  const { api, schools, schoolId } = useAdmin();
  // starts on the picked school, or the first one when All schools is picked
  const [chosenSchool, setChosenSchool] = useState(schoolId === ALL_SCHOOLS ? (schools[0]?.id ?? "") : schoolId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Account["role"]>("student");
  const [className, setClassName] = useState("");

  const ready = name.trim() !== "" && email.includes("@") && chosenSchool !== "";
  const add = async () => {
    const account = await api.addAccount({
      schoolId: chosenSchool, name: name.trim(), email: email.trim(), role, className: className.trim() || null,
    });
    onAdded(account);
  };

  return (
    <Popup
      title="Add an account"
      subtitle="They start as Invited until they sign in for the first time."
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={add}>Add account</Button>
        </>
      }
    >
      <div className="admin-accounts-form">
        <div className="admin-accounts-wide">
          <Field label="Full name"><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
        </div>
        <div className="admin-accounts-wide">
          <Field label="School email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        </div>
        <Field label="Role">
          <select value={role} onChange={(event) => setRole(event.target.value as Account["role"])}>
            <option value="student">Student</option>
            <option value="educator">Educator</option>
          </select>
        </Field>
        <Field label="Class (optional)"><input value={className} onChange={(event) => setClassName(event.target.value)} /></Field>
        <div className="admin-accounts-wide">
          <Field label="School">
            <select value={chosenSchool} onChange={(event) => setChosenSchool(event.target.value)}>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Popup>
  );
}
