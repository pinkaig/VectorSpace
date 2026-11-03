/**
 * @file        CardTasksSection.tsx
 * @project     VectorSpace
 * @author      Weian Ching
 * @brief       Template setup, mission brief panel, "Info card tasks" tab: the info
 *              cards the teacher wants students to complete. Each task is either
 *                fill in the blanks: a passage with [blanks] the student fills in, or
 *                questions: pointers the student answers, one box each.
 *
 *              The tasks are part of the mission brief (brief.cardTasks), so they are
 *              saved and assigned with it. In the editor, a student starts a fact card
 *              from one of these and fills it in (sections/objectPanel/InfoCardSection).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../ui/button";
import type { CardTask, MissionBrief } from "../../mission/missionBrief";
import { blankCount, blanksText, newTaskId, parseBlanks } from "../../mission/cardTasks";
import "../../ui/field.css";
import "./cardTasks.css";

const MAX_TEXT = 200;
const MAX_PASSAGE = 1000;
const MAX_TASKS = 20;

type Thing = { id: string; name: string; room: string };

type CardTasksSectionProps = {
  brief: MissionBrief;
  onChange: (next: MissionBrief) => void;
  things: Thing[];
};

// what a new task starts as, so the teacher sees how each kind works
const starter = (kind: CardTask["kind"]): CardTask =>
  kind === "blanks"
    ? { id: newTaskId(), title: "", kind, fields: parseBlanks("This exhibit is a [what is it?]. It comes from [where?].") }
    : { id: newTaskId(), title: "", kind, fields: [{ key: "q0", label: "What is it?" }, { key: "q1", label: "Why is it important?" }] };

export function CardTasksSection({ brief, onChange, things }: CardTasksSectionProps) {
  const tasks = brief.cardTasks ?? [];
  const setTasks = (next: CardTask[]) => onChange({ ...brief, cardTasks: next });
  // the task just added: it asks straight away which thing the card is for
  const [askingFor, setAskingFor] = useState<string | null>(null);
  const addTask = (kind: CardTask["kind"]) => {
    const task = starter(kind);
    setTasks([...tasks, task]);
    setAskingFor(task.id);
  };
  const update = (id: string, change: Partial<CardTask>) => setTasks(tasks.map((task) => (task.id === id ? { ...task, ...change } : task)));
  const remove = (id: string) => setTasks(tasks.filter((task) => task.id !== id));

  return (
    <>
      <p className="setup-panel-note">
        Info cards you want students to write. Each student starts a fact card from one of these and fills it in.
      </p>
      {tasks.length === 0 && <p className="tasks-empty">No info card tasks yet. Add one below.</p>}
      <ol className="tasks-list">
        {tasks.map((task, index) => (
          <li key={task.id} className="task-card">
            <div className="task-head">
              <span className="task-num">{index + 1}</span>
              <input
                className="ui-input task-title"
                aria-label={`Task ${index + 1} title`}
                placeholder="Card title, e.g. Meet the T-rex"
                maxLength={MAX_TEXT}
                value={task.title}
                onChange={(event) => update(task.id, { title: event.target.value })}
              />
              <button type="button" className="brief-remove" aria-label={`Remove task ${index + 1}`} onClick={() => remove(task.id)}>
                <X size={16} />
              </button>
            </div>
            <div className="task-kind" role="radiogroup" aria-label={`Task ${index + 1} kind`}>
              {(["blanks", "prompts"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={task.kind === kind}
                  className={task.kind === kind ? "task-kind-option on" : "task-kind-option"}
                  onClick={() => task.kind !== kind && update(task.id, { kind, fields: starter(kind).fields })}
                >
                  {kind === "blanks" ? "Fill in the blanks" : "Questions to answer"}
                </button>
              ))}
            </div>
            {task.kind === "blanks" ? <BlanksEditor task={task} onFields={(fields) => update(task.id, { fields })} /> : <PromptsEditor task={task} onFields={(fields) => update(task.id, { fields })} />}
            <SuggestFor
              task={task}
              things={things}
              asking={askingFor === task.id}
              onPick={(objectId) => { update(task.id, { objectId }); setAskingFor(null); }}
              onSkip={() => setAskingFor(null)}
            />
          </li>
        ))}
      </ol>
      {tasks.length < MAX_TASKS && (
        <div className="tasks-add">
          <Button variant="add" size="small" onClick={() => addTask("blanks")}>+ Fill in the blanks</Button>
          <Button variant="add" size="small" onClick={() => addTask("prompts")}>+ Questions to answer</Button>
        </div>
      )}
    </>
  );
}

// the passage as typed, with [ ] for each blank; a preview shows what students get
function BlanksEditor({ task, onFields }: { task: CardTask; onFields: (fields: CardTask["fields"]) => void }) {
  const blanks = blankCount(task.fields);
  return (
    <>
      <textarea
        className="ui-input task-passage"
        aria-label="Passage with blanks"
        rows={3}
        maxLength={MAX_PASSAGE}
        value={blanksText(task.fields)}
        onChange={(event) => onFields(parseBlanks(event.target.value))}
      />
      <p className="brief-help">Put [square brackets] where students fill in. Words inside become a hint, e.g. [how long ago?].</p>
      <div className="task-preview" aria-label="What students see">
        <span className="task-preview-label">Students see · {blanks} {blanks === 1 ? "blank" : "blanks"}</span>
        <p>
          {task.fields.map((field) =>
            field.locked ? <span key={field.key}>{field.label}</span> : <span key={field.key} className="task-blank">{field.prompt ?? " "}</span>,
          )}
        </p>
      </div>
    </>
  );
}

// one row per pointer or question, like the to-do list
function PromptsEditor({ task, onFields }: { task: CardTask; onFields: (fields: CardTask["fields"]) => void }) {
  const edit = (key: string, label: string) => onFields(task.fields.map((field) => (field.key === key ? { ...field, label } : field)));
  const add = () => onFields([...task.fields, { key: `q${Date.now().toString(36)}`, label: "" }]);
  return (
    <>
      <ul className="brief-list">
        {task.fields.map((field, index) => (
          <li key={field.key} className="brief-item">
            <input
              className="ui-input brief-input"
              aria-label={`Question ${index + 1}`}
              placeholder="e.g. What did it eat?"
              maxLength={MAX_TEXT}
              value={field.label}
              onChange={(event) => edit(field.key, event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
            />
            <button type="button" className="brief-remove" aria-label={`Remove question ${index + 1}`} onClick={() => onFields(task.fields.filter((item) => item.key !== field.key))}>
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="add" size="small" className="brief-add" onClick={add}>+ Add a question</Button>
    </>
  );
}

// Which thing the card is for. A new task asks it as a question; after that it is a plain
// "Suggested for" choice. Students see a suggested card first when they pick that thing.
function SuggestFor({ task, things, asking, onPick, onSkip }: {
  task: CardTask;
  things: Thing[];
  asking: boolean;
  onPick: (objectId: string | undefined) => void;
  onSkip: () => void;
}) {
  const known = things.some((thing) => thing.id === task.objectId);
  if (things.length === 0) {
    return asking ? <p className="task-suggest-note">Add starter things with Edit room to suggest which thing this card is for.</p> : null;
  }
  const picker = (
    <select
      className="ui-input task-suggest-select"
      aria-label="Suggested for"
      value={known ? task.objectId : ""}
      onChange={(event) => onPick(event.target.value || undefined)}
    >
      <option value="">Any thing (student picks)</option>
      {things.map((thing) => <option key={thing.id} value={thing.id}>{thing.name} · {thing.room}</option>)}
    </select>
  );
  if (asking) {
    return (
      <div className="task-suggest ask" role="group" aria-label="Suggest a thing for this card">
        <span className="task-suggest-q">Suggest this card for a thing in the room?</span>
        {picker}
        <button type="button" className="task-suggest-skip" onClick={onSkip}>Not now</button>
      </div>
    );
  }
  return (
    <label className="task-suggest">
      <span className="task-suggest-q">Suggested for</span>
      {picker}
    </label>
  );
}
