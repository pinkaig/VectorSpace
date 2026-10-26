/**
 * @file        RuntimeView.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Visitor-facing runtime presentation for the active scene.
 *
 * @responsibility
 * Selects the active scene, renders runtime metadata, and mounts a read-only
 * Viewport without editor interaction callbacks.
 *
 * @inputs
 * RuntimeViewProps: ProjectData and an exit callback.
 *
 * @outputs
 * Runtime shell JSX containing a non-interactive 3D viewport.
 *
 * @members
 * RuntimeViewProps, active-scene lookup, and Viewport interactive=false.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
import { useEffect, useRef, useState } from "react";
import AudioControls from "./AudioControls";
import Viewport, { type ViewportHandle } from "../viewport/Viewport";
import { ProjectData } from "../project/model";
import { isTypingTarget } from "../viewport/viewportTypes";

interface RuntimeViewProps {
  project: ProjectData;
  onExit: () => void;
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

export default function RuntimeView({ project, onExit }: RuntimeViewProps) {
  const scene =
    project.scenes.find((item) => item.id === project.activeSceneId) ??
    project.scenes[0];
  const viewportRef = useRef<ViewportHandle>(null);
  const [volume, setVolume] = useState(() => {
    const stored = Number(readStored(VOLUME_KEY));
    return readStored(VOLUME_KEY) !== null && Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
  });
  const [muted, setMuted] = useState(() => readStored(MUTED_KEY) === "true");

  useEffect(() => writeStored(VOLUME_KEY, String(volume)), [volume]);
  useEffect(() => writeStored(MUTED_KEY, String(muted)), [muted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.repeat) return;
      if (event.code === "Escape") onExit();
      else if (event.code === "KeyR") viewportRef.current?.restartRuntime();
      else if (event.code === "KeyM") setMuted((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  return (
    <main className="runtime-shell">
      <header className="runtime-topbar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <div>
            <strong>VectorSpace</strong>
            <span>Visitor simulation</span>
          </div>
        </div>
        <div className="runtime-title">
          <span className="eyebrow">Simulation</span>
          <strong>{project.name}</strong>
          <span>{scene.name}</span>
        </div>
        <div className="runtime-actions">
          <AudioControls volume={volume} muted={muted} onVolumeChange={setVolume} onMutedChange={setMuted} />
          <span>
            <kbd>Esc</kbd> exit
          </span>
          <span>
            <kbd>R</kbd> restart
          </span>
          <span>
            <kbd>M</kbd> mute
          </span>
        </div>
      </header>
      <section className="runtime-stage">
        <div className="runtime-meta">
          <span className="live-dot" />
          Visitor view <span className="divider" /> {scene.name}
        </div>
        <Viewport
          ref={viewportRef}
          objects={scene.objects}
          selectedId={null}
          onSelect={() => undefined}
          onMove={() => undefined}
          sceneId={scene.id}
          environmentId={scene.environmentId}
          startCamera={scene.startCamera}
          cameraMode="walk"
          interactive={false}
          runtimeMode="play"
          rules={project.rules ?? []}
          zones={scene.zones ?? []}
          audioAssets={project.audioAssets ?? []}
          audioSettings={project.audioSettings}
          audioMasterVolume={volume}
          audioMasterMuted={muted}
          textAssets={project.textAssets ?? []}
        />
      </section>
    </main>
  );
}
