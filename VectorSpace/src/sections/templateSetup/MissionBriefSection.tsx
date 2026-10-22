/**
 * @file        MissionBriefSection.tsx
 * @project     VectorSpace
 * @author      <your name>
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
 *              The brief itself lives in the page (it is passed in and changed through
 *              onChange) so other parts of the page can read it. NOT SAVED YET: nothing is
 *              sent to the API.
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
import { describeGoal, parseTodo } from "../../mission/parseTodo";
// the text boxes use the shared .ui-input look, which lives in field.css
import "../../ui/field.css";
import "./templateSetup.css";

// the longest a due date, to-do or rule can be; the serializer refuses anything longer
const MAX_TEXT = 200;

type MissionBriefSectionProps = {
  brief: MissionBrief;
  onChange: (next: MissionBrief) => void;
};

export function MissionBriefSection({ brief, onChange }: MissionBriefSectionProps) {
  // the row just added, so its text box can take the cursor straight away
  const [focusId, setFocusId] = useState<string | null>(null);

  // ── to-dos ──
  const addTodo = () => {
    const id = newBriefId("todo");
    onChange({ ...brief, todos: [...brief.todos, { id, text: "" }] });
    setFocusId(id);
  };
  const editTodo = (id: string, text: string) =>
    onChange({ ...brief, todos: brief.todos.map((todo) => (todo.id === id ? { ...todo, text } : todo)) });
  const removeTodo = (id: string) => onChange({ ...brief, todos: brief.todos.filter((todo) => todo.id !== id) });

  // ── rules ──
  const addRule = () => {
    const id = newBriefId("rule");
    onChange({ ...brief, rules: [...brief.rules, { id, text: "" }] });
    setFocusId(id);
  };
  const editRule = (id: string, text: string) =>
    onChange({ ...brief, rules: brief.rules.map((rule) => (rule.id === id ? { ...rule, text } : rule)) });
  const removeRule = (id: string) => onChange({ ...brief, rules: brief.rules.filter((rule) => rule.id !== id) });

  // Enter in a to-do or rule box starts the next one, like a list in a document
  const enterAdds = (add: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  return (
    <section className="setup-panel">
      {/*TITLE*/}
      <h2 className="setup-panel-title">Mission brief</h2>
      <p className="setup-panel-note">Students see this after the tutorial. It folds up while they work.</p>

      {/*DUE DATE: a plain text box for now, a date picker later*/}
      <label className="brief-due">
        <span className="brief-due-label">Due</span>
        <input className="ui-input brief-due-input" maxLength={MAX_TEXT} value={brief.due} onChange={(event) => onChange({ ...brief, due: event.target.value })} />
      </label>

      {/*TO DO: the teacher's words, then the chip saying what the app will count*/}
      <h3 className="setup-heading">To do · ticks itself when done</h3>
      <p className="brief-help">
        Write it your own way, e.g. "Put 5 exhibits in the room" or "No sounds". It can count
        exhibits, fact cards, sounds, reactions, rooms and zones.
      </p>
      <ul className="brief-list">
        {brief.todos.map((todo, index) => (
          <li key={todo.id} className="brief-item">
            <input
              className="ui-input brief-input brief-input-bold"
              aria-label={`To-do ${index + 1}`}
              placeholder="e.g. Place 3 exhibits"
              maxLength={MAX_TEXT}
              value={todo.text}
              autoFocus={todo.id === focusId}
              onChange={(event) => editTodo(todo.id, event.target.value)}
              onKeyDown={enterAdds(addTodo)}
            />
            <TodoChip text={todo.text} />
            <button type="button" className="brief-remove" aria-label={`Remove to-do ${index + 1}`} onClick={() => removeTodo(todo.id)}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="add" size="small" className="brief-add" onClick={addTodo}>+ Add a to-do</Button>

      {/*RULES: free text; students read these, nothing checks them*/}
      <h3 className="setup-heading">Rules</h3>
      <ul className="brief-list">
        {brief.rules.map((rule, index) => (
          <li key={rule.id} className="brief-item">
            <input
              className="ui-input brief-input"
              aria-label={`Rule ${index + 1}`}
              placeholder="e.g. Keep everything school-appropriate"
              maxLength={MAX_TEXT}
              value={rule.text}
              autoFocus={rule.id === focusId}
              onChange={(event) => editRule(rule.id, event.target.value)}
              onKeyDown={enterAdds(addRule)}
            />
            <button type="button" className="brief-remove" aria-label={`Remove rule ${index + 1}`} onClick={() => removeRule(rule.id)}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="add" size="small" className="brief-add" onClick={addRule}>+ Add a rule</Button>
    </section>
  );
}

// what the app understood one to-do as; worked out again on every keystroke
function TodoChip({ text }: { text: string }) {
  if (text.trim() === "") return null;
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
