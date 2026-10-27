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
import { ProjectData, SceneObject, environmentLibrary, type AssetKind } from '../project/model'
import { downloadProject, loadProjectWithSource, type ProjectLoadResult } from '../project/serializer'
import { assetCatalog, countAssetUses, filterAssets } from '../content/assets'
import { isUserAsset } from '../content/userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets } from '../content/audioAssets'
import { isUserAudioAsset } from '../content/userAudio'
import { selectEditorScene } from '../editor/editorOperations'
import { ObjectPanel, type Vec3 } from '../sections/objectPanel/objectPanel'
import { findCard, saveObjectCard, removeObjectCard, type CardInput } from '../editor/cardEditorOperations'
import { buildSceneTree, previousSibling } from '../editor/sceneTree'
import { cellBeside, roomAt, roomCell, ROOM_SIDES, type RoomSide } from '../editor/roomLayout'
import RuntimeView from '../../apps/runtime/src/RuntimeApplication'
import Viewport, { ViewportHandle, viewportHintText, type ViewPreset, type WallCut } from '../viewport/Viewport'
import ReferenceViewport from '../viewport/ReferenceViewport'
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
// preview: true when a teacher previews as a student (TeacherPreviewPage); nothing is saved
export default function EditorPage({ start, preview = false }: { start?: ProjectLoadResult; preview?: boolean } = {}) {
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
  const { savedAt, setSavedAt, persistenceState, setPersistenceState, syncStatus, syncStatusLabel, save } = useAutosave(project, initialLoad.source, !preview)
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
        {/* project name + room; opens "Your rooms" (SceneRoomPopUp, at the end of this file) */}
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

          {/* Top-left, under the tools: the students' mission brief, when the teacher set one */}
          {project.missionBrief && <MissionBriefPanel brief={project.missionBrief} project={project} />}

          {/* Top-right: view angles; the OctaOrb column starts below them (overlayInsetTop) */}
          <div className="floating-controls top-right">
            <div className="float-group">
              <span className="float-label">View</span>
              {VIEW_PRESETS.map(({ preset, label }) => (
                <button key={preset} className={cameraMode === 'orbit' && activeViewPreset === preset ? 'float-button active' : 'float-button'} disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.setViewPreset(preset)}>{label}</button>
              ))}
            </div>
          </div>
          {/* Bottom-left: "Things in this room" (folded until clicked) over the room picker. The list
              is the old Scene panel's object tree (commit 68caea5), for this room only. */}
          <div className="floating-controls bottom-left">
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
          {/* The panel only shows things and calls back; every action below decides what happens. */}
          <ObjectPanel
            object={{
              id: selected.id,
              name: selected.name,
              kind: selected.assetKind,
              position: selected.transform.position,
              rotation: selected.transform.rotation.map(radToDeg) as Vec3,
              scale: selected.transform.scale,
            }}
            step={step}
            onStepChange={setStep}
            onClose={() => setSelectedId(null)}
            tool={gizmoMode === 'select' ? null : gizmoMode}
            onToolChange={setGizmoMode}
            onRotateBy={(degrees) => {
              const [x, y, z] = selected.transform.rotation
              updateSelected({ rotation: [x, degToRad(wrapDegrees(radToDeg(y) + degrees)), z] })
            }}
            onExactChange={(field, value) => {
              updateSelected({ [field]: field === 'rotation' ? value.map((degrees) => degToRad(wrapDegrees(degrees))) as Vec3 : value })
            }}
            snap={snapOn}
            onSnapChange={setSnapOn}
            onCopy={duplicateSelected}
            onRemove={deleteSelected}
            rules={(project.rules ?? []).filter((rule) => rule.objectId === selected.id)}
            onAddRule={addSelectedClickRule}
            onRemoveRule={removeRuleById}
            infoCard={cardInputFor(project, selected)}
            mediaChoices={[]}
            onSaveCard={(input) => {
              const result = saveObjectCard(project, scene.id, selected.id, input)
              if (!result.ok) return result.error
              commit('Save info card', result.project)
              return null
            }}
            onRemoveCard={() => commit('Remove info card', removeObjectCard(project, scene.id, selected.id))}
          />
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

const wrapDegrees = (degrees: number) => ((degrees % 360) + 360) % 360

/*
 * The top-left of the editor: the cube (back to the home page), the project button
 * ("Dinosaur museum / Room 1 · Entrance hall") and the "Your rooms" popup it opens:
 *   - a 3x3 map centred on the ROOM BEING EDITED (purple, with a pencil to rename it). Each of
 *     its four sides shows the room already there (green, click to go) or "+" to add one.
 *   - visit order: the rooms in the order visitors see them, with arrows to move this room
 *   - delete this room (after a "Delete?" check, since a room can hold a lot of work), as long
 *     as it is not the only room
 *   - background music, volume and wall/floor material for the room being edited
 * HOW A ROOM REMEMBERS ITS SIDE: each scene stores its cell on the rooms map
 * (SceneData.layout; see editor/roomLayout.ts), so rooms can spread out in any direction and
 * the map follows the room you are in.
 * FOR NOW: music, volume and material are ON SCREEN ONLY (they highlight per room, but nothing
 * is saved or played). The room's environment is picked in the bottom-left "Room" box.
 */
interface RoomPopupProps {
  project: ProjectData
  // go to (start editing) another room
  onSelectScene: (sceneId: string) => void
  // add a room on this side of the room being edited, staying in the current one
  onAddRoom: (side: RoomSide) => void
  onDeleteRoom: (sceneId: string) => void
  // move a room earlier (-1) or later (+1) in the visit order
  onMoveRoom: (sceneId: string, step: -1 | 1) => void
  onRenameRoom: (sceneId: string, name: string) => void
}
// the card on an object as the form's input, or null when it has none
const cardInputFor = (project: ProjectData, object: SceneObject): CardInput | null => {
  const card = findCard(project, object)
  if (!card || card.attachment.presentation.mode !== 'card') return null
  const { title, media, autoCloseMs } = card.attachment.presentation
  return { title: title ?? '', body: card.meta?.content ?? '', ...(media ? { media } : {}), ...(autoCloseMs !== undefined ? { autoCloseMs } : {}) }
}

// Fits the room box; the project file itself allows up to 200 characters.
const ROOM_NAME_MAX = 40

// Where each side of the room being edited sits in the 3x3 map, and how the note describes it.
const SIDE_PLACE: Record<RoomSide, { gridRow: number; gridColumn: number; words: string }> = {
  north: { gridRow: 1, gridColumn: 2, words: 'above' },
  west: { gridRow: 2, gridColumn: 1, words: 'left of' },
  east: { gridRow: 2, gridColumn: 3, words: 'right of' },
  south: { gridRow: 3, gridColumn: 2, words: 'below' },
}
const CENTRE_PLACE = { gridRow: 2, gridColumn: 2 }

const MUSIC_OPTIONS = ['None', 'Museum hum', 'Soft piano'] as const
const VOLUME_OPTIONS = ['Quiet', 'Normal', 'Loud'] as const
// MATERIAL: placeholder style names. Picking one is on screen only and does not change the models.
const STYLE_OPTIONS = ['Style 1', 'Style 2', 'Style 3', 'Style 4'] as const
type RoomStyle = (typeof STYLE_OPTIONS)[number]
type RoomMaterial = { walls: RoomStyle; floor: RoomStyle }
const DEFAULT_ROOM_MATERIAL: RoomMaterial = { walls: 'Style 1', floor: 'Style 1' }
type RoomSound = { music: (typeof MUSIC_OPTIONS)[number]; volume: (typeof VOLUME_OPTIONS)[number] }
const DEFAULT_ROOM_SOUND: RoomSound = { music: 'Museum hum', volume: 'Quiet' }

function SceneRoomPopUp({ project, onSelectScene, onAddRoom, onDeleteRoom, onMoveRoom, onRenameRoom }: RoomPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  // The current room's name while it is being edited; null when not renaming.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  // the room waiting on its "Delete?" check, or null
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // the side a room was just added on (and the room it was added beside), for the note under the map
  const [justAdded, setJustAdded] = useState<{ fromId: string; side: RoomSide } | null>(null)
  // ON SCREEN ONLY: music and volume per room, by room id
  const [sounds, setSounds] = useState<Record<string, RoomSound>>({})
  // ON SCREEN ONLY: the wall and floor style per room, by room id
  const [materials, setMaterials] = useState<Record<string, RoomMaterial>>({})
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

  // "Room 2 · Fossil lab": numbered in visit order
  const labelOf = (sceneId: string) => {
    const index = project.scenes.findIndex((scene) => scene.id === sceneId)
    return `Room ${index + 1} · ${project.scenes[index].name}`
  }
  const current = project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0]
  const currentIndex = project.scenes.indexOf(current)

  // Saving happens only on blur (Enter blurs too), so it runs once; Escape marks the edit cancelled first, because removing the input can still fire a blur.
  //  An empty name keeps the old one (onRenameRoom ignores it).
  const nameCancelledRef = useRef(false)
  const startRename = () => {
    nameCancelledRef.current = false
    setNameDraft(current.name)
  }
  const saveName = () => {
    if (nameDraft !== null && !nameCancelledRef.current) onRenameRoom(current.id, nameDraft)
    nameCancelledRef.current = true
    setNameDraft(null)
  }

  // the room on one side of the room being edited, if there is one
  const here = roomCell(project, current)
  const neighbourOn = (side: RoomSide) => (here ? roomAt(project, cellBeside(here, side)) : undefined)

  const sound = sounds[current.id] ?? DEFAULT_ROOM_SOUND
  const setSound = (change: Partial<RoomSound>) => setSounds((all) => ({ ...all, [current.id]: { ...sound, ...change } }))
  const material = materials[current.id] ?? DEFAULT_ROOM_MATERIAL
  const setMaterial = (change: Partial<RoomMaterial>) => setMaterials((all) => ({ ...all, [current.id]: { ...material, ...change } }))

  const addRoom = (side: RoomSide) => {
    onAddRoom(side)
    setJustAdded({ fromId: current.id, side })
  }
  const goTo = (sceneId: string) => {
    if (sceneId !== current.id) onSelectScene(sceneId)
    setJustAdded(null)
    setConfirmDeleteId(null)
    setNameDraft(null)
  }
  const deleteRoom = (sceneId: string) => {
    onDeleteRoom(sceneId)
    setConfirmDeleteId(null)
    setJustAdded(null)
  }

  // one side of the map: the room already there (green, click to go), or a dashed "+"
  const sideCell = (side: RoomSide) => {
    const place = { gridRow: SIDE_PLACE[side].gridRow, gridColumn: SIDE_PLACE[side].gridColumn }
    const neighbour = neighbourOn(side)
    if (neighbour) {
      return (
        <button key={side} type="button" className="rooms-cell rooms-cell-other" style={place} onClick={() => goTo(neighbour.id)} title={`Go to ${labelOf(neighbour.id)}`}>
          {labelOf(neighbour.id)} →
        </button>
      )
    }
    const words = `Add a room ${SIDE_PLACE[side].words} this one`
    return (
      <button key={side} type="button" className="rooms-cell rooms-cell-add" style={place} onClick={() => addRoom(side)} title={words} aria-label={words}>
        <Plus size={18} />
      </button>
    )
  }
  const justAddedRoom = justAdded && justAdded.fromId === current.id ? neighbourOn(justAdded.side) : undefined

  return (
    <div className="rooms-anchor" ref={anchorRef}>
      <Link to={home} className="rooms-home" title="Back to home"><Box size={20} /></Link>{/* THE CUBE: back to the home page (the editor saves as you go, so nothing is lost) */}
      <button type="button" className="rooms-trigger" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>{/* THE BUTTON: project name, then which room is being edited; opens "Your rooms" */}
        <span className="rooms-trigger-text">
          <strong>{project.name}</strong>
          <span className="rooms-trigger-room">
            {labelOf(current.id)}{project.scenes.length > 1 ? ` (${project.scenes.length} rooms)` : ''} <ChevronDown size={14} />
          </span>
        </span>
      </button>
      {isOpen && (
        <div className="rooms-popup" role="dialog" aria-label="Your rooms">
          <div className="rooms-head">{/* TITLE and close */}
            <div>
              <h2 className="rooms-title">Your rooms</h2>
              <p className="rooms-sub">Tap a + to add a room on that side. A door appears on that wall.</p>
            </div>
            <button type="button" className="rooms-close" onClick={() => setIsOpen(false)} title="Close"><X size={16} /></button>
          </div>
          <div className="rooms-grid">{/* THE MAP: the room being edited in the middle, a room or "+" on each side */}
            {ROOM_SIDES.map((side) => sideCell(side))}
            {nameDraft === null ? (
              <div className="rooms-cell rooms-cell-current rooms-cell-renamable" style={CENTRE_PLACE}>
                <span>{labelOf(current.id)}</span>
                <button type="button" className="room-rename" onClick={startRename} title="Rename this room" aria-label="Rename this room"><Pencil size={13} /></button>
              </div>
            ) : (
              <form className="rooms-cell rooms-cell-current rooms-cell-editing" style={CENTRE_PLACE} onSubmit={(event) => { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() }}>
                <span className="room-rename-prefix">Room {currentIndex + 1} ·</span>
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
          {/* NOTE: where the room just added went */}
          {justAdded && justAddedRoom && (
            <p className="rooms-note">
              {labelOf(justAddedRoom.id)} is {SIDE_PLACE[justAdded.side].words} {current.name}. Click it to start building there.
            </p>
          )}
          {/* VISIT ORDER: the order visitors see the rooms; the arrows move the room being edited */}
          {project.scenes.length > 1 && (
            <div className="room-order">
              <span className="room-order-label">Visit order</span>
              <div className="room-list">
                {project.scenes.map((item, index) => (
                  <span key={item.id} className={index === currentIndex ? 'room-chip is-selected' : 'room-chip'}>
                    <button type="button" className="room-chip-name" onClick={() => goTo(item.id)} title={`Go to ${labelOf(item.id)}`}>
                      <span className="room-chip-number">{index + 1}</span>{item.name}
                    </button>
                  </span>
                ))}
              </div>
              <button type="button" className="room-order-move" disabled={currentIndex === 0} onClick={() => onMoveRoom(current.id, -1)} title="Visit this room earlier" aria-label="Visit this room earlier"><ChevronLeft size={16} /></button>
              <button type="button" className="room-order-move" disabled={currentIndex === project.scenes.length - 1} onClick={() => onMoveRoom(current.id, 1)} title="Visit this room later" aria-label="Visit this room later"><ChevronRight size={16} /></button>
            </div>
          )}
          {/* DELETE the room being edited (never the only room), after a "Delete?" check */}
          {project.scenes.length > 1 && (confirmDeleteId === current.id ? (
            <div className="rooms-delete confirm">
              <span>
                Delete {labelOf(current.id)}
                {current.objects.length > 0 ? ` and its ${current.objects.length} thing${current.objects.length === 1 ? '' : 's'}` : ''}?
              </span>
              <button type="button" className="rooms-delete-yes" onClick={() => deleteRoom(current.id)}>Delete</button>
              <button type="button" className="rooms-delete-no" onClick={() => setConfirmDeleteId(null)}>Keep</button>
            </div>
          ) : (
            <div className="rooms-delete">
              <button type="button" className="rooms-delete-ask" onClick={() => setConfirmDeleteId(current.id)}>
                <X size={13} /> Delete {labelOf(current.id)}
              </button>
            </div>
          ))}
          <div className="rooms-music">{/* BACKGROUND MUSIC for the room being edited (on screen only for now) */}
            <div className="rooms-music-head">
              <Music size={18} />
              <h3>Background music · {current.name}</h3>
            </div>
            <p className="rooms-sub">Loops softly while visitors are in this room.</p>
            <RoomChoiceRow label="Music" options={MUSIC_OPTIONS} value={sound.music} onPick={(music) => setSound({ music })} />
            <RoomChoiceRow label="Volume" options={VOLUME_OPTIONS} value={sound.volume} onPick={(volume) => setSound({ volume })} />
          </div>
          <div className="rooms-material">{/* MATERIAL for the room being edited (on screen only: the styles do not change the models) */}
            <div className="rooms-material-head">
              <Palette size={18} />
              <h3>Material · {current.name}</h3>
            </div>
            <p className="rooms-sub">How the walls and floor of this room look.</p>
            <RoomChoiceRow label="Walls" options={STYLE_OPTIONS} value={material.walls} onPick={(walls) => setMaterial({ walls })} />
            <RoomChoiceRow label="Floor" options={STYLE_OPTIONS} value={material.floor} onPick={(floor) => setMaterial({ floor })} />
          </div>
          <p className="room-popup-note">Click a room above, or its door label in the room, to go there. In Play, visitors walk through the door.</p>
        </div>
      )}
    </div>
  )
}

// a label, then a row of buttons where the picked one is purple
function RoomChoiceRow<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (value: T) => void }) {
  return (
    <div className="rooms-choice">
      <span className="rooms-choice-label">{label}</span>
      <div className="rooms-choice-options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
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
