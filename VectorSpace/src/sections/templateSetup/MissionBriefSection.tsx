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
 *              A second tab, "Info card tasks" (CardTasksSection, Weian Ching), sets the
 *              info cards students are asked to complete: fill in the blanks or questions.
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

export function MissionBriefSection({ brief, onChange, things = [] }: MissionBriefSectionProps) {
  // the row just added, so its text box can take the cursor straight away
  const [focusId, setFocusId] = useState<string | null>(null);
  // which tab of the panel shows: the brief itself, or the info cards students complete
  const [tab, setTab] = useState<"brief" | "cards">("brief");
  const taskCount = brief.cardTasks?.length ?? 0;

  // to-dos that cannot both be ticked; worked out again on every keystroke
  const clashes = findConflicts(brief.todos.map((todo) => (todo.text.trim() ? parseTodo(todo.text) : null)));
  const clashText = (index: number): string | undefined => {
    const others = clashes.get(index);
    return others?.map((other) => `"${brief.todos[other].text.trim()}"`).join(", ");
  };

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
      <h2 className="setup-panel-title">Mission brief</h2>{/*TITLE*/}
      <div className="brief-tabs" role="tablist">{/*TABS: the brief, or the info cards students complete*/}
        <button type="button" role="tab" aria-selected={tab === "brief"} className={tab === "brief" ? "brief-tab active" : "brief-tab"} onClick={() => setTab("brief")}>
          Brief
        </button>
        <button type="button" role="tab" aria-selected={tab === "cards"} className={tab === "cards" ? "brief-tab active" : "brief-tab"} onClick={() => setTab("cards")}>
          Info card tasks{taskCount > 0 ? ` · ${taskCount}` : ""}
        </button>
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
              className="ui-input brief-input brief-input-bold"
              placeholder="e.g. Place 3 exhibits"
              maxLength={MAX_TEXT}
              value={todo.text}
              autoFocus={todo.id === focusId}
              onChange={(event) => editTodo(todo.id, event.target.value)}
              onKeyDown={enterAdds(addTodo)}
            />
            <TodoChip text={todo.text} clashesWith={clashText(index)} />
            <button type="button" className="brief-remove" onClick={() => removeTodo(todo.id)}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="add" size="small" className="brief-add" onClick={addTodo}>+ Add a to-do</Button>
      <h3 className="setup-heading">Rules</h3>{/*RULES: free text; students read these, nothing checks them*/}
      <ul className="brief-list">
        {brief.rules.map((rule, index) => (
          <li key={rule.id} className="brief-item">
            <input
              className="ui-input brief-input"
              placeholder="e.g. Keep everything school-appropriate"
              maxLength={MAX_TEXT}
              value={rule.text}
              autoFocus={rule.id === focusId}
              onChange={(event) => editRule(rule.id, event.target.value)}
              onKeyDown={enterAdds(addRule)}
            />
            <button type="button" className="brief-remove" onClick={() => removeRule(rule.id)}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="add" size="small" className="brief-add" onClick={addRule}>+ Add a rule</Button>
      </>}
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
