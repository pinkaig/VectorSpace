/**
 * @file        EditorPage.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-10-12
 * @brief       Editor coordinator, mounted at the /editor route (moved from src/App.tsx).
 *
 * @responsibility
 * Composes the editor's hooks (src/editor/hooks), owns selection, editor/runtime mode
 * selection and the panel UI state, and lays out the editor panels. The project value,
 * undo/redo, autosave, imports and scene edits live in those hooks.
 *
 * @inputs
 * Initial project data from serializer.ts and user events from the editor UI.
 *
 * @outputs
 * Editor or RuntimeView JSX and project updates sent to child components.
 *
 * @members
 * selectedId, viewMode, assetQuery, syncToken, expandedSceneIds, and the values the
 * hooks return (project, commit, undo, redo, persist, addObject, updateSelected,
 * moveObject and the rest).
 *
 * @boundary
 * Does not choose which page shows or who may open it: the route table in src/App.tsx
 * and src/session/session.tsx do. This page loads its own project when it mounts and
 * saves it again when it unmounts, so leaving and returning to /editor loses nothing.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Contracts
 * Links point at the project wiki; migration is still in progress.
 */
import { useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { useNavigate } from 'react-router'
import { collectSubtreeIds } from '@vectorspace/authoring-engine'
import { ProjectData, SceneObject, environmentLibrary } from '../project/model'
import { downloadProject, loadProjectWithSource } from '../project/serializer'
import { assetCatalog, countAssetUses, filterAssets } from '../content/assets'
import { isUserAsset } from '../content/userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets } from '../content/audioAssets'
import { isUserAudioAsset } from '../content/userAudio'
import { selectEditorScene } from '../editor/editorOperations'
import { type ClickRuleChoice } from '../editor/ruleEditorOperations'
import { WhenDoRuleSection } from '../sections/objectPanel/WhenDoRuleSection'
import { buildSceneTree, previousSibling } from '../editor/sceneTree'
import RuntimeView from '../../apps/runtime/src/RuntimeApplication'
import Viewport, { ViewportHandle } from '../viewport/Viewport'
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




export default function EditorPage() {

  const navigate = useNavigate()
  // Read the saved draft once per mount, not once at import. This page unmounts when the
  // visitor leaves /editor, and coming back must start from the latest autosave; a
  // module-level read would hand back the first visit's data and autosave would then
  // write that over the newer draft.
  const [initialLoad] = useState(loadProjectWithSource)
  const initialProject = initialLoad.project
  // Bumped when an edit is rejected, to pull the viewport's preview meshes back
  // to ProjectData. See runCommand.
  const [syncToken, setSyncToken] = useState(0)
  const bumpSync = () => setSyncToken((value) => value + 1)
  const { project, timelineRef, commit, runCommand, resetTimeline, undo, redo } = useEditorHistory(initialProject, bumpSync)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
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
    indentObject, outdentObject, setSelectedVisible, addSelectedClickRule, removeRuleById,
    setSelectedEnabled, addScene,
  } = useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef })
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo } = useProjectFile({
    project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef,
  })

const { currentStep, TUTStep, viewStep } = useSimpleSteps()


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
        <div className="brand"><span className="brand-mark">V</span><div><strong>VectorSpace</strong><span>Spatial Experience Builder</span></div></div>
        <div className="project-title"><span className="eyebrow">Project</span><strong>{project.name}</strong><span className="save-state">{savedAt}</span></div>
        <div className="top-actions"> {/**** Top bar buttons *****/}

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
              aria-current={viewing ? 'step' : undefined}
              disabled={locked}
              title={title}
              onClick={() => viewStep(n)}
            >
              <span className="button-num">
                {n}
              </span>
              {label}
            </button>
          )

        })}

        </nav>



          <button className="button subtle" onClick={() => navigate('/teacher')}>Home</button>
          <button className="button subtle" onClick={undo} disabled={!timelineRef.current.canUndo}>Undo</button>
          <button className="button subtle" onClick={redo} disabled={!timelineRef.current.canRedo}>Redo</button>
          <button className="button ghost" onClick={loadDraft}>Load draft</button>
          <button className="button ghost" onClick={loadAudioDemo} disabled={isAudioDemoLoaded} title={isAudioDemoLoaded ? 'Audio demo is already loaded in this project' : 'Add the bundled audio demo zones, rules, and SFX targets'}>{isAudioDemoLoaded ? 'Audio demo loaded' : 'Load audio demo'}</button>
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
          <div className="rail-tabs">
            <button //scene
              className={LeftTabs === 'scenes' ? 'rail-tab active' : 'rail-tab'}
              onClick={() => SetLeftTab('scenes')}
              >
              Scene
            </button>
            <button //assets
              className={LeftTabs === 'assets' ? 'rail-tab active' : 'rail-tab'}
              onClick={() => SetLeftTab('assets')}
              >
              Assets
            </button>
            <button //interactions
              className={LeftTabs === 'interactions' ? 'rail-tab active' : 'rail-tab'}
              onClick={() => SetLeftTab('interactions')}
            >
              Interact
            </button>
          </div>
          {/* ── Scenes tab ─────────────────────────────────────────── */}
          {LeftTabs === 'scenes' && (
            <div className="rail-tab-panel">
              <div className="rail-heading"><div><span className="eyebrow">Build</span><h2>Scene</h2></div><button className="icon-button" title="Create scene" onClick={addScene}>+</button></div>
              <div className="scene-dropdown">{project.scenes.map((item) => {
                const isExpanded = expandedSceneIds.has(item.id)
                const isActive = item.id === scene.id
                return (
                  <div className="scene-group" key={item.id}>
                    <div className="scene-row">
                      {/* Switch through commit so the command timeline agrees on the active
                          scene; setting React state alone is overwritten by the next edit. */}
                      <button className={isActive ? 'scene-tab active' : 'scene-tab'}
                              title={isActive ? 'Currently editing' : `Switch to editing ${item.name}`}
                              onClick={() => { if (!isActive) { commit('Select scene', selectEditorScene(project, item.id).project); setSelectedId(null) } }}>
                              {item.name}<span className="scene-count">[{item.objects.length}]</span>
                      </button>
                      <button className="scene-chevron"
                              title={isExpanded ? 'Collapse object list' : 'Expand object list'}
                              onClick={() => toggleSceneExpanded(item.id)}>
                              {isExpanded ? 'v' : '>'}
                      </button>
                    </div>
                    {/* The active scene gets the full hierarchy with indent/outdent controls;
                        other scenes list their objects for reference only. */}
                    {isExpanded && (isActive
                      ? <div className="tree-list">{scene.objects.length === 0 ? <div className="empty-state">Your scene is quiet.<br /><span>Place an asset to begin.</span></div> : buildSceneTree(scene.objects).map((row) => (
                          <div key={row.object.id} className={row.object.id === selectedId ? 'tree-item selected' : 'tree-item'} style={{ paddingLeft: row.depth * 16 }}>
                            <div className="tree-indent-controls">
                              <button className="tree-indent-btn" title="Outdent" disabled={row.object.parentId === undefined} onClick={() => outdentObject(row.object.id)}>⇤</button>
                              <button className="tree-indent-btn" title="Indent under previous sibling" disabled={previousSibling(scene.objects, row.object.id) === null} onClick={() => indentObject(row.object.id)}>⇥</button>
                            </div>
                            <button className="tree-item-select" onClick={() => setSelectedId(row.object.id)}>
                              <span className={`object-dot ${row.object.assetKind}`} />{row.object.name}<span className="tree-chevron">›</span>
                            </button>
                          </div>
                        ))}</div>
                      : <div className="tree-list">
                          {item.objects.length === 0
                            ? <div className="empty-state">Your scene is empty.<br /><span>Place an asset to begin.</span></div>
                            : item.objects.map((object) => <div key={object.id} className="tree-item reference-only" title="Switch to this room to select or edit">{object.name}</div>)}
                        </div>)}
                  </div>
                )
              })}</div>
            </div>
          )}
          {/* ── Scenes tab end ─────────────────────────────────────── */}

          {/* ── Assets tab ─────────────────────────────────────────── */}
          {LeftTabs === 'assets' && (
            <div className="rail-tab-panel">
              {/* The whole Library panel is the drop target, not just the card list, so the
                  hint can't shift the target out from under the pointer mid-drag. */}
              <section
                className={isDraggingAsset ? 'panel asset-library drag-over' : 'panel asset-library'}
                onDragEnter={(event) => {
                  if (!isFileDrag(event)) return
                  event.preventDefault()
                  assetDragDepthRef.current += 1
                  setIsDraggingAsset(true)
                }}
                onDragOver={(event) => {
                  if (!isFileDrag(event)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDragLeave={() => {
                  assetDragDepthRef.current = Math.max(0, assetDragDepthRef.current - 1)
                  if (assetDragDepthRef.current === 0) setIsDraggingAsset(false)
                }}
                onDrop={(event) => {
                  if (!isFileDrag(event)) return
                  event.preventDefault()
                  assetDragDepthRef.current = 0
                  setIsDraggingAsset(false)
                  // Routed by extension so one drop target serves both libraries: audio
                  // files go to importAudioFiles, everything else (glb/gltf/bin/textures)
                  // goes through the existing model importer unchanged.
                  const dropped = Array.from(event.dataTransfer.files)
                  const audioFiles = dropped.filter((file) => /\.(ogg|mp3|wav)$/i.test(file.name))
                  const modelFiles = dropped.filter((file) => !/\.(ogg|mp3|wav)$/i.test(file.name))
                  if (audioFiles.length > 0) {
                    const list = new DataTransfer()
                    audioFiles.forEach((file) => list.items.add(file))
                    void importAudioFiles(list.files)
                  }
                  if (modelFiles.length > 0) {
                    const list = new DataTransfer()
                    modelFiles.forEach((file) => list.items.add(file))
                    void importModelFiles(list.files)
                  }
                }}
              >
                <div className="panel-heading"><div><span className="eyebrow">Library</span><h2>Assets</h2></div><span className="count">{filterAssets(assetQuery, visibleAssets).length}/{visibleAssets.length}</span></div>
                <div className="asset-tools">
                  <input aria-label="Search assets" placeholder="Search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} />
                  <button className="button ghost" onClick={() => modelFileInputRef.current?.click()} title="Select one or more .glb files, or .gltf files together with their .bin/texture files">Import GLB / glTF</button>
                  <input
                    ref={modelFileInputRef}
                    className="hidden-file-input"
                    type="file"
                    multiple
                    accept=".glb,.gltf,.bin,image/*"
                    onChange={(event) => { void importModelFiles(event.target.files); event.target.value = '' }}
                  />
                  <button className="button ghost" onClick={() => audioFileInputRef.current?.click()} title="Select one or more .ogg, .mp3, or .wav files">Import Audio</button>
                  <input
                    ref={audioFileInputRef}
                    className="hidden-file-input"
                    type="file"
                    multiple
                    accept=".ogg,.mp3,.wav,audio/*"
                    onChange={(event) => { void importAudioFiles(event.target.files); event.target.value = '' }}
                  />
                </div>
                <div className="asset-list">
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
                {assetNotice && (
                  <div className={`asset-import-notice ${assetNotice.tone}`}>
                    {assetNotice.lines.map((line) => <div key={line}>{line}</div>)}
                    {assetNotice.optimised?.map((item) => (
                      <div key={item.asset.assetId} className="asset-optimised">
                        <span>Optimised {item.asset.label} for real-time: {item.summary}</span>
                        <button className="asset-keep-original" title="Use the file exactly as imported instead. Heavy models can make the editor and visitor view slow." onClick={() => void keepOriginalModel(item)}>Keep original</button>
                      </div>
                    ))}
                    <button className="asset-notice-close" title="Dismiss" onClick={() => setAssetNotice(null)}>×</button>
                  </div>
                )}
                {/* ── Audio sub-section: same panel, same drop target, its own search/list.
                    audioCatalogToken has no reader of its own — including it here is what
                    forces this section to re-render after an import/delete mutates
                    audioAssetCatalog in place (see userAudio.ts). */}
                <div className="panel-heading audio-heading" key={audioCatalogToken}>
                  <div><span className="eyebrow">Library</span><h2>Audio</h2></div>
                  <span className="count">{filterAudioAssets(assetQuery, audioAssetCatalog).length}/{audioAssetCatalog.length}</span>
                </div>
                <div className="asset-list">
                  {filterAudioAssets(assetQuery, audioAssetCatalog).map((asset) => {
                    const uses = countAudioAssetUses(project, asset.assetId)
                    return (
                      <div className="asset-card audio-card" key={asset.assetId} title={asset.detail}>
                        <span className="asset-preview audio"><span /></span>
                        <span className="asset-copy"><strong>{asset.label}</strong><small>{asset.detail}</small></span>
                        {isUserAudioAsset(asset.assetId) && (
                          <span
                            className={uses > 0 ? 'icon-button in-use' : 'icon-button'}
                            aria-disabled={uses > 0}
                            title={uses > 0 ? `In use by ${uses} rule action${uses === 1 ? '' : 's'} - remove ${uses === 1 ? 'it' : 'them'} to remove this audio` : 'Remove imported audio'}
                            onClick={() => void deleteUserAudio(asset)}
                          >×</span>
                        )}
                      </div>
                    )
                  })}
                  {filterAudioAssets(assetQuery, audioAssetCatalog).length === 0 && <div className="asset-empty">No audio matches this search.</div>}
                </div>
                {audioNotice && (
                  <div className={`asset-import-notice ${audioNotice.tone}`}>
                    {audioNotice.lines.map((line) => <div key={line}>{line}</div>)}
                    <button className="asset-notice-close" title="Dismiss" onClick={() => setAudioNotice(null)}>×</button>
                  </div>
                )}
                {/* Overlay rather than an inline block, so showing it never changes the layout. */}
                {isDraggingAsset && <div className="asset-drop-hint">Drop .glb/.gltf files (with their .bin/texture files) or .ogg/.mp3/.wav audio files to import them</div>}
              </section>
            </div>
          )}
          {/* ── Assets tab end ─────────────────────────────────────── */}

          {/* ── Interactions tab (empty) ─────────────────────── */}
          {LeftTabs === 'interactions' && (
            <div className="rail-tab-panel">
              <div className="rail-heading"><div><span className="eyebrow">Build</span><h2>Interactions</h2></div></div>
              <div className="empty-state">Nothing here yet.<br /><span>Interactions will appear in this tab.</span></div>
            </div>
          )}
          {/* ── Interactions tab end (empty) ─────────────────── */}
          
          <div className="rail-footer">
            <span className="status-dot" />
            {persistenceState}
            <small className="storage-note">Save location: browser localStorage</small>
            <button className="text-button" onClick={reset}>Reset draft</button>
          </div>
          <div className="rail-footer">
            <span className={`status-dot ${syncStatus}`} />
            {syncStatusLabel[syncStatus]}
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
              <button className={showStats ? 'mode active' : 'mode'} onClick={() => setShowStats((value) => !value)} title="Show or hide FPS and object count">Stats</button>
            </div>
            <div className="view-actions"><button className="button subtle" onClick={() => setResetToken((value) => value + 1)}>Reset view</button><button className="button subtle" onClick={captureStartView}>Set start view</button></div>
          </div>
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
            />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="top" label="TOP" />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="front" label="FRONT" />
            <ReferenceViewport objects={scene.objects} selectedId={selectedId} environmentId={scene.environmentId} axis="right" label="RIGHT" />
          </div>
          <div className="stage-footer">{cameraMode === 'walk' ? <><span><kbd>Drag</kbd> look around</span><span><kbd>WASD</kbd> walk</span><span><kbd>Click</kbd> select</span></> : <><span><kbd>Click</kbd> select</span><span><kbd>Drag</kbd> move / gizmo handle</span><span><kbd>Esc</kbd> clear selection</span></>}</div>
        </section>
        <aside className="right-rail">
          <section className="panel inspector-panel"><div className="panel-heading"><div><span className="eyebrow">Properties</span><h2>Inspector</h2></div>{selected && <span className="selection-badge">Selected</span>}</div>{selected ? <Inspector object={selected} sceneObjects={scene.objects} onRename={renameSelected} onTransform={updateSelected} onDuplicate={duplicateSelected} onDelete={deleteSelected} onVisibleChange={setSelectedVisible} onEnabledChange={setSelectedEnabled} onReparent={(parentId) => reparentObjectTo(selected.id, parentId)} onAssetIdChange={setSelectedAssetId} onAddClickRule={addSelectedClickRule} rules={(project.rules ?? []).filter((rule) => rule.objectId === selected.id)} onRemoveRule={removeRuleById} /> : <div className="inspector-empty"><div className="crosshair">＋</div><p>Select an object in the scene</p><span>Its transform will appear here.</span></div>}</section>
        </aside>
      </div>
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
