/**
 * @file        ProjectDetailsSection.tsx
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Template setup, right panel: a summary box (class, due date, template, Room 1),
 *              switches for what students cannot change, the room types students can add, and
 *              which asset catalogues the project uses. The room types are saved with the
 *              project (validateEnvironment) and limit the editor's "What kind of room?".
 *              The catalogue lists the asset packs the admin has published and switched on
 *              for this school (GET /packs/mine).
 *              DRAWN ONLY: the template name, the lock switches and which catalogue chips are
 *              picked flip on screen but nothing is saved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Toggle } from "../../ui/toggle";
import { environmentLibrary, type ProjectData } from "../../project/model";
import { studentRoomEnv } from "../../editor/roomLayout";
import { apiUrl } from "../../api/client";
import { createLibraryApi, type MyPack } from "../../api/library";
import { useLoad } from "../../api/useLoad";
import { useSession } from "../../session/session";
import "./templateSetup.css";

// SAMPLE DATA: the template name and locks shown in this panel
const SAMPLE_TEMPLATE = "Museum template";
const SAMPLE_LOCKS = [
  { id: "walls", name: "Walls and floor", on: true },
  { id: "entrance", name: "Entrance door", on: true },
  { id: "spots", name: "Suggested spots", on: false },
];

type ProjectDetailsSectionProps = {
  className: string;
  // from the mission brief, so changing it there changes it here too
  due: string;
  // the page's copy of the editor draft: its validateEnvironment are the room types students can add
  draft: ProjectData;
  onChange: (next: ProjectData) => void;
};

export function ProjectDetailsSection({ className, due, draft, onChange }: ProjectDetailsSectionProps) {
  const allowed = new Set(studentRoomEnv(draft).map((env) => env.id));
  const flipRoomKind = (id: string) => {
    const next = new Set(allowed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...draft, validateEnvironment: environmentLibrary.filter((env) => next.has(env.id)).map((env) => env.id) });
  };
  const firstRoomKind = environmentLibrary.find((env) => env.id === draft.scenes[0]?.environmentId)?.name;

  // kept on this screen only, so the switches and chips respond when clicked
  const [locks, setLocks] = useState(SAMPLE_LOCKS);
  // the school's packs come from the API; which ones this project uses is not saved yet, so
  // every pack starts picked and a click only changes this screen
  const { getToken } = useSession();
  const library = useMemo(() => createLibraryApi(getToken), [getToken]);
  const packs = useLoad<MyPack[]>(() => (apiUrl ? library.myPacks() : Promise.resolve([])), "my-packs");
  const [unpicked, setUnpicked] = useState<Set<string>>(new Set());

  const flipLock = (id: string, on: boolean) =>
    setLocks((list) => list.map((lock) => (lock.id === id ? { ...lock, on } : lock)));
  const flipCatalogue = (slug: string) =>
    setUnpicked((set) => {
      const next = new Set(set);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <section className="ui-panel setup-panel">
      <h2 className="setup-panel-title">Project details</h2>
      <dl className="details-summary">{/*SUMMARY: label on the left, value on the right*/}
        <div>
          <dt>Class</dt>
          <dd>{className}</dd>
        </div>
        <div><dt>Due</dt><dd>{due || "Not set"}</dd></div>
        <div><dt>Template</dt><dd>{SAMPLE_TEMPLATE}</dd></div>
        {firstRoomKind && <div><dt>Room 1</dt><dd>{firstRoomKind}</dd></div>}
      </dl>
      <h3 className="setup-heading">Locked for students</h3>{/*LOCKED FOR STUDENTS: name on the left, switch (with On / Off) on the right*/}
      <ul className="details-locks">
        {locks.map((lock) => (
          <li key={lock.id} className="details-lock">
            <span className="details-lock-name">{lock.name}</span>
            <Toggle checked={lock.on} label={`Lock ${lock.name} for students`} onChange={(on) => flipLock(lock.id, on)} />
          </li>
        ))}
      </ul>
      <h3 className="setup-heading">Room types students can add</h3>{/*ROOM TYPES: picked (dark, with a tick) or not (dashed); saved with the project*/}
      <div className="details-catalogues" role="group" aria-label="Room types students can add">
        {environmentLibrary.map((env) => {
          const on = allowed.has(env.id);
          return (
            <button
              key={env.id}
              type="button"
              aria-pressed={on}
              className={`details-catalogue ${on ? "details-catalogue-on" : "details-roomkind-off"}`}
              onClick={() => flipRoomKind(env.id)}
            >
              {on && <Check size={14} strokeWidth={3} />}
              {env.name}
            </button>
          );
        })}
      </div>
      <p className="details-roomkind-note">
        {allowed.size === 0 ? "Students can't add rooms: they build in the rooms you made." : "Students pick from these when they add a room."}
      </p>
      <h3 className="setup-heading">Catalogue for this project</h3>{/*CATALOGUE: chips that are picked (dark, with a tick) or not (white)*/}
      <div className="details-catalogues">
        {packs.data?.map((pack) => {
          const on = !unpicked.has(pack.slug);
          return (
            <button
              key={pack.slug}
              type="button"
              aria-pressed={on}
              title={`${pack.itemCount} ${pack.itemCount === 1 ? "item" : "items"}${pack.description ? `: ${pack.description}` : ""}`}
              className={`details-catalogue ${on ? "details-catalogue-on" : ""}`}
              onClick={() => flipCatalogue(pack.slug)}
            >
              {on && <Check size={14} strokeWidth={3} />}
              {pack.title}
            </button>
          );
        })}
      </div>
      <p className="details-roomkind-note">
        {packs.error
          ? `Could not load your school's packs: ${packs.error}`
          : packs.loading
            ? "Loading your school's packs…"
            : packs.data?.length
              ? "Asset packs your admin has switched on for this school."
              : "No asset packs are switched on for this school yet. Your admin turns them on in Rooms & assets."}
      </p>
    </section>
  );
}
