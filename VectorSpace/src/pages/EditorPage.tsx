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
import { Link } from 'react-router'
import { AlertTriangle, Box, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, Cylinder, MoreHorizontal, Pencil, Music, Palette, Plus, Play, Redo2, Settings, Undo2, X, type LucideIcon } from 'lucide-react'
import { ProjectData, SceneObject, environmentLibrary, type AssetKind, type EnvironmentDefinition, type RoomCell , type RoomSurfaces } from '../project/model'
import { downloadProject, loadProjectWithSource, type ProjectLoadResult, type ProjectSharing } from '../project/serializer'
import { assetCatalog, assetsInCategory, catalogueCategories, countAssetUses, filterAssets, type CatalogueCategoryId } from '../content/assets'
import { DEFAULT_ROOM_SURFACES, ROOM_STYLE_OPTIONS, type RoomStyle } from '../content/roomSurfaces'
import { isUserAsset } from '../content/userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets } from '../content/audioAssets'
import { isUserAudioAsset } from '../content/userAudio'
import { selectEditorScene } from '../editor/editorOperations'
import { ObjectPanel, type Vec3 } from '../sections/objectPanel/objectPanel'
import { findCard, findVideo, saveObjectCard, removeObjectCard, saveObjectVideo, removeObjectVideo, type CardInput } from '../editor/cardEditorOperations'
import { addLocalMediaFile, addLocalMediaLink, useLocalMediaLibrary, type LocalMediaEntry } from '../content/localMediaLibrary'
import { buildSceneTree, previousSibling } from '../editor/sceneTree'
import { cellBeside, roomAt, ROOM_SIDES, studentRoomEnv } from '../editor/roomLayout'
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
import { setProjectStatus, submitProject, type ShareWith } from '../api/projects'
import { SharePopup, type ShareStatus } from '../sections/share/SharePopup'
import { isRemoteProject } from '../project/remoteProject'
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

/*
 * The four steps and the object panel's tabs are one value (Weian Ching):
 *   1 Place things  = the Position tab, and where the editor starts
 *   2 Add info      = the Info tab
 *   3 Make it react = the Reactions tab
 *   4 Play and share = Play (the step strip shows 4 while playing)
 * Every step can be opened at any time; a step turns green once it is done
 * (something placed, every thing has a fact card, at least one reaction).
 */
type EditStep = 1 | 2 | 3
/**End of Tutorial assisting code for the UI */


/** Catalogue assistance code */
// The category tabs, and which asset is in which, live in content/assets.ts.

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
  // the step being worked on, shared by the top bar and the object panel's tabs (see EditStep)
  const [step, setStep] = useState<EditStep>(1)
  // a short line telling the student where a step took them ("Add info to Pedestal")
  const [stepNotice, setStepNotice] = useState<string | null>(null)
  // the object panel's Snap switch: the viewport's drags land on the floor grid, in 15° turns
  // and 0.25 size steps while it is on (viewport/editing/snapping.ts)
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
  // Selecting something starts on Move (the arrows show at once); a tool picked in the object
  // panel carries over to the next selection. Nothing selected goes back to plain Select,
  // the only mode where clicking empty space deselects.
  const hasSelection = selectedId !== null
  useEffect(() => {
    setGizmoMode((mode) => (hasSelection ? (mode === 'select' ? 'move' : mode) : 'select'))
  }, [hasSelection])
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
    addObject, updateSelected, moveObject, scaleObject, rotateObject,
    renameSelected, setSelectedAssetId, deleteSelected, duplicateSelected, reparentObjectTo,
    indentObject, outdentObject, setSelectedVisible, setSelectedEnabled,
    addSelectedClickRule, removeRuleById, addScene, removeScene, moveSceneInOrder, renameScene, setSceneSurfaces,
  } = useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef })
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo } = useProjectFile({
    project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef,
  })

  const [category,setCategory]=useState<CatalogueCategoryId>('exhibits')
  // the cards under the picked tab, then narrowed by the search box
  const shownAssets = filterAssets(assetQuery, assetsInCategory(category, visibleAssets))

  // The top bar's save badge: "Saved" unless a save is in flight or something went wrong.
  const saveProblem = savedAt === 'Save failed' || syncStatus === 'conflict'
  const saveLabel = savedAt === 'Save failed' ? 'Not saved' : syncStatus === 'conflict' ? 'Conflict' : syncStatus === 'pending' ? 'Saving…' : 'Saved'

  // Play keeps the top bar (Play turns into Stop) and swaps the building stage for the visitor's view.
  const playing = viewMode === 'runtime'

  // Publish opens "Share your museum" (SharePopup). A student's send goes to their teacher
  // (POST /projects/:id/submit, with who can visit) and goes live once the teacher approves it on
  // Review; anyone else's project is published straight away (PATCH /projects/:id). Either saves
  // first. A browser draft has no server row to share, and a teacher preview changes nothing.
  const { getToken, role } = useSession()
  const sendsToTeacher = role === 'student'
  const [published, setPublished] = useState(initialLoad.status === 'published')
  const [sharing, setSharing] = useState<ProjectSharing>(
    initialLoad.sharing ?? { reviewStatus: null, shareWith: null, reviewComment: null, teacherName: null, slug: null },
  )
  // a student's museum is waiting for the teacher
  const sent = !published && sharing.reviewStatus === 'waiting'
  const shareStatus: ShareStatus = published ? 'published' : sent ? 'submitted' : 'draft'
  const [shareOpen, setShareOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const canShare = !preview && isRemoteProject(project.id)
  const teacherName = sharing.teacherName ?? 'your teacher'
  const publishTitle = preview ? 'Publishing is off in a preview'
    : !isRemoteProject(project.id) ? 'Open this project from your home page to publish it'
    : published ? 'This museum is published'
    : sent ? `Sent to ${teacherName}: waiting for them to approve it`
    : 'Share this museum'
  const publish = async (shareWith: ShareWith) => {
    if (!canShare || publishing) return
    setPublishing(true)
    setPublishError(null)
    save()
    try {
      if (sendsToTeacher) {
        const submission = await submitProject(getToken, project.id, shareWith)
        setSharing((current) => ({ ...current, reviewStatus: submission.status, shareWith: submission.share_with, reviewComment: submission.comment }))
      } else {
        const saved = await setProjectStatus(getToken, project.id, 'published')
        setPublished(saved.status === 'published')
      }
    } catch (problem) {
      setPublishError(`That didn't go through: ${problem instanceof Error ? problem.message : 'unknown error'}`)
    } finally {
      setPublishing(false)
    }
  }
  const closeShare = () => setShareOpen(false)

  const limitRooms = preview || role === 'student'
  const roomKinds = limitRooms ? studentRoomEnv(project) : environmentLibrary

  // the browser's media library feeds the panel's picture and video pickers
  const mediaLibrary = useLocalMediaLibrary()
  const mediaChoices = mediaLibrary.map(choiceFor)

  // what each step still needs, for its green tick and for where a step click goes
  const roomRules = (project.rules ?? []).filter((rule) => scene.objects.some((object) => object.id === rule.objectId))
  const needInfo = scene.objects.filter((object) => !findCard(project, object))
  const stepDone: Record<TutorialStep, boolean> = {
    1: scene.objects.length > 0,
    2: scene.objects.length > 0 && needInfo.length === 0,
    3: roomRules.length > 0,
    4: published,
  }

  // clicking a step in the top bar. Add info and Make it react with nothing selected pick a
  // thing for the student: the first one still missing a fact card, or one with no reaction yet.
  const goToStep = (n: TutorialStep) => {
    setStepNotice(null)
    if (n === 4) {
      setViewMode('runtime')
      return
    }
    if (playing) setViewMode('editor')
    setStep(n)
    if (n === 1 || selected) return
    if (scene.objects.length === 0) {
      setStepNotice('Place something from the catalogue first.')
      return
    }
    if (n === 2) {
      const next = needInfo[0] ?? scene.objects[0]
      setSelectedId(next.id)
      setStepNotice(needInfo.length > 0
        ? `${needInfo.length} ${needInfo.length === 1 ? 'thing still needs' : 'things still need'} info. Start with ${next.name}.`
        : `Every thing has info. Showing ${next.name}; pick another to change it.`)
      return
    }
    const quiet = scene.objects.filter((object) => !roomRules.some((rule) => rule.objectId === object.id))
    const next = quiet.find((object) => findCard(project, object)) ?? quiet[0] ?? scene.objects[0]
    setSelectedId(next.id)
    setStepNotice(`Make ${next.name} react: pick what happens when visitors click it.`)
  }

  // the notice fades on its own after a few seconds
  useEffect(() => {
    if (!stepNotice) return
    const timer = window.setTimeout(() => setStepNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [stepNotice])

  return (
    <main className="app-shell">
      <header className="topbar">
        {/* project name + room; opens "Your rooms" (SceneRoomPopUp, at the end of this file) */}
        <SceneRoomPopUp
          project={project}
          roomKinds={roomKinds}
          fromTeacher={limitRooms}
          onSelectScene={(id) => {
            commit('Select scene', selectEditorScene(project, id).project)
            setSelectedId(null)
          }}
          onAddRoom={addScene}
          onDeleteRoom={removeScene}
          onMoveRoom={moveSceneInOrder}
          onRenameRoom={renameScene}
          onSetSurfaces={setSceneSurfaces}
        />
        <span className="topbar-divider" />
        {/* Tutorial steps: the one being viewed shows its label, the rest only their number
            (the label stays in the tooltip) */}
        <nav className="Tutorial-steps">
        {tutorialSteps.map(({ step: n, label }) => {
          const viewing = n === (playing ? 4 : step)
          const colour = viewing ? 'viewing' : stepDone[n] ? 'green' : 'todo'
          const title = `Step ${n}: ${label}${stepDone[n] && !viewing ? ' (done)' : ''}`
          return (
            <button
              key={n}
              className={`button button--${colour}`}
              title={title}
              aria-label={title}
              aria-current={viewing ? 'step' : undefined}
              onClick={() => goToStep(n)}
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
          <button className={playing ? 'top-play playing' : 'top-play'} onClick={() => (playing ? setViewMode('editor') : goToStep(4))}><Play size={13} fill="currentColor" /> {playing ? 'Stop' : 'Play'}</button>
          {/* opens "Share your museum"; the label follows where the museum is: draft, waiting, live */}
          <button className="top-publish" onClick={() => { setPublishError(null); setShareOpen(true) }} disabled={!canShare} title={publishTitle}>
            {published ? <><Check size={15} /> Published</> : sent ? <><Clock size={15} /> Waiting</> : 'Publish'}
          </button>
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
      {shareOpen && (
        <SharePopup
          project={project}
          status={shareStatus}
          sharing={sharing}
          needsReview={sendsToTeacher}
          busy={publishing}
          error={publishError}
          onSend={(shareWith) => void publish(shareWith)}
          onClose={closeShare}
        />
      )}
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
              snap={snapOn}
              sceneId={scene.id}
              environmentId={scene.environmentId}
              surfaces={scene.surfaces}
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

          {/* Top-left: which handle is showing is picked in the object panel (Position tab); only the
              world/local choice for that handle lives here, since the panel has no equivalent. */}
          <div className="floating-controls top-left">
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
          {/* Bottom-left: "Things in this room" (folded until clicked). The list is the old Scene
              panel's object tree (commit 68caea5), for this room only. A room's kind is picked
              when it is added (the "+" in "Your rooms"), not changed afterwards. */}
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
        {stepNotice && (
          <div className="step-notice" role="status">
            {stepNotice}
            <button onClick={() => setStepNotice(null)} aria-label="Dismiss">×</button>
          </div>
        )}
        {/* clicking a thing opens the panel on the tab of the step being worked on */}
        {selected && <aside className="inspector-popup">
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
            onStepChange={(n) => goToStep(n as TutorialStep)}
            onClose={() => { setSelectedId(null); setGizmoMode('select') }}
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
            infoCardId={findCard(project, selected)?.attachment.id}
            cardTasks={project.missionBrief?.cardTasks}
            mediaChoices={mediaChoices}
            onUploadMedia={async (file) => {
              const added = await addLocalMediaFile(file)
              return 'error' in added ? added : choiceFor(added)
            }}
            onAddMediaLink={(url) => {
              const added = addLocalMediaLink(url, 'editor')
              return 'error' in added ? added : choiceFor(added)
            }}
            video={videoFor(selected, mediaLibrary)}
            onSaveVideo={(assetId) => {
              const result = saveObjectVideo(project, scene.id, selected.id, assetId)
              if (!result.ok) return result.error
              commit('Save video', result.project)
              return null
            }}
            onRemoveVideo={() => commit('Remove video', removeObjectVideo(project, scene.id, selected.id))}
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
                  if(item.tone) classes.push(`tone-${item.tone}`)
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
                  {shownAssets.map((asset, index) => {
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
                  {shownAssets.length === 0 && <div className="asset-empty">{assetQuery.trim() ? 'No approved assets match this search.' : 'Nothing here yet.'}</div>}
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

// the card on an object as the form's input, or null when it has none
// a library entry as a picker choice for the object panel
const choiceFor = (entry: LocalMediaEntry) => ({ assetId: entry.id, kind: entry.kind, label: entry.label, status: entry.approval })

// the object's video, named from the library (or plainly "Video" if it is not in this browser)
const videoFor = (object: SceneObject, library: readonly LocalMediaEntry[]) => {
  const video = findVideo(object)
  if (!video) return null
  return { attachmentId: video.id, assetId: video.assetId, label: library.find((entry) => entry.id === video.assetId)?.label ?? 'Video' }
}

const cardInputFor = (project: ProjectData, object: SceneObject): CardInput | null => {
  const card = findCard(project, object)
  if (!card || card.attachment.presentation.mode !== 'card') return null
  const { title, media, autoCloseMs, fields, taskId } = card.attachment.presentation
  return {
    title: title ?? '',
    body: card.meta?.content ?? '',
    ...(media ? { media } : {}),
    ...(autoCloseMs !== undefined ? { autoCloseMs } : {}),
    ...(fields && taskId ? { fields, taskId } : {}),
  }
}

/*
 * The top-left of the editor: the cube (back to the home page), the project button
 * ("Dinosaur museum / Room 1 · Entrance hall") and the "Your rooms" popup it opens:
 *   - a 3x3 map centred on the ROOM BEING EDITED (purple, with a pencil to rename it). Each of
 *     its four sides shows the room already there (green, click to go) or "+" to add one.
 *   - after a "+": "What kind of room?", the kinds on offer (roomKinds; for a student, only the
 *     kinds the teacher turned on). A room's kind is chosen here, once, when it is added.
 *   - visit order: the rooms in the order visitors see them, with arrows to move this room
 *   - delete this room (after a "Delete?" check, since a room can hold a lot of work), as long
 *     as it is not the only room
 *   - background music, volume and wall/floor material for the room being edited
 * HOW A ROOM REMEMBERS ITS SIDE: each scene stores its cell on the rooms map
 * (SceneData.layout; see editor/roomLayout.ts), so rooms can spread out in any direction and
 * the map follows the room you are in.
 * FOR NOW: music, volume and material are ON SCREEN ONLY (they highlight per room, but nothing
 * is saved or played).
 */
interface RoomPopupProps {
  project: ProjectData
  // the kinds of room a "+" offers (EditorPage decides: the teacher's kinds for a student)
  roomKinds: EnvironmentDefinition[]
  // true when roomKinds are the teacher's pick, for the note under them
  fromTeacher: boolean
  // go to (start editing) another room
  onSelectScene: (sceneId: string) => void
  // add a room of this kind in this empty cell of the map, staying in the current one
  onAddRoom: (cell: RoomCell, kind: EnvironmentDefinition) => void
  onDeleteRoom: (sceneId: string) => void
  // move a room earlier (-1) or later (+1) in the visit order
  onMoveRoom: (sceneId: string, step: -1 | 1) => void
  onRenameRoom: (sceneId: string, name: string) => void
  // change a room's wall and/or floor style
  onSetSurfaces: (sceneId: string, change: Partial<RoomSurfaces>) => void
}

// Fits the room box; the project file itself allows up to 200 characters.
const ROOM_NAME_MAX = 40

// The map is fixed: the five allowed cells, the origin in the middle of a 3x3 grid and one cell on each side.
const MAP_CELLS: { cell: RoomCell; words: string }[] = [
  { cell: { x: 0, z: 0 }, words: 'in the middle' },
  ...ROOM_SIDES.map((side) => ({ cell: cellBeside({ x: 0, z: 0 }, side), words: { north: 'at the top', east: 'on the right', south: 'at the bottom', west: 'on the left' }[side] })),
]
const placeOf = (cell: RoomCell) => ({ gridRow: cell.z + 2, gridColumn: cell.x + 2 })

const MUSIC_OPTIONS = ['None', 'Museum hum', 'Soft piano'] as const
const VOLUME_OPTIONS = ['Quiet', 'Normal', 'Loud'] as const
type RoomSound = { music: (typeof MUSIC_OPTIONS)[number]; volume: (typeof VOLUME_OPTIONS)[number] }
const DEFAULT_ROOM_SOUND: RoomSound = { music: 'Museum hum', volume: 'Quiet' }

// swatch colour per room kind, in library order (the same colours as template setup's room chips)
const KIND_TONES = ['blue', 'green', 'peach', 'lilac', 'rose', 'sky']
const kindTone = (environmentId: string) => KIND_TONES[Math.max(0, environmentLibrary.findIndex((env) => env.id === environmentId)) % KIND_TONES.length]

function SceneRoomPopUp({ project, roomKinds, fromTeacher, onSelectScene, onAddRoom, onDeleteRoom, onMoveRoom, onRenameRoom, onSetSurfaces }: RoomPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  // the empty cell whose "+" was tapped, waiting on "What kind of room?"; null when not adding
  const [addingAt, setAddingAt] = useState<{ cell: RoomCell; words: string } | null>(null)
  // The current room's name while it is being edited; null when not renaming.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  // the room waiting on its "Delete?" check, or null
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // the map cell a room was just added in, for the note under the map
  const [justAdded, setJustAdded] = useState<{ cell: RoomCell; words: string } | null>(null)
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

  const sound = sounds[current.id] ?? DEFAULT_ROOM_SOUND
  const setSound = (change: Partial<RoomSound>) => setSounds((all) => ({ ...all, [current.id]: { ...sound, ...change } }))
  // saved on the room itself; a style name the buttons do not know shows as the default
  const surfaces = current.surfaces ?? DEFAULT_ROOM_SURFACES
  const styleOf = (value: string): RoomStyle => (ROOM_STYLE_OPTIONS as readonly string[]).includes(value) ? value as RoomStyle : 'Style 1'

  const addRoom = (kind: EnvironmentDefinition) => {
    if (!addingAt) return
    onAddRoom(addingAt.cell, kind)
    setJustAdded(addingAt)
    setAddingAt(null)
  }
  const goTo = (sceneId: string) => {
    if (sceneId !== current.id) onSelectScene(sceneId)
    setAddingAt(null)
    setJustAdded(null)
    setConfirmDeleteId(null)
    setNameDraft(null)
  }
  const deleteRoom = (sceneId: string) => {
    onDeleteRoom(sceneId)
    setConfirmDeleteId(null)
    setAddingAt(null)
    setJustAdded(null)
  }

  // one cell of the map: the room being edited (purple, renamable), another room (green, click to select it), or a dashed "+"
  const mapCell = ({ cell, words }: (typeof MAP_CELLS)[number]) => {
    const key = `${cell.x},${cell.z}`
    const place = placeOf(cell)
    const room = roomAt(project, cell)
    if (room && room.id === current.id) {
      return nameDraft === null ? (
        <div key={key} className="rooms-cell rooms-cell-current rooms-cell-renamable" style={place}>
          <span>{labelOf(current.id)}</span>
          <button type="button" className="room-rename" onClick={startRename} title="Rename this room" aria-label="Rename this room"><Pencil size={13} /></button>
        </div>
      ) : (
        <form key={key} className="rooms-cell rooms-cell-current rooms-cell-editing" style={place} onSubmit={(event) => { event.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() }}>
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
      )
    }
    if (room) {
      return (
        <button key={key} type="button" className="rooms-cell rooms-cell-other" style={place} onClick={() => goTo(room.id)} title={`Edit ${labelOf(room.id)}`}>
          {labelOf(room.id)}
        </button>
      )
    }
    const addWords = `Add a room ${words}`
    const picking = addingAt !== null && addingAt.cell.x === cell.x && addingAt.cell.z === cell.z
    return (
      <button
        key={key}
        type="button"
        className={picking ? 'rooms-cell rooms-cell-add picking' : 'rooms-cell rooms-cell-add'}
        style={place}
        onClick={() => { setJustAdded(null); setAddingAt(picking ? null : { cell, words }) }}
        title={addWords}
        aria-label={addWords}
        aria-pressed={picking}
      >
        <Plus size={18} />
      </button>
    )
  }
  const justAddedRoom = justAdded ? roomAt(project, justAdded.cell) : undefined

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
          <div className="rooms-grid">{/* THE MAP: always the same five cells; the room being edited is purple */}
            {MAP_CELLS.map(mapCell)}
          </div>
          {/* WHAT KIND: after a "+", the kinds of room on offer; picking one adds the room there */}
          {addingAt && (
            <div className="rooms-kinds" role="group" aria-label="What kind of room?">
              <div className="rooms-kinds-head">
                <h3>What kind of room?</h3>
                <button type="button" className="rooms-kinds-cancel" onClick={() => setAddingAt(null)}>Cancel</button>
              </div>
              {roomKinds.length === 0 ? (
                <p className="rooms-sub">{fromTeacher ? "Your teacher hasn't turned on any room types to add." : 'There are no kinds of room to pick from yet.'}</p>
              ) : (
                <div className="rooms-kinds-list">
                  {roomKinds.map((kind) => (
                    <button key={kind.id} type="button" className="rooms-kind" onClick={() => addRoom(kind)}>
                      <span className={`rooms-kind-swatch tone-${kindTone(kind.id)}`} />
                      <span>
                        <strong>{kind.name}</strong>
                        {/* most descriptions only repeat the name, so those are left out */}
                        {kind.description && kind.description !== kind.name && <small>{kind.description}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="rooms-kinds-note">{fromTeacher ? 'Only rooms your teacher picked. ' : ''}A door appears on the shared wall.</p>
            </div>
          )}
          {/* NOTE: where the room just added went */}
          {justAdded && justAddedRoom && (
            <p className="rooms-note">
              {labelOf(justAddedRoom.id)} was added {justAdded.words}. Click it to start building there.
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
          <div className="rooms-material">{/* MATERIAL for the room being edited: saved on the room, and the viewport swaps the textures straight away */}
            <div className="rooms-material-head">
              <Palette size={18} />
              <h3>Material · {current.name}</h3>
            </div>
            <p className="rooms-sub">How the walls and floor of this room look.</p>
            <RoomChoiceRow label="Walls" options={ROOM_STYLE_OPTIONS} value={styleOf(surfaces.walls)} onPick={(walls) => onSetSurfaces(current.id, { walls })} />
            <RoomChoiceRow label="Floor" options={ROOM_STYLE_OPTIONS} value={styleOf(surfaces.floor)} onPick={(floor) => onSetSurfaces(current.id, { floor })} />
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
