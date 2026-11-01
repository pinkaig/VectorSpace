/**
 * @file        SetupViewportSection.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @author      Daniel Tee
 * @brief       Template setup, middle panel: a preview of the room, with an "Edit room" button,
 *              over "Rooms every student starts with".
 *              The room is never edited on this page. Editing it (and the teacher tools: suggest
 *              a spot, lock things, add a starter object) belongs in the editor at
 *              /editor/:projectId, in a teacher mode, so there is only one place a scene can
 *              be changed (see docs/handover/project-templates.md, section 8.4).
 *              The preview is the editor's own viewport, look-only: drag to orbit, scroll to
 *              zoom, nothing can be selected or moved. "Edit room" opens the no-logic popup.
 *
 *              ROOMS: the template's rooms, in visit order. Room 1 is where students start and
 *              can't be removed; click a room to preview it. "+ Add room" asks where (the same
 *              five-cell map students use in the editor, see editor/roomLayout.ts), then which
 *              environment (environmentLibrary). The room in the preview can be renamed (the
 *              pencil) and moved to another environment (the Environment picker), Room 1 too.
 *              The rooms live on the page's copy of the editor draft and are saved with the
 *              brief when the teacher presses Assign.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { environmentLibrary, makeScene, type EnvironmentDefinition, type ProjectData, type RoomCell } from "../../project/model";
import { createEditorScene, removeEditorScene, selectEditorScene, updateEditorScene } from "../../editor/editorOperations";
import { cellBeside, freeCell, isAllowedCell, roomAt, roomCell, ROOM_SIDES, type RoomSide } from "../../editor/roomLayout";
import Viewport from "../../viewport/Viewport";
import { Button } from "../../ui/button";
import { useNoLogic } from "../../ui/noLogic";
import "./templateSetup.css";

const doNothing = () => undefined;
// the same limit as the editor's room names (EditorPage.tsx)
const ROOM_NAME_MAX = 40;


const TONES = ["blue", "green", "peach", "lilac", "rose", "sky"]; // colours set in templateSetup.css under comment "Room colours"
const toneOf = (environmentId: string) => {
  const index = environmentLibrary.findIndex((env) => env.id === environmentId);
  return index < 0 ? "grey" : TONES[index % TONES.length];
};

const ORIGIN: RoomCell = { x: 0, z: 0 };
// the map, measured from Room 1: Room 1 in the middle and one cell on each side (rows and columns 1-3)
const MAP_CELLS: { cell: RoomCell; side?: RoomSide }[] = [
  { cell: ORIGIN },
  ...ROOM_SIDES.map((side) => ({ cell: cellBeside(ORIGIN, side), side })),
];
const placeOf = (cell: RoomCell) => ({ gridRow: cell.z + 2, gridColumn: cell.x + 2 });
const SIDE_WORDS: Record<RoomSide, string> = { north: "above", east: "to the right of", south: "below", west: "to the left of" };
const plus = (a: RoomCell, b: RoomCell): RoomCell => ({ x: a.x + b.x, z: a.z + b.z });
const minus = (a: RoomCell, b: RoomCell): RoomCell => ({ x: a.x - b.x, z: a.z - b.z });

// Room 1 is where students start, so it belongs in the middle of the editor's map too.
// Moves every room by the same step so Room 1 lands there (rooms keep their sides, so doors
// stay on the same shared walls). Null when a room would then fall outside the five cells.
const centredOnFirst = (project: ProjectData): ProjectData | null => {
  // store a cell on every room first; rooms made before the map existed get a free one
  let stored = project;
  for (const room of project.scenes) {
    if (room.layout) continue;
    stored = updateEditorScene(stored, room.id, { layout: roomCell(stored, room) ?? freeCell(stored) }).project;
  }
  const shift = stored.scenes[0].layout!;
  const moved = stored.scenes.map((room) => ({ ...room, layout: minus(room.layout!, shift) }));
  return moved.every((room) => isAllowedCell(room.layout)) ? { ...stored, scenes: moved } : null;
};

type SetupViewportSectionProps = {
  // the page's copy of the editor draft: its rooms are the template's rooms
  draft: ProjectData;
  onChange: (next: ProjectData) => void;
};

export function SetupViewportSection({ draft, onChange }: SetupViewportSectionProps) {
  const [noLogic, noLogicPopup] = useNoLogic();
  // the room in the preview; falls back to Room 1 when that room is removed
  const [previewId, setPreviewId] = useState(draft.scenes[0].id);
  const scene = draft.scenes.find((item) => item.id === previewId) ?? draft.scenes[0];
  const first = draft.scenes[0];

  // "+ Add room": closed, then where (a side of Room 1), then what kind
  const [adding, setAdding] = useState<{ cell?: RoomCell; side?: RoomSide } | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  // Escape, or a press anywhere outside the popover and its button, closes it
  useEffect(() => {
    if (!adding) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setAdding(null);
    const onPointer = (event: PointerEvent) => {
      if (!addRef.current?.contains(event.target as Node)) setAdding(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [adding]);

  const numberOf = (sceneId: string) => draft.scenes.findIndex((item) => item.id === sceneId) + 1;
  // the map is drawn around Room 1, wherever the editor's map has it
  const firstCell = roomCell(draft, first) ?? ORIGIN;
  const centred = centredOnFirst(draft);
  // a free side of Room 1 can take a room when Room 1 can be moved to the middle, or
  // (if it can't) when that side is still one of the editor's five cells
  const canAddAt = (cell: RoomCell) => !roomAt(draft, plus(cell, firstCell)) && (centred !== null || isAllowedCell(plus(cell, firstCell)));
  const full = !MAP_CELLS.some(({ cell }) => canAddAt(cell));

  // the same steps as the editor's addScene (editor/hooks/useSceneEditing.ts).
  // cell is measured from Room 1, like the map.
  const addRoom = (cell: RoomCell, env: EnvironmentDefinition) => {
    let number = draft.scenes.length + 1;
    while (draft.scenes.some((item) => item.id === `scene-${number}`)) number += 1;
    if (!canAddAt(cell)) return;
    // Room 1 moved to the middle, so cells measured from it are the editor's cells; else
    // pin Room 1 where it is, so adding beside it can't move it
    const base = centred ?? (first.layout ? draft : updateEditorScene(draft, first.id, { layout: firstCell }).project);
    const layout = centred ? cell : plus(cell, firstCell);
    const room = { ...makeScene(`scene-${number}`, env.name), environmentId: env.id, layout };
    // createScene makes the new room active; the editor still opens on the one it was on
    onChange(selectEditorScene(createEditorScene(base, room).project, draft.activeSceneId).project);
    setPreviewId(room.id);
    setAdding(null);
  };

  const removeRoom = (sceneId: string) => {
    if (sceneId === first.id) return;
    onChange(removeEditorScene(draft, sceneId).project);
  };

  // RENAME the room in the preview, the same way the editor's "Your rooms" map does: saving
  // happens only on blur (Enter blurs too), so it runs once; Escape marks the edit cancelled
  // first, because removing the input can still fire a blur. An empty name keeps the old one.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const nameCancelledRef = useRef(false);
  const startRename = () => {
    nameCancelledRef.current = false;
    setNameDraft(scene.name);
  };
  const saveName = () => {
    const trimmed = nameDraft?.trim();
    if (trimmed && !nameCancelledRef.current && trimmed !== scene.name) {
      onChange(updateEditorScene(draft, scene.id, { name: trimmed }).project);
    }
    nameCancelledRef.current = true;
    setNameDraft(null);
  };
  // a different room in the preview drops a half-typed name
  useEffect(() => setNameDraft(null), [scene.id]);

  // ENVIRONMENT of the room in the preview (Room 1 too). A room still named after its old
  // environment takes the new one's name; a name the teacher typed is kept.
  const setEnvironment = (environmentId: string) => {
    const before = environmentLibrary.find((env) => env.id === scene.environmentId);
    const after = environmentLibrary.find((env) => env.id === environmentId);
    if (!after || after.id === scene.environmentId) return;
    const name = before && scene.name === before.name ? after.name : scene.name;
    onChange(updateEditorScene(draft, scene.id, { environmentId, name }).project);
  };

  return (
    <section className="setup-viewport">
      <div className="viewport-bar">{/*TOP: what this is, and the way to change it*/}
        {nameDraft === null ? (
          <span className="viewport-label">
            Room {numberOf(scene.id)} · {scene.name}
            <button type="button" className="ui-icon-btn viewport-rename" onClick={startRename} title="Rename this room" aria-label="Rename this room">
              <Pencil size={13} />
            </button>
          </span>
        ) : (
          <form className="viewport-label viewport-label-editing" onSubmit={(event) => { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}>
            Room {numberOf(scene.id)} ·
            <input
              autoFocus
              className="viewport-rename-input"
              aria-label="Room name"
              value={nameDraft}
              maxLength={ROOM_NAME_MAX}
              onChange={(event) => setNameDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={saveName}
              onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); nameCancelledRef.current = true; setNameDraft(null); } }}
            />
          </form>
        )}
        <div className="viewport-bar-actions">
          <label className="viewport-env">
            <span className="viewport-env-label">Environment</span>
            <span className={`viewport-env-swatch setup-tone-${toneOf(scene.environmentId)}`} />
            <select value={scene.environmentId} onChange={(event) => setEnvironment(event.target.value)}>
              {/* a room on an environment no longer in the library keeps it until changed */}
              {!environmentLibrary.some((env) => env.id === scene.environmentId) && <option value={scene.environmentId}>Unknown</option>}
              {environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            </select>
          </label>
          <Button onClick={() => noLogic("Edit room")}>
            <Pencil size={16} /> Edit room
          </Button>
        </div>
      </div>
      <div className="viewport-stage">{/*THE ROOM: the editor's viewport, look-only*/}
        <Viewport
          objects={scene.objects}
          selectedId={null}
          onSelect={doNothing}
          onMove={doNothing}
          sceneId={scene.id}
          environmentId={scene.environmentId}
          startCamera={scene.startCamera}
          cameraMode="orbit"
          interactive={false}
          textAssets={draft.textAssets ?? []}
          showOctaOrb={false}
          showAxisIndicator={false}
          showHint={false}
        />
      </div>
      <p className="ui-box setup-viewport-hint">{/*HINT: where the teacher tools are*/}
        <strong>Edit room</strong> to suggest spots, lock things or add starter objects.
      </p>

      <div className="ui-box setup-rooms">{/*ROOMS EVERY STUDENT STARTS WITH: one chip per room, then + Add room*/}
        <h3 className="setup-rooms-title">Rooms every student starts with</h3>
        <p className="setup-rooms-note">Optional. Students decorate these but can't remove them.</p>
        <div className="setup-rooms-list">
          {draft.scenes.map((room, index) => (
            <span key={room.id} className={`setup-room ${room.id === scene.id ? "setup-room-on" : ""}`}>
              <button type="button" className="setup-room-name" onClick={() => setPreviewId(room.id)} title={`Preview Room ${index + 1}`}>
                <span className={`setup-room-number setup-tone-${toneOf(room.environmentId)}`}>{index + 1}</span>
                {room.name}
              </button>
              {index === 0 ? (
                <span className="setup-room-start">Start</span>
              ) : (
                <button type="button" className="ui-icon-btn setup-room-remove" onClick={() => removeRoom(room.id)} title={`Remove Room ${index + 1}`} aria-label={`Remove Room ${index + 1}`}>
                  <X size={14} strokeWidth={3} />
                </button>
              )}
            </span>
          ))}
          <div className="setup-rooms-add" ref={addRef}>
            <Button variant="add" disabled={full} title={full ? "Every side of Room 1 has a room" : undefined} onClick={() => setAdding(adding ? null : {})} aria-expanded={!!adding}>
              <Plus size={16} /> Add room
            </Button>
            {adding && !adding.cell && (
              <div className="ui-box setup-rooms-popover" role="dialog" aria-label="Where should it go?">{/*STEP 1: where*/}
                <h4 className="setup-rooms-popover-title">Where should it go?</h4>
                <p className="setup-rooms-note">Same map students use. Tap a + next to Room 1.</p>
                <div className="setup-rooms-map">
                  {MAP_CELLS.map(({ cell, side }) => {
                    const room = roomAt(draft, plus(cell, firstCell));
                    const key = `${cell.x},${cell.z}`;
                    if (room) {
                      return (
                        <span key={key} className={`setup-map-cell setup-tone-${toneOf(room.environmentId)} ${room.id === first.id ? "setup-map-first" : ""}`} style={placeOf(cell)} title={`Room ${numberOf(room.id)} · ${room.name}`}>
                          {numberOf(room.id)}
                        </span>
                      );
                    }
                    const words = `Add a room ${SIDE_WORDS[side!]} Room 1`;
                    if (!canAddAt(cell)) {
                      return <span key={key} className="setup-map-cell setup-map-off" style={placeOf(cell)} title="Too far from the middle of the map for a room" />;
                    }
                    return (
                      <button key={key} type="button" className="setup-map-cell setup-map-add" style={placeOf(cell)} onClick={() => setAdding({ cell, side })} title={words} aria-label={words}>
                        <Plus size={18} />
                      </button>
                    );
                  })}
                </div>
                <p className="setup-rooms-note">A door is added on the shared wall.</p>
              </div>
            )}
            {adding?.cell && (
              <div className="ui-box setup-rooms-popover" role="dialog" aria-label="What kind of room?">{/*STEP 2: what kind*/}
                <div className="setup-rooms-popover-head">
                  <h4 className="setup-rooms-popover-title">What kind of room?</h4>
                  <Button size="small" onClick={() => setAdding({})}>‹ Back</Button>
                </div>
                <div className="setup-kinds">
                  {environmentLibrary.map((env) => (
                    <button key={env.id} type="button" className="setup-kind" onClick={() => addRoom(adding.cell!, env)}>
                      <span className={`setup-kind-swatch setup-tone-${toneOf(env.id)}`} />
                      <span>
                        <strong>{env.name}</strong>
                        {/* most descriptions only repeat the name, so those are left out */}
                        {env.description && env.description !== env.name && <small>{env.description}</small>}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="setup-rooms-note">Goes {SIDE_WORDS[adding.side!]} Room 1. A door is added on the shared wall.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {noLogicPopup}
    </section>
  );
}
