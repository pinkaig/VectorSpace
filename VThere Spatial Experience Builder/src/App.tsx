/**
 * @file        App.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Top-level editor coordinator and React application shell.
 *
 * @responsibility
 * Owns project editing state, selection, undo/redo, draft persistence,
 * editor/runtime mode selection, and composition of the editor panels.
 *
 * @inputs
 * Initial project data from serializer.ts and user events from the editor UI.
 *
 * @outputs
 * Editor or RuntimeView JSX and project updates sent to child components.
 *
 * @members
 * project, history, future, selectedId, viewMode, assetQuery, commit,
 * updateScene, addObject, updateSelected, moveObject, undo, redo, persist.
 *
 * @documentation
 * Larger system guide: docs/02-architecture/UNDATED--FOUNDATION--architecture.md
 */
import { useEffect, useRef, useState } from 'react'
import {
  createCommandTimeline,
} from '@vthere/authoring-engine'
import {
  AssetKind,
  ProjectData,
  SceneObject,
  defaultProject,
  environmentLibrary,
  makeScene,
} from './model'
import {
  downloadProject,
  importProjectFile,
  loadProjectWithSource,
  saveProject,
} from './serializer'
import { assetCatalog, filterAssets } from './assets'
import {
  createEditorObject,
  createEditorScene,
  duplicateEditorObject,
  removeEditorObject,
  renameEditorObject,
  selectEditorScene,
  setEditorObjectEnabled,
  setEditorObjectVisible,
  updateEditorScene,
  updateEditorTransform,
} from './editor/editorOperations'
import RuntimeView from '../apps/runtime/src/RuntimeApplication'
import Viewport, { CameraMode, GizmoMode, ViewportHandle } from './Viewport'
import ReferenceViewport from './ReferenceViewport'

const initialLoad = loadProjectWithSource()
const initialProject = initialLoad.project

export default function App() {
  const [project, setProject] = useState<ProjectData>(initialProject)
  const timelineRef = useRef(createCommandTimeline(initialProject, (state) => JSON.parse(JSON.stringify(state)) as ProjectData))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('select')
  const [scaleSpace, setScaleSpace] = useState<'world' | 'local'>('world')
  const [rotateSpace, setRotateSpace] = useState<'world' | 'local'>('world')
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  // 'single' (default) is one full-size perspective pane. 'quad' — entered via the
  // Orthographic button — shows that same pane top-left plus Top/Front/Right references.
  const [layoutMode, setLayoutMode] = useState<'quad' | 'single'>('single')
  const [singleViewOrthographic, setSingleViewOrthographic] = useState(false)
  const [showOctaOrb, setShowOctaOrb] = useState(true)
  const [showAxisIndicator, setShowAxisIndicator] = useState(true)
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
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<string>>(() => new Set([initialProject.activeSceneId]))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
  const selected = scene.objects.find((item) => item.id === selectedId) ?? null

  const toggleSceneExpanded = (id: string) => {
    setExpandedSceneIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const commit = (label: string, next: ProjectData) => {
    timelineRef.current.commit(label, next)
    setProject(timelineRef.current.current)
  }
  const resetTimeline = (next: ProjectData) => {
    timelineRef.current = createCommandTimeline(next, (state) => JSON.parse(JSON.stringify(state)) as ProjectData)
    setProject(timelineRef.current.current)
  }
  const setEnvironment = (environmentId: string) => {
    commit('Change environment', updateEditorScene(project, project.activeSceneId, { environmentId }).project)
  }
  const captureStartView = () => {
    const pose = viewportRef.current?.getCameraPose()
    if (!pose) return
    commit('Set start view', updateEditorScene(project, project.activeSceneId, { startCamera: pose }).project)
  }
  const addObject = (kind: AssetKind) => {
    const result = createEditorObject(project, scene.id, kind)
    commit('Create object', result.project)
    setSelectedId(result.objectId ?? null)
  }
  const updateSelected = (changes: Partial<SceneObject['transform']>) => {
    if (!selected) return
    commit('Update transform', updateEditorTransform(project, scene.id, selected.id, changes).project)
  }
  const moveObject = (id: string, position: [number, number, number]) => {
    commit('Move object', updateEditorTransform(project, scene.id, id, { position }).project)
  }
  const scaleObject = (id: string, scale: [number, number, number]) => {
    commit('Scale object', updateEditorTransform(project, scene.id, id, { scale }).project)
  }
  const rotateObject = (id: string, rotation: [number, number, number]) => {
    commit('Rotate object', updateEditorTransform(project, scene.id, id, { rotation }).project)
  }
  const renameSelected = (name: string) => {
    if (!selected) return
    commit('Rename object', renameEditorObject(project, scene.id, selected.id, name).project)
  }
  const deleteSelected = () => {
    if (!selected) return
    commit('Delete object', removeEditorObject(project, scene.id, selected.id).project)
    setSelectedId(null)
  }
  const duplicateSelected = () => {
    if (!selected) return
    const result = duplicateEditorObject(project, scene.id, selected.id)
    commit('Duplicate object', result.project)
    setSelectedId(result.objectId ?? null)
  }
  const setSelectedVisible = (value: boolean) => {
    if (!selected) return
    commit('Set object visibility', setEditorObjectVisible(project, scene.id, selected.id, value).project)
  }
  const setSelectedEnabled = (value: boolean) => {
    if (!selected) return
    commit('Set object enabled state', setEditorObjectEnabled(project, scene.id, selected.id, value).project)
  }
  const addScene = () => {
    const id = `scene-${project.scenes.length + 1}`
    commit('Create scene', createEditorScene(project, makeScene(id, `Room ${project.scenes.length + 1}`)).project)
  }
  const undo = () => {
    if (!timelineRef.current.canUndo) return
    timelineRef.current.undo()
    setProject(timelineRef.current.current)
  }
  const redo = () => {
    if (!timelineRef.current.canRedo) return
    timelineRef.current.redo()
    setProject(timelineRef.current.current)
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
    setSelectedId(null)
    resetTimeline(loaded.project)
    setSavedAt(loaded.source === 'default' ? 'No draft found; opened clean project' : `Loaded ${loaded.source} from this browser`)
    setPersistenceState(loaded.source === 'default' ? 'No local draft found; using clean project' : `Loaded from browser localStorage ${loaded.source}`)
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = await importProjectFile(file)
      setSelectedId(null)
      resetTimeline(imported)
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
    setSelectedId(null)
    resetTimeline(defaultProject())
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
          <button className="button subtle" onClick={undo} disabled={!timelineRef.current.canUndo}>Undo</button>
          <button className="button subtle" onClick={redo} disabled={!timelineRef.current.canRedo}>Redo</button>
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
 <div className="rail-heading"><div><span className="eyebrow">Build</span><h2>Scene</h2></div><button className="icon-button" title="Create scene" onClick={addScene}>+</button></div>          
          <div className="scene-dropdown">{project.scenes.map((item)=>{const isExpanded=expandedSceneIds.has(item.id); const isActive = item.id === scene.id; return (
            <div className="scene-group" key={item.id}>
              
              <button className="icon-button" title={isExpanded? 'Collapse object list': 'Expand object list'} onClick={()=>toggleSceneExpanded(item.id)}>
                {isExpanded? 'v':'>'}
              </button>
              
              <button className="scene-tab" title={isActive ? 'Currently editing' : `Switch to editing ${item.name}`} onClick={() => { if (!isActive) { setProject({ ...project, activeSceneId: item.id }); setSelectedId(null) } }}>
                {item.name}<span>{item.objects.length}</span>
              </button>
              
              {isExpanded && <div className="tree-list"> 
                {item.objects.length === 0 ? /*check for any objects */
                  <div className="empty-state">Your scene is empty.<br /><span>Place an asset to begin.</span></div> 
                  : item.objects.map((object) => isActive ? /* If there are objects, check if this room/scene is active */
                    <button key={object.id} className={object.id === selectedId ? 'tree-item selected' : 'tree-item'} onClick={() => setSelectedId(object.id)}><span className={`object-dot ${object.assetKind}`} />{object.name}<span className="tree-chevron">›</span></button> /* chevron to indicate active list objects*/
                    : <div key={object.id} className="tree-item reference-only" title="Switch to this room to select or edit">{object.name}</div>)}</div>}
            </div>
            )})}</div>


          
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">Library</span><h2>Assets</h2></div><span className="count">{filterAssets(assetQuery).length}/{assetCatalog.length}</span></div>
            <div className="asset-tools">
              <input aria-label="Search assets" placeholder="Search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
            </div>
            <div className="asset-list">
              {filterAssets(assetQuery).map((asset) => <button className="asset-card" key={asset.kind} onClick={() => addObject(asset.kind)}><span className={`asset-preview ${asset.kind}`}><span /></span><span className="asset-copy"><strong>{asset.label}</strong><small>{asset.detail}</small></span><span className="add-symbol">+</span></button>)}
              {filterAssets(assetQuery).length === 0 && <div className="asset-empty">No approved assets match this search.</div>}
            </div>
          </section>
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
                <button className={scaleSpace === 'local' ? 'mode active' : 'mode'} onClick={() => setScaleSpace('local')} title="Scale handles rotate with the object, so they stay on its actual faces">Local</button>
              </div>
            )}
            {gizmoMode === 'rotate' && (
              <div className="mode-switch">
                <button className={rotateSpace === 'world' ? 'mode active' : 'mode'} onClick={() => setRotateSpace('world')} title="Rotation rings stay aligned to world X/Y/Z">World</button>
                <button className={rotateSpace === 'local' ? 'mode active' : 'mode'} onClick={() => setRotateSpace('local')} title="Rotation rings rotate with the object, so they stay on its actual axes">Local</button>
              </div>
            )}
            <div className="stage-meta"><span className="live-dot" />Editor preview <span className="divider" /> {scene.name}</div>
          </div>
          <div className="view-toolbar">
            <label className="env-select"><span>Environment</span><select value={scene.environmentId} onChange={(event) => setEnvironment(event.target.value)}>{environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
            <div className="mode-switch"><button className={cameraMode === 'orbit' ? 'mode active' : 'mode'} onClick={() => setCameraMode('orbit')}>Orbit</button><button className={cameraMode === 'walk' ? 'mode active' : 'mode'} onClick={() => setCameraMode('walk')}>Walk</button></div>
            <div className="mode-switch">
              <button className={layoutMode === 'single' ? 'mode active' : 'mode'} onClick={() => { setLayoutMode('single'); setSingleViewOrthographic(false) }} title="One full-size perspective view">Perspective</button>
              <button className={layoutMode === 'quad' ? 'mode active' : 'mode'} onClick={() => setLayoutMode('quad')} title="Perspective + Top + Front + Right, all at once">Orthographic</button>
            </div>
            <div className="mode-switch">
              <button className={showOctaOrb ? 'mode active' : 'mode'} onClick={() => setShowOctaOrb((value) => !value)} title="Show or hide OctaOrb">OctaOrb</button>
              <button className={showAxisIndicator ? 'mode active' : 'mode'} onClick={() => setShowAxisIndicator((value) => !value)} title="Show or hide the axis indicator">Axes</button>
            </div>
            <div className="view-actions"><button className="button subtle" onClick={() => setResetToken((value) => value + 1)}>Reset view</button><button className="button subtle" onClick={captureStartView}>Set start view</button></div>
          </div>
          {layoutMode === 'quad' ? (
            <div className="quad-viewport">
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
                rotateSpace={rotateSpace}
                sceneId={scene.id}
                environmentId={scene.environmentId}
                startCamera={scene.startCamera}
                cameraMode={cameraMode}
                resetToken={resetToken}
                showOctaOrb={showOctaOrb}
                showAxisIndicator={showAxisIndicator}
              />
              <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="top" label="TOP" />
              <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="front" label="FRONT" />
              <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="right" label="RIGHT" />
            </div>
          ) : (
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
              rotateSpace={rotateSpace}
              sceneId={scene.id}
              environmentId={scene.environmentId}
              startCamera={scene.startCamera}
              cameraMode={cameraMode}
              resetToken={resetToken}
              orthographic={singleViewOrthographic}
              onOrthographicChange={setSingleViewOrthographic}
              showOctaOrb={showOctaOrb}
              showAxisIndicator={showAxisIndicator}
            />
          )}
          <div className="stage-footer">{cameraMode === 'walk' ? <><span><kbd>Drag</kbd> look around</span><span><kbd>WASD</kbd> walk</span><span><kbd>Click</kbd> select</span></> : <><span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> move / gizmo handle</span><span><kbd>Esc</kbd> clear selection</span></>}</div>
        </section>
        <aside className="right-rail">
          <section className="panel inspector-panel"><div className="panel-heading"><div><span className="eyebrow">Properties</span><h2>Inspector</h2></div>{selected && <span className="selection-badge">Selected</span>}</div>{selected ? <Inspector object={selected} onRename={renameSelected} onTransform={updateSelected} onDuplicate={duplicateSelected} onDelete={deleteSelected} onVisibleChange={setSelectedVisible} onEnabledChange={setSelectedEnabled} /> : <div className="inspector-empty"><div className="crosshair">＋</div><p>Select an object in the scene</p><span>Its transform will appear here.</span></div>}</section>
        </aside>
      </div>
    </main>
  )
}

const radToDeg = (radians: number) => radians * (180 / Math.PI)
const degToRad = (degrees: number) => degrees * (Math.PI / 180)

function Inspector({ object, onRename, onTransform, onDuplicate, onDelete, onVisibleChange, onEnabledChange }: { object: SceneObject; onRename: (name: string) => void; onTransform: (changes: Partial<SceneObject['transform']>) => void; onDuplicate: () => void; onDelete: () => void; onVisibleChange: (value: boolean) => void; onEnabledChange: (value: boolean) => void }) {
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
  return <div className="inspector-content"><label className="field-group"><span>Object name</span><input value={object.name} onChange={(event) => onRename(event.target.value)} /></label><div className="asset-id"><span className={`object-dot ${object.assetKind}`} />{object.assetId}<span>Library asset</span></div><div className="toggle-row"><label><input type="checkbox" checked={object.visible} onChange={(event) => onVisibleChange(event.target.checked)} /> Visible</label><label><input type="checkbox" checked={object.enabled} onChange={(event) => onEnabledChange(event.target.checked)} /> Enabled</label></div>{vectorInput('Position', object.transform.position, 'position')}{vectorInput('Rotation', object.transform.rotation, 'rotation')}{vectorInput('Scale', object.transform.scale, 'scale')}<div className="inspector-actions"><button className="button subtle" onClick={onDuplicate}>Duplicate</button><button className="button ghost" onClick={onDelete}>Delete</button></div></div>
}
