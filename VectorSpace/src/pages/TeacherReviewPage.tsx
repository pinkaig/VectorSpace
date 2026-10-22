/**
 * @file        TeacherReviewPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Review tab: the class's submissions on the left and
 *              the selected museum on the right, with Approve and publish or
 *              Send back with comment. Shown inside TeacherLayout. Uses fake
 *              data until the backend has submissions.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Check } from "lucide-react";
import { MuseumPreview } from "../ui/museumPreview";
import "./TeacherReviewPage.css";

type Status = "Waiting" | "Published" | "Sent back";

type Submission = {
  id: string;
  studentName: string;
  sent: string;
  status: Status;
};

// Fake data until the backend has submissions and their statuses.
const startingSubmissions: Submission[] = [
  { id: "s1", studentName: "Aisyah Rahman", sent: "Sent 2 hours ago", status: "Waiting" },
  { id: "s2", studentName: "Daniel Koh", sent: "Sent 3 hours ago", status: "Waiting" },
  { id: "s3", studentName: "Priya Nair", sent: "Sent yesterday", status: "Waiting" },
  { id: "s4", studentName: "Jun Wei Tan", sent: "Sent yesterday", status: "Waiting" },
  { id: "s5", studentName: "Nur Aina", sent: "Sent 2 days ago", status: "Waiting" },
  { id: "s6", studentName: "Sofia Lim", sent: "Sent 2 days ago", status: "Waiting" },
  { id: "s7", studentName: "Marcus Lee", sent: "Sent 3 days ago", status: "Published" },
  { id: "s8", studentName: "Ethan Wong", sent: "Sent 4 days ago", status: "Sent back" },
];

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

// chip colour per status, from the manual: amber = waiting, green = done, red = sent back
const chipClass: Record<Status, string> = {
  Waiting: "review-chip review-chip-amber",
  Published: "review-chip review-chip-green",
  "Sent back": "review-chip review-chip-red",
};

export default function TeacherReviewPage() {
  const [submissions, setSubmissions] = useState(startingSubmissions);
  const [selectedId, setSelectedId] = useState(startingSubmissions[0].id);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "green" | "red" } | null>(null);

  const selected = submissions.find((s) => s.id === selectedId);
  const firstName = selected ? selected.studentName.split(" ")[0] : "";

  // changes the selected student's status and shows what happened
  const decide = (status: "Published" | "Sent back") => {
    if (!selected) return;

    setSubmissions((current) =>
      current.map((s) => (s.id === selectedId ? { ...s, status } : s)),
    );
    setMessage(
      status === "Published"
        ? { text: `Published. ${firstName} gets a link to share.`, tone: "green" }
        : { text: `Sent back. ${firstName} will see your comment in the Mission brief.`, tone: "red" },
    );
    setComment("");
  };

  return (
    <main className="review">
      <section className="review-list-panel">
        <h1 className="review-list-title">Class 2B · Dinosaur museum</h1>
        <p className="review-list-sub">Students send their museum here before it goes live.</p>

        <div className="review-list">
          {submissions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === selectedId ? "review-item review-item-selected" : "review-item"}
              onClick={() => {
                setSelectedId(s.id);
                setMessage(null);
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
        </div>
      </section>

      <section className="review-detail-panel">
        {selected && (
          <>
            <header className="review-detail-header">
              <span className="review-avatar review-avatar-large">{selected.studentName[0]}</span>
              <div>
                <h2 className="review-detail-title">{firstName}'s Dinosaur museum</h2>
                <p className="review-detail-sub">
                  {selected.sent} · wants to share with: {shareWith}
                </p>
              </div>
              <span className={chipClass[selected.status]}>{selected.status}</span>
            </header>

            <div className="review-detail-body">
              <div className="review-preview">
                <MuseumPreview title={selected.studentName} />
                <button type="button" className="review-walk">Walk through it as a visitor</button>
              </div>

              <aside className="review-side">
                <h3 className="review-label">Mission brief</h3>
                <ul className="review-todos">
                  {missionTodos.map((todo) => (
                    <li key={todo.label} className="review-todo">
                      <span className={todo.done ? "review-tick review-tick-done" : "review-tick"}>
                        {todo.done && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span>{todo.label}</span>
                      {todo.count && <span className="review-todo-count">{todo.count}</span>}
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

            <label className="review-comment">
              <span>Comment for {firstName} (optional)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Great facts! Can you add a picture to the T-rex card?"
              />
            </label>

            <div className="review-actions">
              {message && (
                <span className={`review-message review-message-${message.tone}`}>{message.text}</span>
              )}
              <button type="button" className="review-send-back" onClick={() => decide("Sent back")}>
                Send back with comment
              </button>
              <button type="button" className="review-approve" onClick={() => decide("Published")}>
                Approve and publish
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}