/**
 * @file        SignInLinkPopup.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: "New sign-in link" for somebody who lost their first link or forgot
 *              their password, and OneTimeLink, the box that shows such a link (shared with the Add
 *              popup). Admin only (Sherman, 7 Nov). The link is asked for on a button press, not when
 *              the popup opens, so opening it by mistake mints nothing.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { Account } from "../../../api/admin";
import { ApiError } from "../../../api/client";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { Popup } from "../../../ui/popup";
import { useAdmin } from "../adminContext";

/**
 * A freshly minted one-time link, or the dev-build note when there is no tenant to mint one.
 * The link is a credential: it is shown here and copied, never logged, stored or put in a URL.
 */
export function OneTimeLink({ name, link, intro }: { name: string; link: string | null; intro: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link ?? "");
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the link below can still be selected by hand
    }
  };

  return (
    <div className="admin-accounts-invite">
      {link ? (
        <>
          <p>{intro} It works once, and this is the only time it can be shown.</p>
          <textarea
            className="admin-accounts-invite-link"
            readOnly
            rows={3}
            value={link}
            aria-label="One-time password link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="admin-accounts-invite-actions">
            <Button onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
          </div>
        </>
      ) : (
        <p>
          This build signs in without Auth0, so there is no link to hand over and no password to
          set: the API takes a &quot;dev|&hellip;&quot; bearer value instead of one (see DevLogins in
          provision.py). Against the real tenant, {name}&apos;s one-time password link appears here.
        </p>
      )}
    </div>
  );
}

type SignInLinkPopupProps = { account: Account; onClose: () => void };

export function SignInLinkPopup({ account, onClose }: SignInLinkPopupProps) {
  const { api } = useAdmin();
  // undefined until asked; then the link, or null where the build has no tenant
  const [link, setLink] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setLink(await api.newSignInLink(account.id));
    } catch (error) {
      // 409 for a turned-off account, 502 when Auth0 refused: both carry a sentence
      setProblem(error instanceof ApiError && typeof error.detail === "string" ? error.detail : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popup
      title="New sign-in link"
      subtitle={`${account.name} · ${account.email}`}
      onClose={onClose}
      actions={
        link !== undefined ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={busy} onClick={make}>{busy ? "Making…" : "Make a new link"}</Button>
          </>
        )
      }
    >
      {link !== undefined ? (
        <OneTimeLink
          name={account.name}
          link={link}
          intro={`Give this link to ${account.name}: it sets a new password and signs them in.`}
        />
      ) : (
        <p>
          For somebody who lost their first link or forgot their password. The new link sets a new
          password; their work and classes stay as they are.
        </p>
      )}
      {problem && <Motion as="p" cue="feedback.error" className="admin-accounts-problem" role="alert">{problem}</Motion>}
    </Popup>
  );
}
