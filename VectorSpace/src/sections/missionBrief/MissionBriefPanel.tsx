/**
 * @file        MissionBriefPanel.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       The mission brief as students see it in the editor: floats over the top-left of
 *              the room, under the Select / Move tools. Two looks:
 *                open:   the full card (to-dos, rules, "Got it, let's build")
 *                folded: a slim tab with one bar per to-do and "2 of 4 done"; click to open
 *              It starts open, and "Got it, let's build" folds it so it is out of the way.
 *
 *              The to-dos TICK THEMSELVES: each one's text is read by parseTodo and counted
 *              against the live project by checkGoal, so placing an exhibit updates it at once.
 *              A to-do parseTodo cannot read shows a dashed box: the teacher ticks it in review.
 *
 *              The brief comes from project.missionBrief, which the teacher's template setup
 *              page writes. With no brief (or an empty one) nothing is shown.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Check, ChevronDown, ClipboardList } from "lucide-react";
import type { ProjectData } from "../../project/model";
import type { MissionBrief } from "../../mission/missionBrief";
import { parseTodo } from "../../mission/parseTodo";
import { checkGoal, progressLabel, type GoalProgress } from "../../mission/checkTodo";
import "./missionBriefPanel.css";

type MissionBriefPanelProps = {
  brief: MissionBrief;
  // the project being built, which the to-dos are counted against
  project: ProjectData;
};

// one to-do, worked out: its text, and how far along it is (null = the teacher ticks it)
type TodoState = { id: string; text: string; progress: GoalProgress | null };

export function MissionBriefPanel({ brief, project }: MissionBriefPanelProps) {
  const [open, setOpen] = useState(true);

  // worked out again on every render, so the ticks follow the student's edits
  const todos: TodoState[] = brief.todos.map((todo) => {
    const goal = parseTodo(todo.text);
    return { id: todo.id, text: todo.text, progress: goal ? checkGoal(goal, project) : null };
  });
  const doneCount = todos.filter((todo) => todo.progress?.complete).length;
  const doneText = `${doneCount} of ${todos.length} done`;

  if (todos.length === 0 && brief.rules.length === 0) return null;

  // ── FOLDED: a tab to open it again ──
  if (!open) {
    return (
      <button type="button" className="mb-tab" onClick={() => setOpen(true)}>
        <ClipboardList size={20} className="mb-tab-icon" />
        <span className="mb-tab-title">Mission brief</span>
        <span className="mb-bars">{/*one bar per to-do, green when done*/}
          {todos.map((todo) => <span key={todo.id} className={`mb-bar ${todo.progress?.complete ? "mb-bar-done" : ""}`} />)}
        </span>
        <span className="mb-tab-done">{doneText}</span>
        <ChevronDown size={16} />
      </button>
    );
  }

  // ── OPEN: the whole brief ──
  return (
    <section className="mb-card">
      <div className="mb-head">{/*TITLE: icon, name, due date, progress*/}
        <div className="mb-head-icon"><ClipboardList size={22} /></div>
        <div className="mb-head-text">
          <h2 className="mb-title">Mission brief</h2>
          {brief.due && <p className="mb-due">Due {brief.due}</p>}
        </div>
        <span className="mb-done-chip">{doneText}</span>
      </div>
      {/*TO DO: tick, text, count*/}
      {todos.length > 0 && (
        <>
          <h3 className="mb-heading">To do</h3>
          <ul className="mb-todos">
            {todos.map((todo) => <TodoRow key={todo.id} todo={todo} />)}
          </ul>
        </>
      )}
      {/*RULES: just read, nothing checks them*/}
      {brief.rules.length > 0 && (
        <>
          <h3 className="mb-heading">Rules</h3>
          <ul className="mb-rules">
            {brief.rules.map((rule) => <li key={rule.id}>{rule.text}</li>)}
          </ul>
        </>
      )}

      <button type="button" className="mb-fold" onClick={() => setOpen(false)}>Got it, let's build</button>
    </section>
  );
}

function TodoRow({ todo }: { todo: TodoState }) {
  // the teacher ticks this one: a dashed box and a note instead of a count
  if (!todo.progress) {
    return (
      <li className="mb-todo">
        <span className="mb-tick mb-tick-teacher" />
        <span className="mb-todo-text">{todo.text}</span>
        <span className="mb-todo-count">teacher</span>
      </li>
    );
  }
  const { complete } = todo.progress;
  return (
    <li className={`mb-todo ${complete ? "mb-todo-done" : ""}`}>
      <span className={`mb-tick ${complete ? "mb-tick-done" : ""}`}>
        {complete && <Check size={14} strokeWidth={3.5} />}
      </span>
      <span className="mb-todo-text">{todo.text}</span>
      <span className="mb-todo-count">{progressLabel(todo.progress)}</span>
    </li>
  );
}
