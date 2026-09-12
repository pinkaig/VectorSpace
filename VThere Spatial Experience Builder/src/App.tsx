import { useEffect, useRef, useState } from 'react'
import {
  AssetKind,
  ProjectData,
  SceneObject,
  cloneProject,
  defaultProject,
  environmentLibrary,
  makeObject,
  makeScene,
} from './model'
import {
  copyProject,
  downloadProject,
  importProjectFile,
  loadProjectWithSource,
  saveProject,
} from './serializer'
import { assetCatalog, filterAssets } from './assets'
import RuntimeView from './RuntimeView'
import Viewport, { CameraMode, GizmoMode, ViewportHandle } from './Viewport'

const initialLoad = loadProjectWithSource()
const initialProject = initialLoad.project

export default function App() {
  const [project, setProject] = useState<ProjectData>(initialProject)
  const [history, setHistory] = useState<ProjectData[]>([])
  const [future, setFuture] = useState<ProjectData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('select')
  const [scaleSpace, setScaleSpace] = useState<'world' | 'local'>('world')
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  const [resetToken, setResetToken] = useState(0)
  const [savedAt, setSavedAt] = useState(
    initialLoad.source === 'default'
      ? 'New local project'
      : `Loaded ${initialLoad.source} from this browser`,
  )
  const [persistenceState, setPersistenceState] = useState(
    initialLoad.source === 'default'
      ? 'No local draft found; using clean project'
      : `Loaded from browser localStorage ${initialLoad.source}`,
  )
  const [viewMode, setViewMode] = useState<'editor' | 'runtime'>('editor')
  const [assetQuery, setAssetQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
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
  const setEnvironment = (environmentId: string) => {
    const next = cloneProject(project)
    const target = next.scenes.find((item) => item.id === next.activeSceneId)
    if (target) target.environmentId = environmentId
    commit(next)
  }
  const captureStartView = () => {
    const pose = viewportRef.current?.getCameraPose()
    if (!pose) return
    const next = cloneProject(project)
    const target = next.scenes.find((item) => item.id === next.activeSceneId)
    if (target) target.startCamera = pose
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
  const scaleObject = (id: string, scale: [number, number, number]) => {
    updateScene((objects) => objects.map((item) => item.id === id ? { ...item, transform: { ...item.transform, scale } } : item))
  }
  const rotateObject = (id: string, rotation: [number, number, number]) => {
    updateScene((objects) => objects.map((item) => item.id === id ? { ...item, transform: { ...item.transform, rotation } } : item))
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
  const persist = (nextProject: ProjectData, label: string) => {
    const result = saveProject(nextProject)
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setSavedAt(result === 'failed' ? 'Save failed' : `${label} ${time}`)
    setPersistenceState(result === 'saved' ? 'Primary + backup ready' : result === 'saved-with-backup' ? 'Backup copy only' : 'Export JSON now')
  }
  useEffect(() => {
    const timer = window.setTimeout(() => persist(project, 'Autosaved'), 750)
    return () => window.clearTimeout(timer)
  }, [project])
  const save = () => persist(project, 'Saved')
  const loadDraft = () => {
    const loaded = loadProjectWithSource()
    setHistory([])
    setFuture([])
    setSelectedId(null)
    setProject(loaded.project)
    setSavedAt(loaded.source === 'default' ? 'No draft found; opened clean project' : `Loaded ${loaded.source} from this browser`)
    setPersistenceState(loaded.source === 'default' ? 'No local draft found; using clean project' : `Loaded from browser localStorage ${loaded.source}`)
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = await importProjectFile(file)
      setHistory([])
      setFuture([])
      setSelectedId(null)
      setProject(imported)
      setSavedAt(`Imported ${file.name}`)
      setPersistenceState('Imported JSON; pending autosave to browser localStorage')
    } catch (error) {
      setSavedAt('Import rejected')
      setPersistenceState(error instanceof Error ? error.message : 'Project file could not be verified')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const reset = () => {
    setHistory([])
    setFuture([])
    setSelectedId(null)
    setProject(defaultProject())
    setSavedAt('New local draft')
    setPersistenceState('Pending autosave to browser localStorage')
  }

  if (viewMode === 'runtime') {
    return (
      <RuntimeView
        project={project}
        onExit={() => setViewMode('editor')}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">V</span><div><strong>VThere</strong><span>Spatial Experience Builder</span></div></div>
        <div className="project-title"><span className="eyebrow">Project</span><strong>{project.name}</strong><span className="save-state">{savedAt}</span></div>
        <div className="top-actions">
          <button className="button subtle" onClick={undo} disabled={!history.length}>Undo</button>
          <button className="button subtle" onClick={redo} disabled={!future.length}>Redo</button>
          <button className="button ghost" onClick={loadDraft}>Load draft</button>
          <button className="button ghost" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
          <button className="button ghost" onClick={() => downloadProject(project)}>Export JSON</button>
          <button className="button primary" onClick={save}>Save project</button>
          <button className="button primary" onClick={() => setViewMode('runtime')}>Run simulation</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="left-rail">
          <div className="rail-heading"><div><span className="eyebrow">Build</span><h2>Scene tree</h2></div><button className="icon-button" title="Create scene" onClick={() => { const next = cloneProject(project); const id = `scene-${next.scenes.length + 1}`; next.scenes.push(makeScene(id, `Room ${next.scenes.length + 1}`)); next.activeSceneId = id; commit(next) }}>+</button></div>
          <div className="scene-tabs">{project.scenes.map((item) => <button key={item.id} className={item.id === scene.id ? 'scene-tab active' : 'scene-tab'} onClick={() => { setProject({ ...project, activeSceneId: item.id }); setSelectedId(null) }}>{item.name}<span>{item.objects.length}</span></button>)}</div>
          <div className="tree-list">{scene.objects.length === 0 ? <div className="empty-state">Your scene is quiet.<br /><span>Place an asset to begin.</span></div> : scene.objects.map((item) => <button key={item.id} className={item.id === selectedId ? 'tree-item selected' : 'tree-item'} onClick={() => setSelectedId(item.id)}><span className={`object-dot ${item.assetKind}`} />{item.name}<span className="tree-chevron">›</span></button>)}</div>
          <div className="rail-footer">
            <span className="status-dot" />
            {persistenceState}
            <small className="storage-note">Save location: browser localStorage</small>
            <button className="text-button" onClick={reset}>Reset draft</button>
          </div>
        </aside>
        <section className="center-stage">
          <div className="stage-toolbar">
            <div className="mode-switch">
              <button className={gizmoMode === 'select' ? 'mode active' : 'mode'} onClick={() => setGizmoMode('select')}>Select</button>
              <button className={gizmoMode === 'move' ? 'mode active' : 'mode'} onClick={() => setGizmoMode('move')}>Move</button>
              <button className={gizmoMode === 'rotate' ? 'mode active' : 'mode'} onClick={() => setGizmoMode('rotate')}>Rotate</button>
              <button className={gizmoMode === 'scale' ? 'mode active' : 'mode'} onClick={() => setGizmoMode('scale')}>Scale</button>
            </div>
            {gizmoMode === 'scale' && (
              <div className="mode-switch">
                <button className={scaleSpace === 'world' ? 'mode active' : 'mode'} onClick={() => setScaleSpace('world')} title="Scale handles stay aligned to world X/Y/Z">World</button>
                <button className={scaleSpace === 'local' ? 'mode active' : 'mode'} onClick={() => setScaleSpace('local')} title="Scale handles rotate with the object, so they stay on its actual faces">Snap to object</button>
              </div>
            )}
            <div className="stage-meta"><span className="live-dot" />Editor preview <span className="divider" /> {scene.name}</div>
          </div>
          <div className="view-toolbar">
            <label className="env-select"><span>Environment</span><select value={scene.environmentId} onChange={(event) => setEnvironment(event.target.value)}>{environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
            <div className="mode-switch"><button className={cameraMode === 'orbit' ? 'mode active' : 'mode'} onClick={() => setCameraMode('orbit')}>Orbit</button><button className={cameraMode === 'walk' ? 'mode active' : 'mode'} onClick={() => setCameraMode('walk')}>Walk</button></div>
            <div className="view-actions"><button className="button subtle" onClick={() => setResetToken((value) => value + 1)}>Reset view</button><button className="button subtle" onClick={captureStartView}>Set start view</button></div>
          </div>
          <Viewport
            ref={viewportRef}
            objects={scene.objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveObject}
            onScale={scaleObject}
            onRotate={rotateObject}
            gizmoMode={gizmoMode}
            scaleSpace={scaleSpace}
            sceneId={scene.id}
            environmentId={scene.environmentId}
            startCamera={scene.startCamera}
            cameraMode={cameraMode}
            resetToken={resetToken}
          />
          <div className="stage-footer">{cameraMode === 'walk' ? <><span><kbd>Drag</kbd> look around</span><span><kbd>WASD</kbd> walk</span><span><kbd>Click</kbd> select</span></> : <><span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> move / gizmo handle</span><span><kbd>Esc</kbd> clear selection</span></>}</div>
        </section>
        <aside className="right-rail">
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">Library</span><h2>Assets</h2></div><span className="count">{filterAssets(assetQuery).length}/{assetCatalog.length}</span></div>
            <div className="asset-tools">
              <input aria-label="Search assets" placeholder="Search approved assets" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
            </div>
            <div className="asset-list">
              {filterAssets(assetQuery).map((asset) => <button className="asset-card" key={asset.kind} onClick={() => addObject(asset.kind)}><span className={`asset-preview ${asset.kind}`}><span /></span><span className="asset-copy"><strong>{asset.label}</strong><small>{asset.detail}</small></span><span className="add-symbol">+</span></button>)}
              {filterAssets(assetQuery).length === 0 && <div className="asset-empty">No approved assets match this search.</div>}
            </div>
          </section>
          <section className="panel inspector-panel"><div className="panel-heading"><div><span className="eyebrow">Properties</span><h2>Inspector</h2></div>{selected && <span className="selection-badge">Selected</span>}</div>{selected ? <Inspector object={selected} onRename={renameSelected} onTransform={updateSelected} /> : <div className="inspector-empty"><div className="crosshair">＋</div><p>Select an object in the scene</p><span>Its transform will appear here.</span></div>}</section>
        </aside>
      </div>
    </main>
  )
}

const radToDeg = (radians: number) => radians * (180 / Math.PI)
const degToRad = (degrees: number) => degrees * (Math.PI / 180)

function Inspector({ object, onRename, onTransform }: { object: SceneObject; onRename: (name: string) => void; onTransform: (changes: Partial<SceneObject['transform']>) => void }) {
  const vectorInput = (label: string, values: [number, number, number], key: 'position' | 'rotation' | 'scale') => {
    const isRotation = key === 'rotation'
    const displayValues = isRotation ? values.map(radToDeg) : values
    return (
      <div className="field-group">
        <label>{isRotation ? `${label} (°)` : label}</label>
        <div className="vector-fields">
          {displayValues.map((value, index) => (
            <label className="number-field" key={`${key}-${index}`}>
              <span>{['X', 'Y', 'Z'][index]}</span>
              <input
                type="number"
                step={isRotation ? 1 : 0.1}
                min={isRotation ? 0 : undefined}
                max={isRotation ? 360 : undefined}
                value={Number(value.toFixed(isRotation ? 1 : 2))}
                onChange={(event) => {
                  const entered = Number(event.target.value)
                  const next = [...values] as [number, number, number]
                  next[index] = isRotation ? degToRad(Math.min(360, Math.max(0, entered))) : entered
                  onTransform({ [key]: next })
                }}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }
  return <div className="inspector-content"><label className="field-group"><span>Object name</span><input value={object.name} onChange={(event) => onRename(event.target.value)} /></label><div className="asset-id"><span className={`object-dot ${object.assetKind}`} />{object.assetId}<span>Library asset</span></div>{vectorInput('Position', object.transform.position, 'position')}{vectorInput('Rotation', object.transform.rotation, 'rotation')}{vectorInput('Scale', object.transform.scale, 'scale')}</div>
}
