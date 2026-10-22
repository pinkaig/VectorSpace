/**
 * @file       EditorPage.tsx
 * @project    Spatial Experience Builder
 * @author     Sherman Goh Wee Hao
 * @author     Goh Pin Kai
 * @brief      Coordinates the 3D editor interface, including scene management,
 *             object selection and transformations, asset importing,
 *             viewport controls, project saving, undo/redo operations,
 *             and switching between editor and simulation modes.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/

import { useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Box, ChevronDown, Music, Plus, X } from 'lucide-react'
import { collectSubtreeIds } from '@vectorspace/authoring-engine'
import { ProjectData, SceneObject, environmentLibrary } from '../project/model'
import { downloadProject, loadProjectWithSource, type ProjectLoadResult } from '../project/serializer'
import { assetCatalog, countAssetUses, filterAssets } from '../content/assets'
import { isUserAsset } from '../content/userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets } from '../content/audioAssets'
import { isUserAudioAsset } from '../content/userAudio'
import { selectEditorScene } from '../editor/editorOperations'
import { ObjectPanel, type Vec3 } from '../sections/objectPanel/objectPanel'
import { WhenDoRuleSection } from '../sections/objectPanel/WhenDoRuleSection'
import type { ClickRuleChoice } from '../editor/ruleEditorOperations'
import { buildSceneTree, previousSibling } from '../editor/sceneTree'
import RuntimeView from '../../apps/runtime/src/RuntimeApplication'
import Viewport, { ViewportHandle, viewportHintText, type ViewPreset, type WallCut } from '../viewport/Viewport'
import ReferenceViewport from '../viewport/ReferenceViewport'
import { overlayDims } from '../viewport/editing/overlayWidgets'
import { useEditorHistory } from '../editor/hooks/useEditorHistory'
import { useViewportSettings } from '../editor/hooks/useViewportSettings'
import { useAutosave } from '../editor/hooks/useAutosave'
import { MissionBriefPanel } from '../sections/missionBrief/MissionBriefPanel'
import { useUserAssets } from '../editor/hooks/useUserAssets'
import { useUserAudio } from '../editor/hooks/useUserAudio'
import { useBlockStrayFileDrop } from '../editor/hooks/useBlockStrayFileDrop'
import { useSceneEditing } from '../editor/hooks/useSceneEditing'
import { useProjectFile } from '../editor/hooks/useProjectFile'
import { homePath, useSession } from '../session/session'
import { useStressTestKey } from '../debug/stressTest' // STRESS TEST — comment out with the call below


// which page the visitor is on is the router's job (src/App.tsx); this is only whether
// the editor or its simulation is showing
type ViewMode =
  | 'editor'
  | 'runtime'


/* Variables and data for "Tutorial" where we can give students a step-by-step for giving them instructions on how to use */

export type TutorialStep = 1|2|3|4
export type CurrentStep = 1|2|3|4|5

export const tutorialSteps: {step: TutorialStep; label:string}[] =[
  {step: 1, label:'Place things'},
  {step: 2, label:'Add info'},
  {step: 3, label:'Make it react'},
  {step: 4, label:'Play and share'}
]

/** Testing only const Change this to advance the tutorial buttons*/
const TESTING_TUTORIAL: CurrentStep=2
/** Testing only const*/

export function useSimpleSteps(startAt:CurrentStep=TESTING_TUTORIAL) {
  const [currentStep, setCurrentStep] = useState<CurrentStep>(startAt)
  const [TUTStep, setTUTStep] = useState<TutorialStep>(Math.min(startAt, 4) as TutorialStep)
 
  // Finishing the current step opens the next one and moves the view to it.
  const completeStep = (n: TutorialStep) => {
    if (n !== currentStep) return
    setCurrentStep((n + 1) as CurrentStep)
    setTUTStep(Math.min(n + 1, 4) as TutorialStep)
  }

  const viewStep = (n: TutorialStep) => {
    if (n <= currentStep) setTUTStep(n)
  }

  return { currentStep, TUTStep, completeStep, viewStep }
}
/**End of Tutorial assisting code for the UI */





/** Catalogue assistance code */
export type CatalogueIDTypes = 'exhibits' | 'signs' | 'misc'

export const catalogueCategories: { id: CatalogueIDTypes; label: string; singular: string }[] = [
    { id: 'exhibits', label: 'Exhibits', singular: 'Exhibit' },
    { id: 'signs', label: 'signs', singular: 'sign' },
    { id: 'misc', label: 'misc', singular: 'misc' },
]


const VIEW_PRESETS: { preset: ViewPreset; label: string }[] = [
  { preset: 'angled', label: 'Angled' },
  { preset: 'top', label: 'Top' },
  { preset: 'front', label: 'Front' },
  { preset: 'side', label: 'Side' },
]
// The viewport's snapped-face label for each preset; any other snap (LEFT, edges) lights none.
const FACE_LABEL_PRESET: Record<string, ViewPreset> = { TOP: 'top', FRONT: 'front', RIGHT: 'side' }
const WALL_CUT_LABEL: Record<WallCut, string> = { full: 'Full', half: 'Half', low: 'Low' }
const NEXT_WALL_CUT: Record<WallCut, WallCut> = { full: 'half', half: 'low', low: 'full' } 
// Gap between a floating control group and the corner widget it sits beside.
const FLOAT_GAP = 5

// start: the project to open, when the caller already has one (from the server); without it
// the page opens the draft saved in this browser
export default function EditorPage({ start }: { start?: ProjectLoadResult } = {}) {
  const navigate = useNavigate()
  // Read the saved draft once per mount, not once at import. This page unmounts when the
  // visitor leaves /editor, and coming back must start from the latest autosave; a
  // module-level read would hand back the first visit's data and autosave would then
  // write that over the newer draft.
  const [initialLoad] = useState(() => start ?? loadProjectWithSource())
  const initialProject = initialLoad.project
  // Bumped when an edit is rejected, to pull the viewport's preview meshes back
  // to ProjectData. See runCommand.
  const [syncToken, setSyncToken] = useState(0)
  const bumpSync = () => setSyncToken((value) => value + 1)
  const { project, timelineRef, commit, runCommand, resetTimeline, undo, redo } = useEditorHistory(initialProject, bumpSync)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // the editor step, Position = 1, Info = 2, Reactions = 3. The object panel's tabs set it
  // now, and the top bar's step strip will share this same value when it lands.
  const [step, setStep] = useState(1)
  // the object panel's snap switch; not read by the viewport yet
  const [snapOn, setSnapOn] = useState(false)
  const {
    gizmoMode, setGizmoMode,
    scaleSpace, setScaleSpace,
    rotateSpace, setRotateSpace,
    cameraMode, setCameraMode,
    layoutMode, setLayoutMode,
    singleViewOrthographic, setSingleViewOrthographic,
    showOctaOrb, setShowOctaOrb,
    showAxisIndicator, setShowAxisIndicator,
    showStats, setShowStats,
    resetToken, setResetToken,
  } = useViewportSettings()
  const { savedAt, setSavedAt, persistenceState, setPersistenceState, syncStatus, syncStatusLabel, save } = useAutosave(project, initialLoad.source)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [assetQuery, setAssetQuery] = useState('')
  const [LeftTabs, SetLeftTab] = useState<'scenes' | 'assets' | 'interactions'>('scenes') //for tabs on left column
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<string>>(() => new Set([initialProject.activeSceneId]))
  const { visibleAssets, assetNotice, setAssetNotice, importModelFiles, keepOriginalModel, deleteUserAsset } = useUserAssets(project, bumpSync)
  const { audioCatalogToken, audioNotice, setAudioNotice, importAudioFiles, deleteUserAudio } = useUserAudio(project)
  const [isDraggingAsset, setIsDraggingAsset] = useState(false)
  const assetDragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
  const [walls, setWalls] = useState<WallCut>('full')
  // the bottom-left "Things in this room" list starts folded so it does not cover the room
  const [thingsOpen, setThingsOpen] = useState(false)
  // Snapped face reported by the viewport; null means a free (angled) view.
  const [viewLabel, setViewLabel] = useState<string | null>(null)
  const activeViewPreset: ViewPreset | null = viewLabel === null ? 'angled' : FACE_LABEL_PRESET[viewLabel] ?? null
  // Floating groups step aside for the OctaOrb (top-right) and axis indicator (bottom-left),
  // which only cover the stage corners in the single layout.
  const dims = overlayDims(false)
  const cornerWidgetsShown = layoutMode === 'single' && cameraMode === 'orbit'
  const octaOrbClearance = cornerWidgetsShown && showOctaOrb ? dims.octaOrb + FLOAT_GAP : FLOAT_GAP
  const axisClearance = cornerWidgetsShown && showAxisIndicator ? dims.axisIndicator + FLOAT_GAP : FLOAT_GAP
  // The Advanced menu closes on any press outside its corner group, like a dropdown.
  // Only the menu closes: its settings stay as chosen.
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState(false)
  const advancedMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!advancedMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!advancedMenuRef.current?.contains(event.target as Node)) setAdvancedMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [advancedMenuOpen])
  const scene =project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
  const selected = scene.objects.find((item) => item.id === selectedId) ?? null
  useBlockStrayFileDrop()

  const isFileDrag = (event: ReactDragEvent) => event.dataTransfer.types.includes('Files')

  const toggleSceneExpanded = (id: string) => {
    setExpandedSceneIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  


  const {
    setEnvironment, captureStartView, addObject, updateSelected, moveObject, scaleObject, rotateObject,
    renameSelected, setSelectedAssetId, deleteSelected, duplicateSelected, reparentObjectTo,
    indentObject, outdentObject, setSelectedVisible, setSelectedEnabled,
    addSelectedClickRule, removeRuleById, addScene, addRoom,
  } = useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef })
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo } = useProjectFile({
    project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef,
  })

  const { currentStep, TUTStep, viewStep } = useSimpleSteps()
  const [category,setCategory]=useState<CatalogueIDTypes>('exhibits')

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
        {/* project name + room; opens "Your rooms" (SceneRoomPopUp, at the end of this file) */}
        <SceneRoomPopUp
          project={project}
          onSelectScene={(id) => {
            commit('Select scene', selectEditorScene(project, id).project)
            setSelectedId(null)
          }}
          onAddRoom={addRoom}
        />
        <div className="top-actions"> {/**** Top bar buttons *****/}

        <nav className="Tutorial-steps"> {/** tutorial buttons */}
        {tutorialSteps.map(({ step: n, label }) => {
          const locked = n > currentStep
          const viewing = n === TUTStep
          const colour = locked ? 'locked' : viewing? 'viewing' : 'green'
          const title = locked ? `Step ${n}: ${label} (finish step ${n - 1} first)` : `Step ${n}: ${label}`
          return (
            <button
              key={n}
              className={`button button--${colour}`}
              disabled={locked}
              title={title}
              onClick={() => viewStep(n)}
            >
            <span className="button-num">{n}</span>
              {label}
            </button>
                  )})}
        </nav>
          <button className="button subtle" onClick={() => navigate('/teacher')}>Home</button>
          <button className="button subtle" onClick={undo} disabled={!timelineRef.current.canUndo}>Undo</button>
          <button className="button subtle" onClick={redo} disabled={!timelineRef.current.canRedo}>Redo</button>
          <button className="button ghost" onClick={loadDraft}>Load draft</button>
          <button className="button ghost" onClick={loadAudioDemo} disabled={isAudioDemoLoaded} title={isAudioDemoLoaded ? 'Audio demo is already loaded in this project' : 'Add the bundled audio demo zones, rules, and SFX targets'}>{isAudioDemoLoaded ? 'Audio demo loaded' : 'Load audio demo'}</button>
          <button className="button primary" onClick={save}>Save project</button>
          <button className="button primary" onClick={() => setViewMode('runtime')}>Play</button>
        </div>
      </header>
      <div className="workspace">
        {/* TURNED OFF: left rail (Scene / Assets / Audio / Interactions panels) was removed so the
            editor is viewport + catalogue. Full code is in git commit 68caea5, EditorPage.tsx
            lines 268-499; the LeftTabs state above is still here for it. */}
        <section className="center-stage">
          {/* The viewport fills the stage; every control floats over one of its corners. */}
          <div className={layoutMode === 'quad' ? 'stage-canvas compact' : 'stage-canvas'} style={{ '--float-gap': `${FLOAT_GAP}px` } as CSSProperties}>
          {/*
            Keep both layouts mounted and toggle visibility with CSS.
            This avoids recreating WebGL contexts and reloading shaders,
            geometry, and textures whenever the layout changes.
          */}
          <div className={layoutMode === 'quad' ? 'quad-viewport' : 'quad-viewport single-mode'}>
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
              syncToken={syncToken}
              // The quad layout's main pane is always perspective - only the three reference
              // panes go orthographic - matching the "Perspective + Top + Front + Right" label.
              orthographic={layoutMode === 'quad' ? false : singleViewOrthographic}
              onOrthographicChange={layoutMode === 'quad' ? undefined : setSingleViewOrthographic}
              showOctaOrb={showOctaOrb}
              showAxisIndicator={showAxisIndicator}
              showStats={showStats}
              textAssets={project.textAssets ?? []}
              compactOverlays={layoutMode === 'quad'}
              walls={walls}
              onViewLabelChange={setViewLabel}
              showHint={false}
            />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="top" label="TOP" />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="front" label="FRONT" />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="right" label="RIGHT" />
          </div>

          {/* Top-left: transform tools */}
          <div className="floating-controls top-left">
            <div className="float-group">
              <button className={gizmoMode === 'select' ? 'float-button active' : 'float-button'} onClick={() => setGizmoMode('select')}>Select</button>
              <button className={gizmoMode === 'move' ? 'float-button active' : 'float-button'} onClick={() => setGizmoMode('move')}>Move</button>
              <button className={gizmoMode === 'rotate' ? 'float-button active' : 'float-button'} onClick={() => setGizmoMode('rotate')}>Rotate</button>
              <button className={gizmoMode === 'scale' ? 'float-button active' : 'float-button'} onClick={() => setGizmoMode('scale')}>Scale</button>
            </div>
            {gizmoMode === 'scale' && (
              <div className="float-group">
                <button className={scaleSpace === 'world' ? 'float-button active' : 'float-button'} onClick={() => setScaleSpace('world')} title="Scale handles stay aligned to world X/Y/Z">World</button>
                <button className={scaleSpace === 'local' ? 'float-button active' : 'float-button'} onClick={() => setScaleSpace('local')} title="Scale handles rotate with the object, so they stay on its actual faces">Local</button>
              </div>
            )}
            {gizmoMode === 'rotate' && (
              <div className="float-group">
                <button className={rotateSpace === 'world' ? 'float-button active' : 'float-button'} onClick={() => setRotateSpace('world')} title="Rotation rings stay aligned to world X/Y/Z">World</button>
                <button className={rotateSpace === 'local' ? 'float-button active' : 'float-button'} onClick={() => setRotateSpace('local')} title="Rotation rings rotate with the object, so they stay on its actual axes">Local</button>
              </div>
            )}
          </div>

          {/* Top-left, under the tools: the students' mission brief, when the teacher set one */}
          {project.missionBrief && <MissionBriefPanel brief={project.missionBrief} project={project} />}

          {/* Top-right: view angles, left of the OctaOrb so they never cover it */}
          <div className="floating-controls top-right" style={{ right: octaOrbClearance }}>
            <div className="float-group">
              <span className="float-label">View</span>
              {VIEW_PRESETS.map(({ preset, label }) => (
                <button key={preset} className={activeViewPreset === preset ? 'float-button active' : 'float-button'} disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.setViewPreset(preset)}>{label}</button>
              ))}
            </div>
          </div>
          {/* Bottom-left: Room drop down (UP?) environment and start view, right of the axis indicator */}
          <div className="floating-controls bottom-left" style={{ left: axisClearance }} ref={advancedMenuRef}>
            {/*advancedMenuOpen && (
              <div className="float-group float-menu">
                <span className="float-menu-label">Camera</span>
                <div className="float-segment">
                  <button className={cameraMode === 'orbit' ? 'active' : ''} onClick={() => setCameraMode('orbit')}>Orbit</button>
                  <button className={cameraMode === 'walk' ? 'active' : ''} onClick={() => setCameraMode('walk')}>Walk</button>
                </div>
                <span className="float-menu-label">Layout</span>
                <div className="float-segment">
                  <button className={layoutMode === 'single' ? 'active' : ''} onClick={() => { setLayoutMode('single'); setSingleViewOrthographic(false) }} title="One full-size perspective view">Single</button>
                  <button className={layoutMode === 'quad' ? 'active' : ''} onClick={() => setLayoutMode('quad')} title="Perspective + Top + Front + Right, all at once">Quad</button>
                </div>
                <span className="float-menu-label">Show</span>
                <div className="float-segment">
                  <button className={showOctaOrb ? 'active' : ''} onClick={() => setShowOctaOrb((value) => !value)} title="Show or hide OctaOrb">Orb</button>
                  <button className={showAxisIndicator ? 'active' : ''} onClick={() => setShowAxisIndicator((value) => !value)} title="Show or hide the axis indicator">Axes</button>
                  <button className={showStats ? 'active' : ''} onClick={() => setShowStats((value) => !value)} title="Show or hide FPS and object count">Stats</button>
                </div>
              </div>
            )*/}
            {/* One box: "Things in this room" (folded until clicked) over the room picker. The list
                is the old Scene panel's object tree (commit 68caea5), for this room only. */}
            <div className="float-group things-in-room">
              <button className="float-button things-toggle" aria-expanded={thingsOpen} onClick={() => setThingsOpen((open) => !open)}>
                Things in this room · {scene.objects.length}<span>{thingsOpen ? '▾' : '▴'}</span>
              </button>
              {thingsOpen && <div className="tree-list">{scene.objects.length === 0 ? <div className="empty-state">Your scene is quiet.<br /><span>Place an asset to begin.</span></div> : buildSceneTree(scene.objects).map((row) => (
                <div key={row.object.id} className={row.object.id === selectedId ? 'tree-item selected' : 'tree-item'} style={{ paddingLeft: row.depth * 16 }}>
                  <div className="tree-indent-controls">
                    <button className="tree-indent-btn" title="Outdent" disabled={row.object.parentId === undefined} onClick={() => outdentObject(row.object.id)}>⇤</button>
                    <button className="tree-indent-btn" title="Indent under previous sibling" disabled={previousSibling(scene.objects, row.object.id) === null} onClick={() => indentObject(row.object.id)}>⇥</button>
                  </div>
                  <button className="tree-item-select" onClick={() => setSelectedId(row.object.id)}>
                    <span className={`object-dot ${row.object.assetKind}`} />{row.object.name}<span className="tree-chevron">›</span>
                  </button>
                </div>
              ))}</div>}
              {/* the room picker (switches this room's environment), along the bottom of the same box */}
              <label className="float-select"><span className="float-label">Room </span><select value={scene.environmentId} onChange={(event) => setEnvironment(event.target.value)}>{environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
              {/*<button className="float-button" onClick={() => setResetToken((value) => value + 1)} title="Go back to this scene's start view">Reset view</button>
              <button className="float-button" onClick={captureStartView} title="Use the current camera as this scene's start view">Set start view</button>
              <button className={advancedMenuOpen ? 'float-button active' : 'float-button'} onClick={() => setAdvancedMenuOpen((open) => !open)} title="Camera mode, layout and overlay settings">Advanced {advancedMenuOpen ? '▾' : '▴'}</button>*/}
            </div>
          </div>

          {/* Bottom-right: zoom, walls, framing */}
          <div className="floating-controls bottom-right">
            <div className="float-group">
              <button className="float-button icon" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.zoomBy(0.8)} title="Zoom in">+</button>
              <button className="float-button icon" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.zoomBy(1.25)} title="Zoom out">−</button>
              <button className="float-button" onClick={() => setWalls(NEXT_WALL_CUT[walls])} title="Cut the room's walls down so you can see inside">Walls: {WALL_CUT_LABEL[walls]}</button>
              <button className="float-button" disabled={!selected || cameraMode !== 'orbit'} onClick={() => viewportRef.current?.focusSelected()} title="Frame the selected object">◎ Focus <kbd>F</kbd></button>
              <button className="float-button" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.frameAll()} title="Frame the whole room">⛶ Whole room <kbd>H</kbd></button>
            </div>
          </div>
          </div>
          <div className="stage-footer">{cameraMode === 'walk' ? <><span><kbd>Drag</kbd> look around</span><span><kbd>WASD</kbd> walk</span><span><kbd>Click</kbd> select</span></> : <><span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> move / gizmo handle</span><span><kbd>Esc</kbd> clear selection</span></>}<span className="stage-footer-hint">{viewportHintText(cameraMode, true, gizmoMode)}</span></div>
        </section>
        {selected && TUTStep >= 2 && <aside className="inspector-popup">
          <section className="panel inspector-panel"><div className="panel-heading"><div><span className="eyebrow">Properties</span><h2>Inspector</h2></div>{selected && <span className="selection-badge">Selected</span>}</div>{selected ? <Inspector object={selected} sceneObjects={scene.objects} onRename={renameSelected} onTransform={updateSelected} onDuplicate={duplicateSelected} onDelete={deleteSelected} onVisibleChange={setSelectedVisible} onEnabledChange={setSelectedEnabled} onReparent={(parentId) => reparentObjectTo(selected.id, parentId)} onAssetIdChange={setSelectedAssetId} onAddClickRule={addSelectedClickRule} rules={(project.rules ?? []).filter((rule) => rule.objectId === selected.id)} onRemoveRule={removeRuleById} /> : <div className="inspector-empty"><div className="crosshair">＋</div><p>Select an object in the scene</p><span>Its transform will appear here.</span></div>}</section>
        </aside>}
      </div>
      <section className="catalogue">
        <div className="catalogue-head">
          <h2>Catalogue</h2>
            <div className="catalogue-types" role="tablist">
              {catalogueCategories.map((item)=>{
               /* wait for asset panel assistance on moving over? const selected = item.id=== category*/
                  const selected = item.id ===category
                  const classes =['chip']
                  if(selected) classes.push('is-selected')
                  return (
                    <button
                    className={classes.join(' ')}
                    key ={item.label}
                    role="tab"
                    title={`${item.label}`}
                    onClick={()=>{setCategory(item.id);}}
                    >{item.id}</button>
                  )
              })}
            </div>
            <div role="tabpanel">
              {/**add no items found part here */}
              <input aria-label="Search assets" placeholder="Search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
                <div className="catalogue-list">
                  {filterAssets(assetQuery, visibleAssets).map((asset) => (
                    <button className="asset-card" key={asset.assetId} onClick={() => addObject(asset)}>
                      <span className={`asset-preview ${asset.kind}`}><span /></span>
                      <span className="asset-copy"><strong>{asset.label}</strong><small>{asset.detail}</small></span>
                      {isUserAsset(asset.assetId)
                        ? (() => {
                            const uses = countAssetUses(project, asset.assetId)
                            return (
                              <span
                                className={uses > 0 ? 'icon-button in-use' : 'icon-button'}
                                aria-disabled={uses > 0}
                                title={uses > 0 ? `In use by ${uses} object${uses === 1 ? '' : 's'} - delete ${uses === 1 ? 'it' : 'them'} to remove this asset` : 'Remove imported asset'}
                                onClick={(event) => { event.stopPropagation(); void deleteUserAsset(asset) }}
                              >×</span>
                            )
                          })()
                        : <span className="add-symbol">+</span>}
                    </button>
                  ))}
                  {filterAssets(assetQuery, visibleAssets).length === 0 && <div className="asset-empty">No approved assets match this search.</div>}
                </div>
            </div>
        </div>
      </section>
    </main>
  )
}

const radToDeg = (radians: number) => radians * (180 / Math.PI)
const degToRad = (degrees: number) => degrees * (Math.PI / 180)

function Inspector({ object, sceneObjects, onRename, onTransform, onDuplicate, onDelete, onVisibleChange, onEnabledChange, onReparent, onAssetIdChange, onAddClickRule, rules, onRemoveRule }: { object: SceneObject; sceneObjects: SceneObject[]; onRename: (name: string) => void; onTransform: (changes: Partial<SceneObject['transform']>) => void; onDuplicate: () => void; onDelete: () => void; onVisibleChange: (value: boolean) => void; onEnabledChange: (value: boolean) => void; onReparent: (parentId: string | null) => void; onAssetIdChange: (assetId: string) => void; onAddClickRule: (choice: ClickRuleChoice) => void; rules: NonNullable<ProjectData['rules']>; onRemoveRule: (ruleId: string) => void }) {
  // An object cannot become its own or its own descendant's parent, or the tree would cycle.
  const excludedParentIds = collectSubtreeIds(sceneObjects, object.id)
  const parentChoices = sceneObjects.filter((item) => !excludedParentIds.has(item.id))
  // A parented object's transform is local to its parent; a top-level object's
  // transform is already world space (there's no parent to be local to).
  const spaceLabel = object.parentId !== undefined ? 'local' : 'world'
  const vectorInput = (label: string, values: [number, number, number], key: 'position' | 'rotation' | 'scale') => {
    const isRotation = key === 'rotation'
    const displayValues = isRotation ? values.map(radToDeg) : values
    return (
      <div className="field-group">
        <label>{isRotation ? `${label} (°, ${spaceLabel})` : `${label} (${spaceLabel})`}</label>
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
  return <div className="inspector-content"><label className="field-group"><span>Object name</span><input value={object.name} onChange={(event) => onRename(event.target.value)} /></label><label className="field-group"><span>Parent</span><select value={object.parentId ?? ''} onChange={(event) => onReparent(event.target.value === '' ? null : event.target.value)}><option value="">None (top-level)</option>{parentChoices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-group"><span>Asset ID</span><input onChange={(event) => onAssetIdChange(event.target.value)} /></label><div className="asset-id"><span className={`object-dot ${object.assetKind}`} />Library asset</div><div className="toggle-row"><label><input type="checkbox" checked={object.visible} onChange={(event) => onVisibleChange(event.target.checked)} /> Visible</label><label><input type="checkbox" checked={object.enabled} onChange={(event) => onEnabledChange(event.target.checked)} /> Enabled</label></div>{vectorInput('Position', object.transform.position, 'position')}{vectorInput('Rotation', object.transform.rotation, 'rotation')}{vectorInput('Scale', object.transform.scale, 'scale')}<WhenDoRuleSection rules={rules} onAdd={onAddClickRule} onRemove={onRemoveRule} /><div className="inspector-actions"><button className="button subtle" onClick={onDuplicate}>Duplicate</button><button className="button ghost" onClick={onDelete}>Delete</button></div></div>
}

/*
 * The top-left of the editor: the cube (back to the home page), the project button
 * ("Dinosaur museum / Room 1 · Entrance hall") and the "Your rooms" popup it opens:
 *   - a 3x3 grid: the STARTING ROOM (the project's first room) always in the middle, one room
 *     at most on each of its four sides, "+" on the free sides, corners empty. The grid never
 *     moves; the room being edited is the purple one.
 *   - background music and volume for the room being edited
 * HOW A ROOM REMEMBERS ITS SIDE: "+" makes the room with the id of that side (room-right,
 * room-below, room-left, room-above; see ROOM_SIDES), so its place is saved with the project
 * without any new field. Only these five rooms exist: the starting room and one per side.
 * (A room with any other id, left in an old draft, is not shown.)
 * FOR NOW: doors between rooms are not built, and music and volume are ON SCREEN ONLY
 * (they highlight per room, but nothing is saved or played).
 */
interface RoomPopupProps {
  project: ProjectData
  // go to (start editing) another room
  onSelectScene: (sceneId: string) => void
  // add a room with this id, staying in the current one
  onAddRoom: (sceneId: string) => void
}

// The four sides of the starting room: the id a room on that side gets, where it sits in the
// 3x3 grid, and how the note describes it.
const ROOM_SIDES = [
  { id: 'room-above', row: 1, col: 2, words: 'above the starting room' },
  { id: 'room-left', row: 2, col: 1, words: 'left of the starting room' },
  { id: 'room-right', row: 2, col: 3, words: 'right of the starting room' },
  { id: 'room-below', row: 3, col: 2, words: 'below the starting room' },
] as const

const MUSIC_OPTIONS = ['None', 'Museum hum', 'Soft piano'] as const
const VOLUME_OPTIONS = ['Quiet', 'Normal', 'Loud'] as const
type RoomSound = { music: (typeof MUSIC_OPTIONS)[number]; volume: (typeof VOLUME_OPTIONS)[number] }
const DEFAULT_ROOM_SOUND: RoomSound = { music: 'Museum hum', volume: 'Quiet' }

function SceneRoomPopUp({ project, onSelectScene, onAddRoom }: RoomPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  // the side a room was just added on, so the note under the grid can say where it went
  const [justAdded, setJustAdded] = useState<string | null>(null)
  // ON SCREEN ONLY: music and volume per room, by room id
  const [sounds, setSounds] = useState<Record<string, RoomSound>>({})
  const anchorRef = useRef<HTMLDivElement>(null)
  // the cube goes home: /teacher for a teacher, /student for a student (the same rule as sign-in)
  const { role, admin } = useSession()
  const home = role ? homePath(role, admin) : '/'

  // Escape, or a click anywhere outside, closes it
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsOpen(false)
    const onPointer = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [isOpen])

  // "Room 2 · Fossil lab": numbered in the order the rooms were made
  const labelOf = (sceneId: string) => {
    const index = project.scenes.findIndex((scene) => scene.id === sceneId)
    return `Room ${index + 1} · ${project.scenes[index].name}`
  }
  const current = project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0]
  const starting = project.scenes[0]
  const hasRoom = (sceneId: string) => project.scenes.some((scene) => scene.id === sceneId)

  const sound = sounds[current.id] ?? DEFAULT_ROOM_SOUND
  const setSound = (change: Partial<RoomSound>) => setSounds((all) => ({ ...all, [current.id]: { ...sound, ...change } }))

  const addRoom = (sideId: string) => {
    onAddRoom(sideId)
    setJustAdded(sideId)
  }
  const goTo = (sceneId: string) => {
    if (sceneId !== current.id) onSelectScene(sceneId)
    setJustAdded(null)
  }

  // one room in the grid: purple if it is being edited, green to go there
  const roomButton = (sceneId: string, place: { gridRow: number; gridColumn: number }) => {
    const isCurrent = sceneId === current.id
    return (
      <button
        key={sceneId}
        type="button"
        className={`rooms-cell ${isCurrent ? 'rooms-cell-current' : 'rooms-cell-other'}`}
        style={place}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={() => goTo(sceneId)}
      >
        {labelOf(sceneId)}{isCurrent ? '' : ' →'}
      </button>
    )
  }
  const justAddedSide = ROOM_SIDES.find((side) => side.id === justAdded && hasRoom(side.id))

  return (
    <div className="rooms-anchor" ref={anchorRef}>
      {/* THE CUBE: back to the home page (the editor saves as you go, so nothing is lost) */}
      <Link to={home} className="rooms-home" aria-label="Back to home" title="Back to home"><Box size={20} /></Link>

      {/* THE BUTTON: project name, then which room is being edited; opens "Your rooms" */}
      <button type="button" className="rooms-trigger" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <span className="rooms-trigger-text">
          <strong>{project.name}</strong>
          <span className="rooms-trigger-room">{labelOf(current.id)} <ChevronDown size={14} /></span>
        </span>
      </button>

      {isOpen && (
        <div className="rooms-popup" role="dialog" aria-label="Your rooms">
          {/* TITLE and close */}
          <div className="rooms-head">
            <div>
              <h2 className="rooms-title">Your rooms</h2>
              <p className="rooms-sub">Tap a + to add a room on that side. A door appears on that wall.</p>
            </div>
            <button type="button" className="rooms-close" aria-label="Close rooms" onClick={() => setIsOpen(false)}><X size={16} /></button>
          </div>

          {/* THE GRID: starting room in the middle, a room or "+" on each side; never moves */}
          <div className="rooms-grid">
            {roomButton(starting.id, { gridRow: 2, gridColumn: 2 })}
            {ROOM_SIDES.map((side) => {
              const place = { gridRow: side.row, gridColumn: side.col }
              return hasRoom(side.id) ? roomButton(side.id, place) : (
                <button key={side.id} type="button" className="rooms-cell rooms-cell-add" style={place} aria-label={`Add a room ${side.words}`} onClick={() => addRoom(side.id)}>
                  <Plus size={18} />
                </button>
              )
            })}
          </div>

          {/* NOTE: where the room just added went */}
          {justAddedSide && (
            <p className="rooms-note">
              {labelOf(justAddedSide.id)} is {justAddedSide.words}. Click it to start building there.
            </p>
          )}

          {/* BACKGROUND MUSIC for the room being edited (on screen only for now) */}
          <div className="rooms-music">
            <div className="rooms-music-head">
              <Music size={18} />
              <h3>Background music · {current.name}</h3>
            </div>
            <p className="rooms-sub">Loops softly while visitors are in this room.</p>
            <RoomChoiceRow label="Music" options={MUSIC_OPTIONS} value={sound.music} onPick={(music) => setSound({ music })} />
            <RoomChoiceRow label="Volume" options={VOLUME_OPTIONS} value={sound.volume} onPick={(volume) => setSound({ volume })} />
          </div>
        </div>
      )}
    </div>
  )
}

// a label, then a row of buttons where the picked one is purple
function RoomChoiceRow<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (value: T) => void }) {
  return (
    <div className="rooms-choice" role="group" aria-label={label}>
      <span className="rooms-choice-label">{label}</span>
      <div className="rooms-choice-options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            className={`rooms-choice-option ${option === value ? 'rooms-choice-on' : ''}`}
            onClick={() => onPick(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
