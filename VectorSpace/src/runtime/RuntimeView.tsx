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
import { useEffect, useRef } from "react";
import Viewport, { type ViewportHandle } from "../viewport/Viewport";
import { ProjectData } from "../project/model";
import { isTypingTarget } from "../viewport/viewportTypes";

interface RuntimeViewProps {
  project: ProjectData;
  onExit: () => void;
}

export default function RuntimeView({ project, onExit }: RuntimeViewProps) {
  const scene =
    project.scenes.find((item) => item.id === project.activeSceneId) ??
    project.scenes[0];
  const viewportRef = useRef<ViewportHandle>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.repeat) return;
      if (event.code === "Escape") onExit();
      else if (event.code === "KeyR") viewportRef.current?.restartRuntime();
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
          <span>
            <kbd>Esc</kbd> exit
          </span>
          <span>
            <kbd>R</kbd> restart
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
          textAssets={project.textAssets ?? []}
        />
      </section>
    </main>
  );
}
