/**
 * @file        TeacherReviewPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Review tab: every student in the class with status
 *              tabs and pages of 8 on the left; the selected museum on the
 *              right with grade, comment, quick comments, and Approve and
 *              publish or Send back. Shown inside TeacherLayout. Uses fake
 *              data until the backend has submissions.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { MuseumPreview } from "../ui/museumPreview";
import "./TeacherReviewPage.css";

type Status =
  | "Waiting"
  | "Published"
  | "Sent back"
  | "Building"
  | "Not started";

type Submission = {
  id: string;
  studentName: string;
  sent: string;
  status: Status;
};

// Fake data until the backend has submissions: the whole class, 24 students.
const studentNames = [
  "Aisyah Rahman",
  "Daniel Koh",
  "Priya Nair",
  "Jun Wei Tan",
  "Nur Aina",
  "Sofia Lim",
  "Marcus Lee",
  "Ethan Wong",
  "Kai Chen",
  "Ryan Teo",
  "Mei Ling",
  "Hana Yusof",
  "Arjun Pillai",
  "Chloe Ng",
  "Farah Ismail",
  "Ivan Lim",
  "Jasmine Goh",
  "Lucas Tay",
  "Nadia Hassan",
  "Oliver Seah",
  "Rachel Ong",
  "Siti Nur",
  "Tom Lee",
  "Zara Khan",
];
const firstEightSent = [
  "Sent 2 hours ago",
  "Sent 3 hours ago",
  "Sent yesterday",
  "Sent yesterday",
  "Sent 2 days ago",
  "Sent 2 days ago",
  "Sent 3 days ago",
  "Sent 4 days ago",
];

// the teacher's saved quick comments; fake until they're stored per teacher
const startingQuickComments = [
  "Great facts!",
  "Add a picture to each card",
  "Check your spelling",
  "Add a reaction to more exhibits",
];

// 6 waiting, 1 published, 1 sent back, 13 building, 3 not started
const statusFor = (i: number): Status =>
  i < 6
    ? "Waiting"
    : i === 6
      ? "Published"
      : i === 7
        ? "Sent back"
        : i < 21
          ? "Building"
          : "Not started";

const startingSubmissions: Submission[] = studentNames.map(
  (studentName, i) => ({
    id: `s${i + 1}`,
    studentName,
    status: statusFor(i),
    sent:
      firstEightSent[i] ??
      (statusFor(i) === "Building" ? "Edited today" : "Not opened yet"),
  }),
);

// The same for every student until the backend has real counts.
const shareWith = "Anyone with the link";

const missionTodos = [
  { label: "Place 3 exhibits", count: "4/3", done: true },
  { label: "Give each exhibit a fact card", count: "3/3", done: true },
  { label: "Add one reaction", done: true },
  { label: "Add a second room", done: true },
];

const insideStats = [
  { value: 4, label: "exhibits" },
  { value: 3, label: "fact cards" },
  { value: 2, label: "reactions" },
  { value: 2, label: "rooms" },
];

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
  const [submissions, setSubmissions] = useState(startingSubmissions);
  const [selectedId, setSelectedId] = useState(startingSubmissions[0].id);
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

  // changes the selected student's status and shows what happened
  const decide = (status: "Published" | "Sent back") => {
    if (!selected) return;

    setSubmissions((current) =>
      current.map((s) => (s.id === selectedId ? { ...s, status } : s)),
    );
    setMessage(
      status === "Published"
        ? { text: `Published · ${firstName} has been notified`, tone: "green" }
        : { text: `Sent back · ${firstName} has been notified`, tone: "red" },
    );
    setComment("");
    setGrade("");
  };

  return (
    <main className="review">
      <section className="review-list-panel">
        <h1 className="review-list-title">Class 2B · Dinosaur museum</h1>
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
        {selected && (
          <>
            <header className="review-detail-header">
              <span className="review-avatar review-avatar-large">
                {selected.studentName[0]}
              </span>
              <div>
                <h2 className="review-detail-title">
                  {firstName}'s Dinosaur museum
                </h2>
                <p className="review-detail-sub">
                  {selected.sent} · wants to share with: {shareWith}
                </p>
              </div>
              <span className={chipClass[selected.status]}>
                {selected.status}
              </span>
            </header>

            <div className="review-detail-body">
              <div className="review-preview">
                <MuseumPreview title={selected.studentName} />
                <button type="button" className="review-walk">
                  Walk through it as a visitor
                </button>
              </div>

              <aside className="review-side">
                <h3 className="review-label">Mission brief</h3>
                <ul className="review-todos">
                  {missionTodos.map((todo) => (
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

                <h3 className="review-label">Inside</h3>
                <div className="review-tiles">
                  {insideStats.map((stat) => (
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
                onClick={() => decide("Sent back")}
                disabled={!canDecide}
              >
                Send back with comment
              </button>
              <button
                type="button"
                className="review-approve"
                onClick={() => decide("Published")}
                disabled={!canDecide}
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
