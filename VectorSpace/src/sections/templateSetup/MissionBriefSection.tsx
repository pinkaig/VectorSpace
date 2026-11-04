/**
 * @file        MissionBriefSection.tsx
 * @project     VectorSpace
 * @author      Daniel
 * @brief       Template setup, left panel: the mission brief students see after the tutorial.
 *              The teacher edits the due date, the to-dos and the rules in plain English.
 *
 *              Beside each to-do, a chip shows what the app understood it as (parseTodo):
 *                green "5 exhibits placed"  -> it will tick itself for students
 *                green "no sounds"          -> a limit; ticked until a student breaks it
 *                amber "You tick this"      -> not understood; the teacher ticks it in review
 *              The teacher's own words are kept as typed: "Place 5 exhibits" and
 *              "Add 5 exhibits" both read as the same goal, so nothing is rewritten.
 *
 *              A second tab, "Info card tasks" (CardTasksSection, Weian Ching), sets the
 *              info cards students are asked to complete: fill in the blanks or questions.
 *
 *              The brief itself lives in the page (it is passed in and changed through
 *              onChange) so other parts of the page can read it. The page saves it, tidied by
 *              tidyBrief(), when the teacher assigns the template.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/statusChip";
import { newBriefId, type MissionBrief } from "../../mission/missionBrief";
import { describeGoal, findConflicts, parseTodo } from "../../mission/parseTodo";
import { CardTasksSection } from "./CardTasksSection";
// the text boxes use the shared .ui-input look, which lives in field.css
import "../../ui/field.css";
import "./templateSetup.css";

// the longest a due date, to-do or rule can be; the serializer refuses anything longer
const MAX_TEXT = 200;

type MissionBriefSectionProps = {
  brief: MissionBrief;
  onChange: (next: MissionBrief) => void;
  // the template's things, so an info card task can be suggested for one
  things?: { id: string; name: string; room: string }[];
};

// the two lists in a brief that are edited the same way: rows of { id, text }
type BriefListKey = "todos" | "rules";
const ID_PREFIX = { todos: "todo", rules: "rule" } as const;

type Tab = "brief" | "cards";

export function MissionBriefSection({ brief, onChange, things = [] }: MissionBriefSectionProps) {
  // the row just added, so its text box can take the cursor straight away
  const [focusId, setFocusId] = useState<string | null>(null);
  // which tab of the panel shows: the brief itself, or the info cards students complete
  const [tab, setTab] = useState<Tab>("brief");
  const taskCount = brief.cardTasks?.length ?? 0;

  // to-dos that cannot both be ticked; worked out again on every keystroke
  const clashes = findConflicts(brief.todos.map((todo) => (todo.text.trim() ? parseTodo(todo.text) : null)));
  const clashText = (index: number): string | undefined => {
    const others = clashes.get(index);
    return others?.map((other) => `"${brief.todos[other].text.trim()}"`).join(", ");
  };

  // ── adding, editing and removing rows (to-dos and rules work the same way) ──
  const addRow = (list: BriefListKey) => {
    const id = newBriefId(ID_PREFIX[list]);
    onChange({ ...brief, [list]: [...brief[list], { id, text: "" }] });
    setFocusId(id);
  };
  const editRow = (list: BriefListKey, id: string, text: string) =>
    onChange({ ...brief, [list]: brief[list].map((row) => (row.id === id ? { ...row, text } : row)) });
  const removeRow = (list: BriefListKey, id: string) =>
    onChange({ ...brief, [list]: brief[list].filter((row) => row.id !== id) });

  // Enter in a to-do or rule box starts the next one, like a list in a document
  const enterAdds = (list: BriefListKey) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addRow(list);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "brief", label: "Brief" },
    { id: "cards", label: `Info card tasks${taskCount > 0 ? ` · ${taskCount}` : ""}` },
  ];

  return (
    <section className="ui-panel setup-panel">
      <h2 className="setup-panel-title">Mission brief</h2>

      {/* TABS: the brief, or the info cards students complete */}
      <div className="brief-tabs" role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "brief-tab active" : "brief-tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "cards" ? <CardTasksSection brief={brief} onChange={onChange} things={things} /> : <>
      <p className="setup-panel-note">Students see this after the tutorial. It folds up while they work.</p>
      <label className="brief-due">{/*DUE DATE: a plain text box*/}
        <span className="brief-due-label">Due</span>
        <input className="ui-input brief-due-input" maxLength={MAX_TEXT} value={brief.due} onChange={(event) => onChange({ ...brief, due: event.target.value })} />
      </label>
      <h3 className="setup-heading">To do · ticks itself when done</h3>{/*TO DO: the teacher's words, then the chip saying what the app will count*/}
      <p className="brief-help">
        Write it your own way, e.g. "Put 5 exhibits in the room" or "No sounds". It can count
        exhibits, fact cards, sounds, reactions, rooms and zones.
      </p>
      <ul className="brief-list">
        {brief.todos.map((todo, index) => (
          <li key={todo.id} className="brief-item">
            <input
              className="ui-input brief-due-input"
              maxLength={MAX_TEXT}
              value={brief.due}
              onChange={(event) => onChange({ ...brief, due: event.target.value })}
            />
                <TodoChip text={todo.text} clashesWith={clashText(index)} />
                <button type="button" className="ui-icon-btn brief-remove" onClick={() => removeRow("todos", todo.id)}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="add" size="small" className="brief-add" onClick={() => addRow("todos")}>+ Add a to-do</Button>

          {/* RULES: free text; students read these, nothing checks them */}
          <h3 className="setup-heading">Rules</h3>
          <ul className="brief-list">
            {brief.rules.map((rule) => (
              <li key={rule.id} className="brief-item">
                <input
                  className="ui-input brief-input"
                  placeholder="e.g. Keep everything school-appropriate"
                  maxLength={MAX_TEXT}
                  value={rule.text}
                  autoFocus={rule.id === focusId}
                  onChange={(event) => editRow("rules", rule.id, event.target.value)}
                  onKeyDown={enterAdds("rules")}
                />
                <button type="button" className="ui-icon-btn brief-remove" onClick={() => removeRow("rules", rule.id)}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="add" size="small" className="brief-add" onClick={() => addRow("rules")}>+ Add a rule</Button>
        </>
      }
    </section>
  );
}

// what the app understood one to-do as; worked out again on every keystroke
// clashesWith: the other to-dos it cannot be ticked alongside, when there are any
function TodoChip({ text, clashesWith }: { text: string; clashesWith?: string }) {
  if (text.trim() === "") return null;
  if (clashesWith) {
    return (
      <span
        className="brief-chip"
        title={`Students can't tick this at the same time as ${clashesWith}. They'll still see both; change one if both should be done.`}
      >
        <StatusChip tone="red">Clashes with {clashesWith}</StatusChip>
      </span>
    );
  }
  const goal = parseTodo(text);
  if (!goal) {
    return (
      <span className="brief-chip" title="The app can't count this one, so it won't tick itself. You tick it when you review.">
        <StatusChip tone="amber">You tick this</StatusChip>
      </span>
    );
  }
  const counted = describeGoal(goal);
  return (
    <span className="brief-chip" title={`Checked automatically for students: ${counted}`}>
      <StatusChip tone="green">{counted}</StatusChip>
    </span>
  );
}
