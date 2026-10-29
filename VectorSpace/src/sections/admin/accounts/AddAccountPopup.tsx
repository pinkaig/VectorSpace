/**
 * @file        AddAccountPopup.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the "+ Add an account" form. The new person starts as
 *              Invited. With All schools picked the form asks which school. On success the
 *              same popup shows the one-time password link, which is the only way in:
 *              nothing emails it and it cannot be shown again.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { ALL_SCHOOLS, type Account, type CreatedAccount } from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { Field } from "../../../ui/field";
import { Popup } from "../../../ui/popup";
import { useAdmin } from "../adminContext";

type AddAccountPopupProps = { onClose: () => void; onAdded: (account: Account) => void };

/** The API's own sentence where it has one (a 409 names the person), ours otherwise. */
function reason(error: unknown): string {
  if (error instanceof ApiError && typeof error.detail === "string") return error.detail;
  const message = error instanceof Error ? error.message : String(error);
  return `Could not add the account: ${message}`;
}

export function AddAccountPopup({ onClose, onAdded }: AddAccountPopupProps) {
  const { api, schools, schoolId } = useAdmin();
  // starts on the picked school, or the first one when All schools is picked
  const [chosenSchool, setChosenSchool] = useState(schoolId === ALL_SCHOOLS ? (schools[0]?.id ?? "") : schoolId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // "Educator" on screen, "teacher" in the database (see api/admin.ts)
  const [role, setRole] = useState<Account["role"]>("student");
  const [className, setClassName] = useState("");
  // the account once it exists: the form is then replaced by its invite link
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ready = name.trim() !== "" && email.includes("@") && chosenSchool !== "";
  const add = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const account = await api.addAccount({
        schoolId: chosenSchool, name: name.trim(), email: email.trim(), role,
        classNames: className.trim() ? [className.trim()] : [],
      });
      // the table gains the row straight away; this popup stays open, because the link it
      // carries is minted once and is not in any later reply
      onAdded(account);
      setCreated(account);
    } catch (error) {
      // against a real tenant this is a rate limit, a revoked M2M grant or a timeout, and a
      // duplicate address is refused with a 409 naming whoever holds it
      setProblem(reason(error));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created?.inviteLink ?? "");
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the link below can still be selected by hand
    }
  };

  return (
    <Popup
      title={created ? "Account created" : "Add an account"}
      subtitle={
        created
          ? `${created.name} is Invited until they sign in for the first time.`
          : "They start as Invited until they sign in for the first time."
      }
      onClose={onClose}
      actions={
        created ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!ready || busy} onClick={add}>
              {busy ? "Adding…" : "Add account"}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="admin-accounts-invite">
          {created.inviteLink ? (
            <>
              <p>
                Give this link to {created.name}: it is how they set a password and sign in for the
                first time. It works once, and this is the only time it can be shown.
              </p>
              <textarea
                className="admin-accounts-invite-link"
                readOnly
                rows={3}
                value={created.inviteLink}
                aria-label="One-time password link"
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="admin-accounts-invite-actions">
                <Button onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
              </div>
            </>
          ) : (
            <p>
              This build signs in without Auth0, so there is no link to hand over and no password
              to set: the API takes a &quot;dev|&hellip;&quot; bearer value instead of one (see
              DevLogins in provision.py). Against the real tenant, {created.name}&apos;s one-time
              password link appears here instead.
            </p>
          )}
        </div>
      ) : (
        <>
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
                <option value="teacher">Educator</option>
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
          {problem && <Motion as="p" cue="feedback.error" className="admin-accounts-problem" role="alert">{problem}</Motion>}
        </>
      )}
    </Popup>
  );
}
