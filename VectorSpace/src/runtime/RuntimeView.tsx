/**
 * @file        RuntimeView.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Visitor-facing runtime presentation for the active scene.
 *
 * @responsibility
 * Selects the active scene and mounts a read-only Viewport in play mode, with the
 * visitor's controls over it: Back to building, the room name, and the three ways to
 * move (Tap to go, Walk with a joystick or WASD, Tour spots).
 *
 * @inputs
 * RuntimeViewProps: ProjectData and an exit callback.
 *
 * @outputs
 * A play stage the editor shows under its own top bar.
 *
 * @members
 * RuntimeViewProps, active-scene lookup, tour spots, Joystick, and Viewport interactive=false.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AudioControls from "./AudioControls";
import Viewport, { type PlayMove, type ViewportHandle } from "../viewport/Viewport";
import { ProjectData } from "../project/model";
import { isTypingTarget } from "../viewport/viewportTypes";

interface RuntimeViewProps {
  project: ProjectData;
  // the editor's way back (the button and Esc); left out on the visitor's page, which has none
  onExit?: () => void;
  // the banner's text; the editor's Play leaves it out
  title?: string;
}

const VOLUME_KEY = "vectorspace-visitor-volume";
const MUTED_KEY = "vectorspace-visitor-muted";

// Storage can throw or be empty (private windows, blocked site data), so the controls fall back to full volume.
const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered next visit; the setting still applies for this one.
  }
};

const MOVE_MODES: { mode: PlayMove; label: string }[] = [
  { mode: "tap", label: "Tap to go" },
  { mode: "walk", label: "Walk" },
  { mode: "tour", label: "Tour spots" },
];

// null is the entrance (the scene's start view)
type TourSpot = { objectId: string | null; name: string };

// How far the knob travels from the centre, in px.
const JOYSTICK_REACH = 36;

/** On-screen stick for touch screens: reports -1..1 per axis (x right, z forward), 0, 0 on release. */
function Joystick({ onChange }: { onChange: (x: number, z: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const push = (event: ReactPointerEvent) => {
    const rect = baseRef.current!.getBoundingClientRect();
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > JOYSTICK_REACH) {
      x *= JOYSTICK_REACH / length;
      y *= JOYSTICK_REACH / length;
    }
    setKnob({ x, y });
    onChange(x / JOYSTICK_REACH, -y / JOYSTICK_REACH);
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };
  // switching away from Walk mid-push must not leave the visitor walking
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onChange(0, 0), []);

  return (
    <div
      className="play-joystick"
      ref={baseRef}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); push(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) push(event); }}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label="Joystick: push to walk"
    >
      <div className="play-joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function RuntimeView({ project, onExit, title }: RuntimeViewProps) {
  const scene =
    project.scenes.find((item) => item.id === project.activeSceneId) ??
    project.scenes[0];
  const roomNumber = project.scenes.indexOf(scene) + 1;
  const viewportRef = useRef<ViewportHandle>(null);
  const [volume, setVolume] = useState(() => {
    const stored = Number(readStored(VOLUME_KEY));
    return readStored(VOLUME_KEY) !== null && Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
  });
  const [muted, setMuted] = useState(() => readStored(MUTED_KEY) === "true");

  useEffect(() => writeStored(VOLUME_KEY, String(volume)), [volume]);
  useEffect(() => writeStored(MUTED_KEY, String(muted)), [muted]);
  const [moveBy, setMoveBy] = useState<PlayMove>("tap");
  const [spotIndex, setSpotIndex] = useState(0);
  // A mouse (PC) gets first-person Walk and no joystick; touch screens drag and use the stick.
  const [hasMouse] = useState(() => window.matchMedia("(pointer: fine)").matches);
  // True while Walk holds the mouse for first-person look.
  const [mouseHeld, setMouseHeld] = useState(false);

  // The entrance, then the exhibits: objects with something to explore (a rule or an
  // attachment). A room with none of those tours every top-level object instead.
  const spots = useMemo<TourSpot[]>(() => {
    const rules = project.rules ?? [];
    const shown = scene.objects.filter((object) => !object.parentId && object.visible && object.enabled);
    const exhibits = shown.filter((object) => object.attachments?.length || rules.some((rule) => rule.objectId === object.id));
    return [
      { objectId: null, name: "Entrance" },
      ...(exhibits.length > 0 ? exhibits : shown).map((object) => ({ objectId: object.id, name: object.name })),
    ];
  }, [scene, project.rules]);

  const goToSpot = (index: number) => {
    const next = Math.max(0, Math.min(spots.length - 1, index));
    setSpotIndex(next);
    viewportRef.current?.goToSpot(spots[next].objectId);
  };

  const chooseMove = (mode: PlayMove) => {
    setMoveBy(mode);
    // a tour starts at the entrance
    if (mode === "tour") goToSpot(0);
  };

  // a new room starts its tour from the top
  useEffect(() => setSpotIndex(0), [scene.id]);

  useEffect(() => {
    // Esc while the mouse is held only frees the mouse (the browser does that); it takes a
    // second Esc to leave Play. Some browsers still deliver that first Esc, just after the release.
    let releasedAt = 0;
    const onLockChange = () => {
      const held = document.pointerLockElement !== null;
      if (!held) releasedAt = performance.now();
      setMouseHeld(held);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.repeat) return;
      if (event.code === "Escape") {
        if (document.pointerLockElement || performance.now() - releasedAt < 300) return;
        onExit?.();
      }
      else if (event.code === "KeyM") setMuted((current) => !current);
      else if (event.code === "KeyR") {
        viewportRef.current?.restartRuntime();
        setSpotIndex(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [onExit]);

  // Tour markers sit on the floor, so they're re-placed every frame as the visitor moves
  // and looks; hidden while behind the visitor.
  const markerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (moveBy !== "tour") return;
    let frame = 0;
    const place = () => {
      frame = requestAnimationFrame(place);
      spots.forEach((spot, index) => {
        const marker = markerRefs.current[index];
        if (!marker) return;
        const point = viewportRef.current?.spotScreenPoint(spot.objectId) ?? null;
        marker.style.display = point ? "" : "none";
        if (point) marker.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      });
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [moveBy, spots]);

  const spot = spots[Math.min(spotIndex, spots.length - 1)];

  return (
    <section className="play-stage">
      <Viewport
        ref={viewportRef}
        objects={scene.objects}
        selectedId={null}
        onSelect={() => undefined}
        onMove={() => undefined}
        sceneId={scene.id}
        environmentId={scene.environmentId}
        surfaces={scene.surfaces}
        startCamera={scene.startCamera}
        cameraMode="walk"
        interactive={false}
        runtimeMode="play"
        playMove={moveBy}
        showHint={false}
        rules={project.rules ?? []}
        zones={scene.zones ?? []}
        audioAssets={project.audioAssets ?? []}
        audioSettings={project.audioSettings}
        audioMasterVolume={volume}
        audioMasterMuted={muted}
        textAssets={project.textAssets ?? []}
      />

      <div className="play-banner">
        <span>{title ?? "Playing · exactly what visitors will see"}</span>
        <AudioControls volume={volume} muted={muted} onVolumeChange={setVolume} onMutedChange={setMuted} />
        {onExit && <button onClick={onExit}>Back to building</button>}
      </div>

      <div className="play-panel">
        <span className="play-room-tag">Room {roomNumber}</span>
        <strong>{scene.name}</strong>
        <span className="play-panel-divider" />
        <span className="play-panel-label">Move by</span>
        {MOVE_MODES.map(({ mode, label }) => (
          <button key={mode} className={moveBy === mode ? "play-mode active" : "play-mode"} onClick={() => chooseMove(mode)}>
            {label}
          </button>
        ))}
      </div>

      {moveBy === "tap" && (
        <div className="play-hint center">
          <b>{hasMouse ? "Click" : "Tap"} the floor</b> to walk there · <b>drag</b> to look around · <b>{hasMouse ? "click" : "tap"} things</b> to explore
        </div>
      )}

      {moveBy === "walk" && hasMouse && (
        <>
          <div className="play-hint left no-stick"><b>WASD</b> to walk · <b>Shift</b> to run</div>
          <div className="play-hint right">
            {mouseHeld ? <><b>Esc</b> to free the mouse</> : <><b>Click</b> to look around</>}
          </div>
        </>
      )}

      {moveBy === "walk" && !hasMouse && (
        <>
          <Joystick onChange={(x, z) => viewportRef.current?.setJoystick(x, z)} />
          <div className="play-hint left"><b>Joystick</b> to walk</div>
          <div className="play-hint right"><b>Drag</b> anywhere to look around</div>
        </>
      )}

      {moveBy === "tour" && (
        <>
          <div className="play-spot-layer">
            {spots.map((item, index) => (
              <button
                key={item.objectId ?? "entrance"}
                ref={(element) => { markerRefs.current[index] = element; }}
                className={index === spotIndex ? "play-spot-marker active" : "play-spot-marker"}
                onClick={() => goToSpot(index)}
                title={item.name}
                aria-label={`Spot ${index + 1}: ${item.name}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="play-tour-nav">
            <button className="play-tour-prev" onClick={() => goToSpot(spotIndex - 1)} disabled={spotIndex === 0} aria-label="Previous spot">
              <ChevronLeft size={20} />
            </button>
            <div className="play-tour-spot">
              <span>Spot {spotIndex + 1} of {spots.length}</span>
              <strong>{spot.name}</strong>
            </div>
            <button className="play-tour-next" onClick={() => goToSpot(spotIndex + 1)} disabled={spotIndex === spots.length - 1} aria-label="Next spot">
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
