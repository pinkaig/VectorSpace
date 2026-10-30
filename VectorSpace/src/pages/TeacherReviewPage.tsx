/**
 * @file        TeacherReviewPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Review tab: every student in the class with status
 *              tabs and pages of 8 on the left; the selected museum on the
 *              right with grade, comment, quick comments, and Approve and
 *              publish or Send back. Shown inside TeacherLayout. The list is
 *              the students' museums in the teacher's classes (API), with each
 *              one's newest hand-in: Waiting ones can be approved (published)
 *              or sent back with a comment. A published one has a "Show on the
 *              sign-in page" switch. Quick comments are not stored yet.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import type { TeacherOutletContext } from "./TeacherLayout";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { apiUrl } from "../api/client";
import {
  approveProject,
  listStudentMuseums,
  sendBackProject,
  setShowcase,
  type Project,
} from "../api/projects";
import { useLoad } from "../api/useLoad";
import { useSession } from "../session/session";
import { MuseumPreview } from "../ui/museumPreview";
import { Toggle } from "../ui/toggle";
import "./TeacherReviewPage.css";

type Status =
  | "Waiting"
  | "Published"
  | "Sent back"
  | "Building"
  | "Not started";

// one student's museum, as the review list and detail show it
type Submission = {
  id: string;
  studentName: string;
  projectName: string;
  sent: string; // e.g. "Sent 2 hours ago"
  status: Status;
  shareWith?: string; // who the student wants to share it with
  todos?: { label: string; count?: string; done: boolean }[]; // the mission brief, ticked
  inside?: { value: number; label: string }[]; // counts: exhibits, fact cards, reactions, rooms
  showcase?: boolean; // on the public sign-in page (published museums only)
};

// "today", "yesterday" or "3 days ago", from an ISO date string
const daysAgo = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

// who the student picked in the share popup, in the teacher's words
const SHARE_LABEL: Record<string, string> = {
  sign_in_only: "my class only",
  unlisted: "anyone with the link",
  public: "everyone",
};

// A student's project from the API: its newest hand-in decides Waiting and Sent back; otherwise
// published, being built (the student has saved), or not started (only the teacher's send is saved).
const toSubmission = (project: Project): Submission => {
  const started =
    project.current_revision > 0 &&
    project.saved_by_name === project.created_by_name;
  const status: Status =
    project.review_status === "waiting"
      ? "Waiting"
      : project.review_status === "sent_back"
        ? "Sent back"
        : project.status === "published"
          ? "Published"
          : started
            ? "Building"
            : "Not started";
  return {
    id: project.id,
    studentName: project.created_by_name,
    projectName: project.name,
    status,
    sent:
      status === "Waiting" && project.submitted_at
        ? `Sent ${daysAgo(project.submitted_at)}`
        : status === "Sent back"
          ? "Sent back · waiting for changes"
          : status === "Published"
            ? `Published · updated ${daysAgo(project.updated_at)}`
            : status === "Building" && project.saved_at
              ? `Edited ${daysAgo(project.saved_at)}`
              : "Not opened yet",
    shareWith: project.share_with ? SHARE_LABEL[project.share_with] : undefined,
    showcase: project.showcase,
  };
};

// the teacher's saved quick comments: none until they're stored per teacher
const startingQuickComments: string[] = [];

// chip colour per status, from the manual
const chipClass: Record<Status, string> = {
  Waiting: "review-chip review-chip-amber",
  Published: "review-chip review-chip-green",
  "Sent back": "review-chip review-chip-red",
  Building: "review-chip review-chip-purple",
  "Not started": "review-chip review-chip-grey",
};

type Tab = "All" | Status;
const tabs: Tab[] = [
  "All",
  "Waiting",
  "Published",
  "Sent back",
  "Building",
  "Not started",
];
const PAGE_SIZE = 8;

export default function TeacherReviewPage() {
  const { getToken } = useSession();
  const outlet = useOutletContext<TeacherOutletContext | undefined>();
  // the students' museums in this teacher's classes; none offline
  const loaded = useLoad(
    () => (apiUrl ? listStudentMuseums(getToken) : Promise.resolve([])),
    "review-museums",
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded.data) return;
    const rows = loaded.data.map(toSubmission);
    setSubmissions(rows);
    setSelectedId((current) => current ?? rows[0]?.id ?? null);
  }, [loaded.data]);
  // why the sign-in page switch did not change, shown under it
  const [showcaseError, setShowcaseError] = useState<string | null>(null);

  const toggleShowcase = async (id: string, on: boolean) => {
    setShowcaseError(null);
    try {
      const saved = await setShowcase(getToken, id, on);
      setSubmissions((current) =>
        current.map((s) =>
          s.id === id ? { ...s, showcase: saved.showcase } : s,
        ),
      );
    } catch (problem) {
      setShowcaseError((problem as Error).message);
    }
  };
  const [comment, setComment] = useState("");
  const [grade, setGrade] = useState("");
  const [quickComments, setQuickComments] = useState(startingQuickComments);
  const [message, setMessage] = useState<{
    text: string;
    tone: "green" | "red";
  } | null>(null);

  // which tab and which page are showing
  const [tab, setTab] = useState<Tab>("All");
  const [page, setPage] = useState(1);

  // worked out from the state above every time the page draws
  const countFor = (t: Tab) =>
    t === "All"
      ? submissions.length
      : submissions.filter((s) => s.status === t).length;

  const filtered =
    tab === "All" ? submissions : submissions.filter((s) => s.status === tab);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shownOnPage = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstShown = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, filtered.length);

  const selected = submissions.find((s) => s.id === selectedId);
  const firstName = selected ? selected.studentName.split(" ")[0] : "";

  // only a museum that was sent can be approved or sent back
  const canDecide = selected?.status === "Waiting";

  // tapping a quick comment adds it to the end of the comment
  const addQuickComment = (text: string) => {
    setComment((current) =>
      current.trim() ? `${current.trim()} ${text}` : text,
    );
  };

  // saves what's typed as a new quick comment, if it isn't one already
  const commentToSave = comment.trim();
  const canSaveQuickComment =
    commentToSave !== "" && !quickComments.includes(commentToSave);
  const saveQuickComment = () => {
    if (canSaveQuickComment)
      setQuickComments((current) => [...current, commentToSave]);
  };

  // Approve publishes it; Send back needs a comment so the student knows what to change.
  // Saved first, then the list and the message update.
  const [deciding, setDeciding] = useState(false);
  const decide = async (status: "Published" | "Sent back") => {
    if (!selected) return;
    const review = {
      grade: grade.trim() || undefined,
      comment: comment.trim() || undefined,
    };
    if (status === "Sent back" && !review.comment) {
      setMessage({
        text: `Write a comment so ${firstName} knows what to change`,
        tone: "red",
      });
      return;
    }
    setDeciding(true);
    setMessage(null);
    try {
      if (status === "Published")
        await approveProject(getToken, selected.id, review);
      else
        await sendBackProject(getToken, selected.id, {
          grade: review.grade,
          comment: review.comment!,
        });
      setSubmissions((current) =>
        current.map((s) =>
          s.id === selectedId
            ? {
                ...s,
                status,
                sent:
                  status === "Published"
                    ? "Published · updated today"
                    : "Sent back · waiting for changes",
              }
            : s,
        ),
      );
      setMessage(
        status === "Published"
          ? {
              text: `Published · ${firstName} has been notified`,
              tone: "green",
            }
          : { text: `Sent back · ${firstName} has been notified`, tone: "red" },
      );
      setComment("");
      setGrade("");
      outlet?.refreshWaiting();
    } catch (problem) {
      setMessage({
        text: `Couldn't save: ${(problem as Error).message}`,
        tone: "red",
      });
    } finally {
      setDeciding(false);
    }
  };

  return (
    <main className="review">
      <section className="review-list-panel">
        <h1 className="review-list-title">Review</h1>
        <p className="review-list-sub">
          Every student's museum. Pick a tab to see who needs you.
        </p>

        <div className="review-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={
                tab === t ? "review-tab review-tab-selected" : "review-tab"
              }
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t}
              <span className="review-tab-count">{countFor(t)}</span>
            </button>
          ))}
        </div>

        <div className="review-list">
          {shownOnPage.map((s) => (
            <button
              key={s.id}
              type="button"
              className={
                s.id === selectedId
                  ? "review-item review-item-selected"
                  : "review-item"
              }
              onClick={() => {
                setSelectedId(s.id);
                setMessage(null);
                setShowcaseError(null);
                setComment("");
                setGrade("");
              }}
            >
              <span className="review-avatar">{s.studentName[0]}</span>
              <span className="review-item-text">
                <strong>{s.studentName}</strong>
                <span>{s.sent}</span>
              </span>
              <span className={chipClass[s.status]}>{s.status}</span>
            </button>
          ))}
          {shownOnPage.length === 0 && (
            <p className="review-empty">Nobody here right now.</p>
          )}
        </div>

        <div className="review-pager">
          <span>
            {firstShown}–{lastShown} of {filtered.length}
          </span>
          <div className="review-pager-buttons">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? "review-page-current" : ""}
                aria-current={n === page ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={page === pageCount}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="review-detail-panel">
        {!selected && (
          <p className="review-empty">
            {loaded.error
              ? `Could not load your students' museums: ${loaded.error}`
              : loaded.loading
                ? "Loading your students' museums…"
                : "No museums yet. Your students' museums show here once you assign them a project."}
          </p>
        )}
        {selected && (
          <>
            <header className="review-detail-header">
              <span className="review-avatar review-avatar-large">
                {selected.studentName[0]}
              </span>
              <div>
                <h2 className="review-detail-title">
                  {firstName}'s {selected.projectName}
                </h2>
                <p className="review-detail-sub">
                  {selected.sent}
                  {selected.shareWith &&
                    ` · wants to share with: ${selected.shareWith}`}
                </p>
              </div>
              <div className="review-detail-header-end">
                {/* a published museum can go on the public sign-in page; the switch sits by the chip
                    so the layout is the same for every status, like the prototype */}
                {selected.status === "Published" && (
                  <span
                    className="review-showcase-compact"
                    title={`Anyone can see it on the sign-in page, with ${firstName}'s first name, class and school.`}
                  >
                    On sign-in page
                    <Toggle
                      checked={Boolean(selected.showcase)}
                      onChange={(on) => void toggleShowcase(selected.id, on)}
                      label="Show on the sign-in page"
                    />
                  </span>
                )}
                <span className={chipClass[selected.status]}>
                  {selected.status}
                </span>
              </div>
            </header>
            {showcaseError && (
              <p className="review-showcase-error" role="alert">
                {showcaseError}
              </p>
            )}

            <div className="review-detail-body">
              <div className="review-preview">
                <MuseumPreview title={selected.studentName} />
                <button type="button" className="review-walk">
                  Walk through it as a visitor
                </button>
              </div>

              <aside className="review-side">
                {selected.todos && (
                  <h3 className="review-label">Mission brief</h3>
                )}
                <ul className="review-todos">
                  {selected.todos?.map((todo) => (
                    <li key={todo.label} className="review-todo">
                      <span
                        className={
                          todo.done
                            ? "review-tick review-tick-done"
                            : "review-tick"
                        }
                      >
                        {todo.done && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span>{todo.label}</span>
                      {todo.count && (
                        <span className="review-todo-count">{todo.count}</span>
                      )}
                    </li>
                  ))}
                </ul>

                {selected.inside && <h3 className="review-label">Inside</h3>}
                <div className="review-tiles">
                  {selected.inside?.map((stat) => (
                    <div key={stat.label} className="review-tile">
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            <div className="review-feedback">
              <div className="review-grade">
                <label className="review-field-label" htmlFor="review-grade">
                  Grade (optional)
                </label>
                <input
                  id="review-grade"
                  className="review-input"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. A or 18/20"
                />
                <p className="review-grade-note">
                  <Lock size={13} />
                  Only {firstName}, you and VThere staff can see this.
                </p>
              </div>

              <div className="review-comment-area">
                <div className="review-comment-head">
                  <label
                    className="review-field-label"
                    htmlFor="review-comment"
                  >
                    Comment for {firstName} (optional)
                  </label>
                  <button
                    type="button"
                    className="review-save-quick"
                    disabled={!canSaveQuickComment}
                    onClick={saveQuickComment}
                  >
                    + Save as quick comment
                  </button>
                </div>
                <textarea
                  id="review-comment"
                  className="review-input review-textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment, or tap a quick comment below"
                />
                <div className="review-quick">
                  <span className="review-label">Quick comments</span>
                  {quickComments.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="review-quick-chip"
                      onClick={() => addQuickComment(text)}
                    >
                      + {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="review-actions">
              {message && (
                <span
                  className={`review-message review-message-${message.tone}`}
                >
                  {message.text}
                </span>
              )}
              <button
                type="button"
                className="review-send-back"
                onClick={() => void decide("Sent back")}
                disabled={!canDecide || deciding}
              >
                Send back with comment
              </button>
              <button
                type="button"
                className="review-approve"
                onClick={() => void decide("Published")}
                disabled={!canDecide || deciding}
              >
                Approve and publish
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
