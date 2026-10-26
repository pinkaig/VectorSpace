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
import { useNavigate } from 'react-router'
import { AlertTriangle, Box, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Cylinder, MoreHorizontal, Pencil, Play, Redo2, Settings, Undo2, X, type LucideIcon } from 'lucide-react'
import { collectSubtreeIds } from '@vectorspace/authoring-engine'
import { ProjectData, SceneObject, environmentLibrary, type AssetKind } from '../project/model'
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
import { cellBeside, roomAt, roomCell, ROOM_SIDES, type RoomSide } from '../editor/roomLayout'
import RuntimeView from '../../apps/runtime/src/RuntimeApplication'
import Viewport, { ViewportHandle, viewportHintText, type ViewPreset, type WallCut } from '../viewport/Viewport'
import ReferenceViewport from '../viewport/ReferenceViewport'
import { useEditorHistory } from '../editor/hooks/useEditorHistory'
import { useViewportSettings } from '../editor/hooks/useViewportSettings'
import { useAutosave } from '../editor/hooks/useAutosave'
import { useUserAssets } from '../editor/hooks/useUserAssets'
import { useUserAudio } from '../editor/hooks/useUserAudio'
import { useBlockStrayFileDrop } from '../editor/hooks/useBlockStrayFileDrop'
import { useSceneEditing } from '../editor/hooks/useSceneEditing'
import { useProjectFile } from '../editor/hooks/useProjectFile'
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

const MUSIC_OPTIONS = ['None', 'Museum hum', 'Soft piano']
const VOLUME_OPTIONS = ['Quiet', 'Normal', 'Loud']

interface RoomPopupProps {
  project: ProjectData
  onSelectScene: (sceneId: string) => void
  onAddRoom: (side: RoomSide) => void
  onDeleteRoom: (sceneId: string) => void
  onMoveRoom: (sceneId: string, step: -1 | 1) => void
  onRenameRoom: (sceneId: string, name: string) => void
  onEnvironmentChange: (environmentId: string) => void
}

type RoomPopupTab = 'rooms' | 'style' | 'music'

// Fits the room box; the project file itself allows up to 200 characters.
const ROOM_NAME_MAX = 40




/** Catalogue assistance code */
export type CatalogueIDTypes = 'exhibits' | 'signs' | 'misc'

export const catalogueCategories: { id: CatalogueIDTypes; label: string; singular: string }[] = [
    { id: 'exhibits', label: 'Exhibits', singular: 'Exhibit' },
    { id: 'signs', label: 'Signs', singular: 'Sign' },
    { id: 'misc', label: 'Misc', singular: 'Misc' },
]

// Catalogue card icon per asset kind; the tile colour cycles so neighbouring cards differ.
const catalogueIcons: Record<AssetKind, LucideIcon> = { model: Box, cube: Box, sphere: Circle, cylinder: Cylinder }
const catalogueTileColours = ['lilac', 'mint', 'peach', 'sky', 'rose']


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
// Gap between a floating control group and the stage edge.
const FLOAT_GAP = 5
// The viewport's right-edge widget column (OctaOrb, axis indicator, stats) starts below the
// View bar: FLOAT_GAP + the bar's 46px height + a little air.
const VIEW_BAR_CLEARANCE = 58

// start: the project to open, when the caller already has one (from the server); without it
// the page opens the draft saved in this browser
export default function EditorPage({ start }: { start?: ProjectLoadResult } = {}) {
  const navigate = useNavigate()
  const goHome = () => navigate('/student')
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
    resetToken,
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
  // Snapped face reported by the viewport; null means a free (angled) view.
  const [viewLabel, setViewLabel] = useState<string | null>(null)
  const activeViewPreset: ViewPreset | null = viewLabel === null ? 'angled' : FACE_LABEL_PRESET[viewLabel] ?? null
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
  // "More" only shows on narrow screens .top-more in css; on wide ones its items sit inline.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [moreMenuOpen])
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
    setEnvironment, addObject, updateSelected, moveObject, scaleObject, rotateObject,
    renameSelected, setSelectedAssetId, deleteSelected, duplicateSelected, reparentObjectTo,
    indentObject, outdentObject, setSelectedVisible, setSelectedEnabled,
    addSelectedClickRule, removeRuleById, addScene, removeScene, moveSceneInOrder, renameScene,
  } = useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef })
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo } = useProjectFile({
    project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef,
  })

  const { currentStep, TUTStep, viewStep } = useSimpleSteps()
  const [category,setCategory]=useState<CatalogueIDTypes>('exhibits')

  // The top bar's save badge: "Saved" unless a save is in flight or something went wrong.
  const saveProblem = savedAt === 'Save failed' || syncStatus === 'conflict'
  const saveLabel = savedAt === 'Save failed' ? 'Not saved' : syncStatus === 'conflict' ? 'Conflict' : syncStatus === 'pending' ? 'Saving…' : 'Saved'

  // Play keeps the top bar (Play turns into Stop) and swaps the building stage for the visitor's view.
  const playing = viewMode === 'runtime'

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="topbar-home" onClick={goHome} title="Back to home" aria-label="Home">
          <Box size={20} strokeWidth={1.75} />
        </button>
        <SceneRoomPopUp
          project={project}
          onSelectScene={(id) => {
            commit('Select scene', selectEditorScene(project, id).project)
            setSelectedId(null)
          }}
          onAddRoom={addScene}
          onDeleteRoom={removeScene}
          onMoveRoom={moveSceneInOrder}
          onRenameRoom={renameScene}
          onEnvironmentChange={setEnvironment}
        />
        <span className="topbar-divider" />
        {/* Tutorial steps: the one being viewed shows its label, the rest only their number
            (the label stays in the tooltip) */}
        <nav className="Tutorial-steps">
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
              aria-label={title}
              onClick={() => viewStep(n)}
            >
            <span className="button-num">{n}</span>
              <span className="button-label">{label}</span>
            </button>
                  )})}
        </nav>

        <div className="top-actions"> {/**** Top bar buttons *****/}
          <button className="top-icon-button" onClick={undo} disabled={playing || !timelineRef.current.canUndo} title="Undo" aria-label="Undo"><Undo2 size={18} /></button>
          <button className="top-icon-button" onClick={redo} disabled={playing || !timelineRef.current.canRedo} title="Redo" aria-label="Redo"><Redo2 size={18} /></button>
          <span className="topbar-divider" />
          {/* Autosave runs on every change; clicking saves straight away */}
          <button
            className={saveProblem ? 'top-saved problem' : 'top-saved'}
            onClick={save}
            title={`${savedAt} · ${syncStatusLabel[syncStatus]} (click to save now)`}
          >
            {saveProblem ? <AlertTriangle size={15} /> : <Check size={15} />} {saveLabel}
          </button>
          <button className={playing ? 'top-play playing' : 'top-play'} onClick={() => setViewMode(playing ? 'editor' : 'runtime')}><Play size={13} fill="currentColor" /> {playing ? 'Stop' : 'Play'}</button>
          {/* the Share flow (who can visit, teacher review) isn't built yet */}
          <button className="top-publish" disabled title="Publishing is coming soon">Publish</button>
          {/* Less-used actions, out of the way */}
          <div className={moreMenuOpen ? 'top-more open' : 'top-more'} ref={moreMenuRef}>
            <button className="top-icon-button" onClick={() => setMoreMenuOpen((open) => !open)} aria-expanded={moreMenuOpen} title="More" aria-label="More"><MoreHorizontal size={18} /></button>
            <div className="top-more-items" onClick={() => setMoreMenuOpen(false)}>
              <button className="button ghost" onClick={loadDraft}>Load draft</button>
              <button className="button ghost" onClick={loadAudioDemo} disabled={isAudioDemoLoaded} title={isAudioDemoLoaded ? 'Audio demo is already loaded in this project' : 'Add the bundled audio demo zones, rules, and SFX targets'}>{isAudioDemoLoaded ? 'Audio demo loaded' : 'Load audio demo'}</button>
            </div>
          </div>
        </div>
      </header>
      {playing ? <RuntimeView project={project} onExit={() => setViewMode('editor')} /> : <>
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
              // in the quad layout the View bar sits over another pane, so the main pane's corner is free
              overlayInsetTop={layoutMode === 'quad' ? undefined : VIEW_BAR_CLEARANCE}
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

          {/* Top-right: view angles; the OctaOrb column starts below them (overlayInsetTop) */}
          <div className="floating-controls top-right">
            <div className="float-group">
              <span className="float-label">View</span>
              {VIEW_PRESETS.map(({ preset, label }) => (
                <button key={preset} className={cameraMode === 'orbit' && activeViewPreset === preset ? 'float-button active' : 'float-button'} disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.setViewPreset(preset)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Bottom-right: zoom, walls, framing, and the settings menu opening above them */}
          <div className="floating-controls bottom-right" ref={advancedMenuRef}>
            {advancedMenuOpen && (
              <div className="float-group float-menu">
                <span className="float-menu-label">Camera</span>
                <div className="float-segment">
                  <button className={cameraMode === 'orbit' ? 'active' : ''} onClick={() => setCameraMode('orbit')} title="Look around the room from outside">Orbit</button>
                  <button className={cameraMode === 'walk' ? 'active' : ''} onClick={() => setCameraMode('walk')} title="Walk around the room like a visitor (WASD)">Walk</button>
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
                  {/* FPS and draw calls are for the team, not students: dev builds only */}
                  {import.meta.env.DEV && <button className={showStats ? 'active' : ''} onClick={() => setShowStats((value) => !value)} title="Show or hide FPS and object count">Stats</button>}
                </div>
              </div>
            )}
            <div className="float-group">
              <button className="float-button icon" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.zoomBy(0.8)} title="Zoom in">+</button>
              <button className="float-button icon" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.zoomBy(1.25)} title="Zoom out">−</button>
              <button className="float-button" onClick={() => setWalls(NEXT_WALL_CUT[walls])} title="Cut the room's walls down so you can see inside">Walls: {WALL_CUT_LABEL[walls]}</button>
              <button className="float-button" disabled={!selected || cameraMode !== 'orbit'} onClick={() => viewportRef.current?.focusSelected()} title="Frame the selected object">◎ Focus <kbd>F</kbd></button>
              <button className="float-button" disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.frameAll()} title="Frame the whole room">⛶ Whole room <kbd>H</kbd></button>
              <button className={advancedMenuOpen ? 'float-button icon active' : 'float-button icon'} onClick={() => setAdvancedMenuOpen((open) => !open)} title="View settings: camera, layout and overlays" aria-label="View settings" aria-expanded={advancedMenuOpen}><Settings size={17} /></button>
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
                    >{item.label}</button>
                  )
              })}
            </div>
            <div role="tabpanel">
              {/**add no items found part here */}
              <input aria-label="Search assets" placeholder="Search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
                <div className="catalogue-list">
                  {filterAssets(assetQuery, visibleAssets).map((asset, index) => {
                    const Icon = catalogueIcons[asset.kind] ?? Box
                    return (
                    <button className="asset-card" key={asset.assetId} onClick={() => addObject(asset)}>
                      <span className={`asset-tile ${catalogueTileColours[index % catalogueTileColours.length]}`}><Icon size={20} strokeWidth={1.75} /></span>
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
                    )
                  })}
                  {filterAssets(assetQuery, visibleAssets).length === 0 && <div className="asset-empty">No approved assets match this search.</div>}
                </div>
            </div>
        </div>
      </section>
      </>}
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


function SceneRoomPopUp({ project, onSelectScene, onAddRoom, onDeleteRoom, onMoveRoom, onRenameRoom, onEnvironmentChange }: RoomPopupProps){
  const [isOpen, setIsOpen] = useState(false)
  // The current room's name while it is being edited; null when not renaming.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [tab, setTab] = useState<RoomPopupTab>('rooms')
  // Room waiting on "Delete?" confirmation; a room can hold a lot of work.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Music is UI only for now: nothing in the project stores it yet.
  const [music, setMusic] = useState('Museum hum')
  const [volume, setVolume] = useState('Quiet')
  const anchorRef = useRef<HTMLDivElement>(null)
  const sceneIndex = Math.max(0, project.scenes.findIndex((s) => s.id === project.activeSceneId))
  const scene = project.scenes[sceneIndex]
  const roomLabel = (index: number) => `Room ${index + 1} · ${project.scenes[index].name}`

  // Closes on any press outside the trigger and popup, like the Advanced menu.
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  // Saving happens only on blur (Enter blurs too), so it runs once; Escape marks the edit
  // cancelled first, because removing the input can still fire a blur. An empty name keeps
  // the old one (onRenameRoom ignores it).
  const nameCancelledRef = useRef(false)
  const startRename = () => {
    nameCancelledRef.current = false
    setNameDraft(scene.name)
  }
  const saveName = () => {
    if (nameDraft !== null && !nameCancelledRef.current) onRenameRoom(scene.id, nameDraft)
    nameCancelledRef.current = true
    setNameDraft(null)
  }

  // Each side of the current room shows the room already there (click to go), or a + to add one.
  const here = roomCell(project, scene)
  const sideSlot = (side: RoomSide) => {
    const neighbour = here ? roomAt(project, cellBeside(here, side)) : undefined
    if (neighbour) {
      const index = project.scenes.indexOf(neighbour)
      return <button key={side} className={`room-slot neighbour ${side}`} onClick={() => onSelectScene(neighbour.id)} title={`Go to ${roomLabel(index)}`}>{roomLabel(index)}</button>
    }
    return <button key={side} className={`room-slot add ${side}`} onClick={() => onAddRoom(side)} title={`Add a room to the ${side}`} aria-label={`Add a room to the ${side}`}>+</button>
  }

  return(
    <div className="room-popup-anchor" ref={anchorRef}>
      <button className="room-trigger" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <span className="room-trigger-copy">
          <strong>{project.name}</strong>
          <small>{roomLabel(sceneIndex)}{project.scenes.length > 1 ? ` (${project.scenes.length} rooms)` : ''} <ChevronDown size={14} /></small>
        </span>
      </button>

      {isOpen && (
        <div className="room-popup" role="dialog" aria-label="Your rooms">
          <div className="room-popup-head">
            <div>
              <h2>Your rooms</h2>
              <p>Tap a + to add a room on that side. A door appears on that wall.</p>
            </div>
            <button className="room-popup-close" onClick={() => setIsOpen(false)} title="Close"><X size={18} /></button>
          </div>

          <div className="room-tabs" role="tablist">
            {(['rooms', 'style', 'music'] as RoomPopupTab[]).map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-selected' : ''} onClick={() => setTab(id)}>
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'rooms' && (
            <>
              <div className="room-grid">
                {ROOM_SIDES.map((side) => sideSlot(side))}
                {nameDraft === null ? (
                  <div className="room-slot current">
                    <span>{roomLabel(sceneIndex)}</span>
                    <button className="room-rename" onClick={startRename} title="Rename this room" aria-label="Rename this room"><Pencil size={13} /></button>
                  </div>
                ) : (
                  <form className="room-slot current editing" onSubmit={(event) => { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() }}>
                    <span className="room-rename-prefix">Room {sceneIndex + 1} ·</span>
                    <input
                      autoFocus
                      aria-label="Room name"
                      value={nameDraft}
                      maxLength={ROOM_NAME_MAX}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onFocus={(event) => event.target.select()}
                      onBlur={saveName}
                      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); nameCancelledRef.current = true; setNameDraft(null) } }}
                    />
                  </form>
                )}
              </div>
              {project.scenes.length > 1 && (
                <div className="room-order">
                  <span className="room-order-label">Visit order</span>
                  <div className="room-list">
                  {project.scenes.map((item, index) => {
                    const chipClass = index === sceneIndex ? 'room-chip is-selected' : 'room-chip'
                    if (confirmDeleteId === item.id) {
                      const count = item.objects.length
                      return (
                        <span key={item.id} className="room-chip confirm">
                          <span>Delete {item.name}{count > 0 ? ` and its ${count} thing${count === 1 ? '' : 's'}` : ''}?</span>
                          <button className="room-chip-yes" onClick={() => { onDeleteRoom(item.id); setConfirmDeleteId(null) }}>Delete</button>
                          <button className="room-chip-no" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                        </span>
                      )
                    }
                    return (
                      <span key={item.id} className={chipClass}>
                        <button className="room-chip-name" onClick={() => onSelectScene(item.id)} title={`Go to ${roomLabel(index)}`}>
                          <span className="room-chip-number">{index + 1}</span>{item.name}
                        </button>
                        <button className="room-chip-delete" onClick={() => setConfirmDeleteId(item.id)} title={`Delete ${roomLabel(index)}`} aria-label={`Delete ${roomLabel(index)}`}><X size={13} /></button>
                      </span>
                    )
                  })}
                  </div>
                  {/* move the room you're in earlier or later in the order visitors see the rooms */}
                  <button className="room-order-move" disabled={sceneIndex === 0} onClick={() => onMoveRoom(scene.id, -1)} title="Visit this room earlier" aria-label="Visit this room earlier"><ChevronLeft size={16} /></button>
                  <button className="room-order-move" disabled={sceneIndex === project.scenes.length - 1} onClick={() => onMoveRoom(scene.id, 1)} title="Visit this room later" aria-label="Visit this room later"><ChevronRight size={16} /></button>
                </div>
              )}
              <p className="room-popup-note">Click a room above, or its door label in the room, to go there. In Play, visitors walk through the door.</p>
            </>
          )}

          {tab === 'style' && (
            <label className="room-field">
              <span>Room style</span>
              <select value={scene.environmentId} onChange={(event) => onEnvironmentChange(event.target.value)}>
                {environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
              </select>
            </label>
          )}

          {tab === 'music' && (
            <>
              <label className="room-field">
                <span>Background music</span>
                <select value={music} onChange={(event) => setMusic(event.target.value)}>
                  {MUSIC_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="room-field">
                <span>Volume</span>
                <select value={volume} onChange={(event) => setVolume(event.target.value)}>
                  {VOLUME_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  )
}
