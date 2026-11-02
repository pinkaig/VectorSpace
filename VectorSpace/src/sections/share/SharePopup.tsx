/**
 * @file        SharePopup.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief      Manages room positioning and adjacency within the room layout,
 *             including grid cell lookup, directional offsets, neighboring
 *             room detection, and available cell allocation.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ProjectData } from "../../project/model";
import type { ProjectSharing } from "../../project/serializer";
import type { ShareWith } from "../../api/projects";
import { checkGoal } from "../../mission/checkTodo";
import "./sharePopup.css";

export type ShareStatus = "draft" | "submitted" | "published";

type SharePopupProps = {
  project: ProjectData;
  status: ShareStatus;
  sharing: ProjectSharing;
  // true for a student: the teacher publishes it; false for a teacher: it goes live at once
  needsReview: boolean;
  busy: boolean;
  error: string | null;
  onSend: (shareWith: ShareWith) => void;
  // takes back a hand-in that is still waiting for the teacher
  onWithdraw: () => void;
  onClose: () => void;
};

const VISIT_OPTIONS: { value: ShareWith; label: string; detail: string }[] = [
  { value: "sign_in_only", label: "My class only", detail: "Classmates need to sign in" },
  { value: "unlisted", label: "Anyone with the link", detail: "Not searchable. Good for family and friends" },
  { value: "public", label: "Everyone", detail: "Listed publicly so anyone can find it" },
];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// what's inside, as ticks and warnings; a warning never stops a send
function readiness(project: ProjectData): { ok: boolean; text: string }[] {
  const count = (kind: "exhibits" | "factCards" | "reactions") =>
    checkGoal({ kind, target: 1, compare: "atLeast" }, project).done;
  const exhibits = count("exhibits");
  const cards = count("factCards");
  const reactions = count("reactions");
  const lines = [
    { ok: exhibits > 0, text: exhibits > 0 ? `${plural(exhibits, "exhibit", "exhibits")} placed` : "No exhibits yet" },
    { ok: cards > 0, text: cards > 0 ? `${plural(cards, "fact card", "fact cards")} written` : "No fact cards yet" },
    { ok: reactions > 0, text: reactions > 0 ? `${plural(reactions, "reaction", "reactions")} added` : "No reactions yet" },
  ];
  const empty = project.scenes.filter((scene) => scene.objects.length === 0);
  empty.forEach((scene) => lines.push({ ok: false, text: `${scene.name} is still empty` }));
  if (empty.length === 0 && project.scenes.length > 1) lines.push({ ok: true, text: "Every room has something in it" });
  return lines;
}

// the project's link in a read-only box, and a button that copies it
function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // no clipboard access: the link stays selectable in the box
    }
  };
  return (
    <div className="share-link">
      <input className="share-link-box" value={link} readOnly aria-label="Your project's link" onFocus={(event) => event.target.select()} />
      <button type="button" className="share-primary" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}

export function SharePopup({ project, status, sharing, needsReview, busy, error, onSend, onWithdraw, onClose }: SharePopupProps) {
  const [visibility, setVisibility] = useState<ShareWith>(sharing.shareWith ?? "sign_in_only");
  const teacher = sharing.teacherName ?? "your teacher";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chosen = VISIT_OPTIONS.find((option) => option.value === sharing.shareWith);
  // the visitor link, on whatever address the site is served from (localhost, the live host).
  // The app is a HashRouter, so the route goes after "#"; it opens VisitPage.
  const link = sharing.slug ? `${window.location.origin}${window.location.pathname}#/visit/${sharing.slug}` : null;

  return (
    <div className="share-layer">
      <div className="share-backdrop" onClick={onClose} />
      <div className="share-popup" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="share-head">
          <h2 id="share-title" className="share-title">Share your project</h2>
          <button type="button" className="share-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {status === "submitted" && (
          <>
            <p className="share-state share-state-waiting">Waiting for {teacher} to approve</p>
            <p className="share-note">Your link is ready. It will start working once it's approved.</p>
            {link && <ShareLink link={link} />}
            <p className="share-note">Want to change something first? Cancel and send it again when you're ready.</p>
            {error && <p className="share-error" role="alert">{error}</p>}
            <div className="share-actions">
              <button type="button" className="share-secondary" onClick={onWithdraw} disabled={busy}>
                {busy ? "Cancelling…" : "Cancel submission"}
              </button>
            </div>
          </>
        )}

        {status === "published" && (
          <>
            <p className="share-state share-state-live">Your project is published</p>
            {chosen && <p className="share-note">Who can visit: <strong>{chosen.label}</strong></p>}
            {link && <ShareLink link={link} />}
            {sharing.reviewStatus === "approved" && sharing.reviewComment && <p className="share-comment"><strong>{teacher}:</strong> {sharing.reviewComment}</p>}
          </>
        )}

        {status === "draft" && (
          <>
            {sharing.reviewStatus === "sent_back" && sharing.reviewComment && (
              <p className="share-comment share-comment-back">
                <strong>{teacher} sent it back:</strong> {sharing.reviewComment}
              </p>
            )}
            <ul className="share-ready">
              {readiness(project).map((line) => (
                <li key={line.text} className={line.ok ? "share-ready-ok" : "share-ready-warn"}>
                  <span aria-hidden="true">{line.ok ? "✓" : "!"}</span> {line.text}
                </li>
              ))}
            </ul>

            <fieldset className="share-visit">
              <legend className="share-label">Who can visit?</legend>
              {VISIT_OPTIONS.map((option) => (
                <label key={option.value} className={option.value === visibility ? "share-option share-option-on" : "share-option"}>
                  <input
                    type="radio"
                    name="share-visibility"
                    value={option.value}
                    checked={option.value === visibility}
                    onChange={() => setVisibility(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <p className="share-note">
              {needsReview ? `${teacher[0].toUpperCase()}${teacher.slice(1)} will take a quick look before your link goes live.` : "It goes live as soon as you publish."}
            </p>
            {error && <p className="share-error" role="alert">{error}</p>}
            <div className="share-actions">
              <button type="button" className="share-secondary" onClick={onClose}>Not yet</button>
              <button type="button" className="share-primary" onClick={() => onSend(visibility)} disabled={busy}>
                {busy ? "Sending…" : needsReview ? `Send to ${teacher}` : "Publish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
