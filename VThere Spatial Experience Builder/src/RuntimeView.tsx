import Viewport from './Viewport'
import { ProjectData } from './model'

interface RuntimeViewProps {
  project: ProjectData
  onExit: () => void
}

export default function RuntimeView({ project, onExit }: RuntimeViewProps) {
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]

  return (
    <main className="runtime-shell">
      <header className="runtime-topbar">
        <div className="brand"><span className="brand-mark">V</span><div><strong>VThere</strong><span>Visitor simulation</span></div></div>
        <div className="runtime-title"><span className="eyebrow">Simulation</span><strong>{project.name}</strong><span>{scene.name}</span></div>
        <button className="button ghost" onClick={onExit}>Exit simulation</button>
      </header>
      <section className="runtime-stage">
        <div className="runtime-meta"><span className="live-dot" />Visitor view <span className="divider" /> {scene.name}</div>
        <Viewport objects={scene.objects} selectedId={null} onSelect={() => undefined} onMove={() => undefined} interactive={false} />
      </section>
    </main>
  )
}
