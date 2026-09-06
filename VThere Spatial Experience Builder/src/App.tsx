import { useState } from 'react'
import { AssetKind, ProjectData, SceneObject, cloneProject, defaultProject, makeObject } from './model'
import { copyProject, downloadProject, loadProject, saveProject } from './serializer'
import Viewport from './Viewport'

const assetCatalog: { kind: AssetKind; label: string; detail: string }[] = [
  { kind: 'cube', label: 'Display block', detail: 'A clean pedestal form' },
  { kind: 'sphere', label: 'Ornament', detail: 'Soft rounded exhibit' },
  { kind: 'cylinder', label: 'Column', detail: 'Tall architectural form' },
]

const initialProject = loadProject()

export default function App() {
  const [project, setProject] = useState<ProjectData>(initialProject)
  const [history, setHistory] = useState<ProjectData[]>([])
  const [future, setFuture] = useState<ProjectData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState('Local draft')
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
  const selected = scene.objects.find((item) => item.id === selectedId) ?? null

  const commit = (next: ProjectData) => {
    setHistory((items) => [...items.slice(-39), copyProject(project)])
    setFuture([])
    setProject(next)
  }
  const updateScene = (mutate: (objects: SceneObject[]) => SceneObject[]) => {
    const next = cloneProject(project)
    const target = next.scenes.find((item) => item.id === next.activeSceneId)
    if (target) target.objects = mutate(target.objects)
    commit(next)
  }
  const addObject = (kind: AssetKind) => {
    const object = makeObject(kind, scene.objects.length + 1)
    updateScene((objects) => [...objects, object])
    setSelectedId(object.id)
  }
  const updateSelected = (changes: Partial<SceneObject['transform']>) => {
    if (!selected) return
    updateScene((objects) => objects.map((item) => item.id === selected.id ? { ...item, transform: { ...item.transform, ...changes } } : item))
  }
  const moveObject = (id: string, position: [number, number, number]) => {
    updateScene((objects) => objects.map((item) => item.id === id ? { ...item, transform: { ...item.transform, position } } : item))
  }
  const renameSelected = (name: string) => {
    if (!selected) return
    updateScene((objects) => objects.map((item) => item.id === selected.id ? { ...item, name } : item))
  }
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture((items) => [...items, copyProject(project)])
    setHistory((items) => items.slice(0, -1))
    setProject(previous)
  }
  const redo = () => {
    const next = future.at(-1)
    if (!next) return
    setHistory((items) => [...items, copyProject(project)])
    setFuture((items) => items.slice(0, -1))
    setProject(next)
  }
  const save = () => { saveProject(project); setSavedAt(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`) }
  const reset = () => { setHistory([]); setFuture([]); setSelectedId(null); setProject(defaultProject()); setSavedAt('New local draft') }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">V</span><div><strong>VThere</strong><span>Spatial Experience Builder</span></div></div>
        <div className="project-title"><span className="eyebrow">Project</span><strong>{project.name}</strong><span className="save-state">{savedAt}</span></div>
        <div className="top-actions"><button className="button subtle" onClick={undo} disabled={!history.length}>Undo</button><button className="button subtle" onClick={redo} disabled={!future.length}>Redo</button><button className="button ghost" onClick={() => downloadProject(project)}>Export JSON</button><button className="button primary" onClick={save}>Save project</button></div>
      </header>
      <div className="workspace">
        <aside className="left-rail">
          <div className="rail-heading"><div><span className="eyebrow">Build</span><h2>Scene tree</h2></div><button className="icon-button" title="Create scene" onClick={() => { const next = cloneProject(project); const id = `scene-${next.scenes.length + 1}`; next.scenes.push({ id, name: `Room ${next.scenes.length + 1}`, objects: [] }); next.activeSceneId = id; commit(next) }}>+</button></div>
          <div className="scene-tabs">{project.scenes.map((item) => <button key={item.id} className={item.id === scene.id ? 'scene-tab active' : 'scene-tab'} onClick={() => { setProject({ ...project, activeSceneId: item.id }); setSelectedId(null) }}>{item.name}<span>{item.objects.length}</span></button>)}</div>
          <div className="tree-list">{scene.objects.length === 0 ? <div className="empty-state">Your scene is quiet.<br /><span>Place an asset to begin.</span></div> : scene.objects.map((item) => <button key={item.id} className={item.id === selectedId ? 'tree-item selected' : 'tree-item'} onClick={() => setSelectedId(item.id)}><span className={`object-dot ${item.assetKind}`} />{item.name}<span className="tree-chevron">›</span></button>)}</div>
          <div className="rail-footer"><span className="status-dot" />Autosave ready<button className="text-button" onClick={reset}>Reset draft</button></div>
        </aside>
        <section className="center-stage"><div className="stage-toolbar"><div className="mode-switch"><button className="mode active">Select</button><button className="mode">Move</button><button className="mode">Rotate</button><button className="mode">Scale</button></div><div className="stage-meta"><span className="live-dot" />Editor preview <span className="divider" /> {scene.name}</div></div><Viewport objects={scene.objects} selectedId={selectedId} onSelect={setSelectedId} onMove={moveObject} /><div className="stage-footer"><span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> move on floor</span><span><kbd>Esc</kbd> clear selection</span></div></section>
        <aside className="right-rail">
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Library</span><h2>Assets</h2></div><span className="count">{assetCatalog.length}</span></div><div className="asset-list">{assetCatalog.map((asset) => <button className="asset-card" key={asset.kind} onClick={() => addObject(asset.kind)}><span className={`asset-preview ${asset.kind}`}><span /></span><span className="asset-copy"><strong>{asset.label}</strong><small>{asset.detail}</small></span><span className="add-symbol">+</span></button>)}</div></section>
          <section className="panel inspector-panel"><div className="panel-heading"><div><span className="eyebrow">Properties</span><h2>Inspector</h2></div>{selected && <span className="selection-badge">Selected</span>}</div>{selected ? <Inspector object={selected} onRename={renameSelected} onTransform={updateSelected} /> : <div className="inspector-empty"><div className="crosshair">＋</div><p>Select an object in the scene</p><span>Its transform will appear here.</span></div>}</section>
        </aside>
      </div>
    </main>
  )
}

function Inspector({ object, onRename, onTransform }: { object: SceneObject; onRename: (name: string) => void; onTransform: (changes: Partial<SceneObject['transform']>) => void }) {
  const vectorInput = (label: string, values: [number, number, number], key: 'position' | 'rotation' | 'scale') => <div className="field-group"><label>{label}</label><div className="vector-fields">{values.map((value, index) => <label className="number-field" key={`${key}-${index}`}><span>{['X', 'Y', 'Z'][index]}</span><input type="number" step="0.1" value={Number(value.toFixed(2))} onChange={(event) => { const next = [...values] as [number, number, number]; next[index] = Number(event.target.value); onTransform({ [key]: next }) }} /></label>)}</div></div>
  return <div className="inspector-content"><label className="field-group"><span>Object name</span><input value={object.name} onChange={(event) => onRename(event.target.value)} /></label><div className="asset-id"><span className={`object-dot ${object.assetKind}`} />{object.assetId}<span>Library asset</span></div>{vectorInput('Position', object.transform.position, 'position')}{vectorInput('Rotation', object.transform.rotation, 'rotation')}{vectorInput('Scale', object.transform.scale, 'scale')}</div>
}
