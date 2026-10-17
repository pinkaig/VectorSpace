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
import { collectSubtreeIds } from '@vectorspace/authoring-engine'
import { ProjectData, SceneObject, environmentLibrary } from '../project/model'
import { downloadProject, loadProjectWithSource, type ProjectLoadResult } from '../project/serializer'
import { assetCatalog, countAssetUses, filterAssets } from '../content/assets'
import { isUserAsset } from '../content/userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets } from '../content/audioAssets'
import { isUserAudioAsset } from '../content/userAudio'
import { selectEditorScene } from '../editor/editorOperations'
import { type ClickRuleChoice } from '../editor/ruleEditorOperations'
import { WhenDoRuleSection } from '../sections/objectPanel/WhenDoRuleSection'
import { buildSceneTree, previousSibling } from '../editor/sceneTree'
import RuntimeView from '../../apps/runtime/src/RuntimeApplication'
import Viewport, { ViewportHandle, viewportHintText, type ViewPreset, type WallCut } from '../viewport/Viewport'
import ReferenceViewport from '../viewport/ReferenceViewport'
import { overlayDims } from '../viewport/editing/overlayWidgets'
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
    indentObject, outdentObject, setSelectedVisible, addSelectedClickRule, removeRuleById,
    setSelectedEnabled, addScene,
  } = useSceneEditing({ project, scene, selected, setSelectedId, commit, runCommand, viewportRef })
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo } = useProjectFile({
    project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef,
  })

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

          {/* Top-right: view angles, left of the OctaOrb so they never cover it */}
          <div className="floating-controls top-right" style={{ right: octaOrbClearance }}>
            <div className="float-group">
              <span className="float-label">View</span>
              {VIEW_PRESETS.map(({ preset, label }) => (
                <button key={preset} className={activeViewPreset === preset ? 'float-button active' : 'float-button'} disabled={cameraMode !== 'orbit'} onClick={() => viewportRef.current?.setViewPreset(preset)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Bottom-left: environment and start view, right of the axis indicator */}
          <div className="floating-controls bottom-left" style={{ left: axisClearance }} ref={advancedMenuRef}>
            {advancedMenuOpen && (
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
            )}
            <div className="float-group">
              <label className="float-select"><span className="float-label">Room</span><select value={scene.environmentId} onChange={(event) => setEnvironment(event.target.value)}>{environmentLibrary.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
              <button className="float-button" onClick={() => setResetToken((value) => value + 1)} title="Go back to this scene's start view">Reset view</button>
              <button className="float-button" onClick={captureStartView} title="Use the current camera as this scene's start view">Set start view</button>
              <button className={advancedMenuOpen ? 'float-button active' : 'float-button'} onClick={() => setAdvancedMenuOpen((open) => !open)} title="Camera mode, layout and overlay settings">Advanced {advancedMenuOpen ? '▾' : '▴'}</button>
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
