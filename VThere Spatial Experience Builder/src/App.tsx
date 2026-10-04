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
import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import {
  collectSubtreeIds,
  createCommandTimeline,
  executeCommand,
  removeRule,
} from '@vthere/authoring-engine'
import { createLogger } from '../packages/debugging/src/index'
import {
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
import {
  getProjectSyncStatus,
  stageProjectSync,
  subscribeProjectSync,
  type ProjectSyncStatus,
} from './sync/projectSync'
import { AssetDefinition, assetCatalog, countAssetUses, filterAssets } from './assets'
import { addUserAssets, isUserAsset, loadUserAssets, removeUserAsset, type OptimisedImport } from './userAssets'
import { audioAssetCatalog, countAudioAssetUses, filterAudioAssets, type AudioAssetDefinition } from './audioAssets'
import { addUserAudio, isUserAudioAsset, loadUserAudio, removeUserAudio, type AudioImportResult } from './userAudio'
import {
  createEditorObject,
  createEditorScene,
  duplicateEditorObject,
  moveEditorObjectCommand,
  removeEditorObject,
  renameEditorObject,
  reparentEditorObject,
  rotateEditorObjectAboutPivotCommand,
  rotateEditorObjectCommand,
  scaleEditorObjectCommand,
  selectEditorScene,
  setEditorObjectAssetId,
  setEditorObjectEnabled,
  setEditorObjectVisible,
  transformEditorObjectCommand,
  updateEditorScene,
  type EditorCommandBuilder,
} from './editor/editorOperations'
import { addEditorClickRule, type ClickRuleChoice } from './editor/ruleEditorOperations'
import { WhenDoRuleSection } from './inspector/WhenDoRuleSection'
import { buildSceneTree, grandparentId, previousSibling } from './editor/sceneTree'
import RuntimeView from '../apps/runtime/src/RuntimeApplication'
import Viewport, { CameraMode, GizmoMode, ViewportHandle } from './Viewport'
import ReferenceViewport from './ReferenceViewport'
import { applyDemoAudioScene, demoAudioAssets, demoAudioRules } from './demoAudioScene'
import { resolveLocalAudioUrl } from './viewport/audioResolution'
import { useStressTestKey } from './debug/stressTest' // STRESS TEST — comment out with the call below

const initialLoad = loadProjectWithSource()
const initialProject = initialLoad.project
const logger = createLogger('editor.commands')

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
  const [showStats, setShowStats] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  // Bumped when an edit is rejected, to pull the viewport's preview meshes back
  // to ProjectData. See runCommand.
  const [syncToken, setSyncToken] = useState(0)
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
  const [syncStatus, setSyncStatus] = useState<ProjectSyncStatus>(getProjectSyncStatus())
  const [viewMode, setViewMode] = useState<'editor' | 'runtime'>('editor')
  const [assetQuery, setAssetQuery] = useState('')
  const [LeftTabs, SetLeftTab] = useState<'scenes' | 'assets' | 'interactions'>('scenes') //for tabs on left column
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<string>>(() => new Set([initialProject.activeSceneId]))
  const [userAssets, setUserAssets] = useState<AssetDefinition[]>([])
  // Bumped whenever userAudio.ts's IndexedDB-backed catalog changes (load, import,
  // delete) — audioAssetCatalog is mutated in place (see userAudio.ts), so this just
  // forces the audio sub-list and rule-authoring dropdown to re-render against it.
  const [audioCatalogToken, setAudioCatalogToken] = useState(0)
  // Outcome of the last import. `info` is shown while an import is still running;
  // `optimised` lists imports that were shrunk to fit the real-time budget, each offering
  // to keep the original instead.
  const [assetNotice, setAssetNotice] = useState<{ tone: 'error' | 'success' | 'info'; lines: string[]; optimised?: OptimisedImport[] } | null>(null)
  const [audioNotice, setAudioNotice] = useState<{ tone: 'error' | 'success' | 'info'; lines: string[] } | null>(null)
  const [isDraggingAsset, setIsDraggingAsset] = useState(false)
  const assetDragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
  const selected = scene.objects.find((item) => item.id === selectedId) ?? null
  const visibleAssets = [...assetCatalog, ...userAssets]

  useEffect(() => {
    loadUserAssets()
      .then((assets) => {
        setUserAssets(assets)
        // Imported models only get a URL once registered here; any already-placed
        // instance skipped by an earlier sync needs the viewport to retry now.
        setSyncToken((value) => value + 1)
      })
      .catch((error) => setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not load imported assets'] }))
    loadUserAudio()
      .then(() => setAudioCatalogToken((value) => value + 1))
      .catch((error) => setAudioNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not load imported audio'] }))
  }, [])

  // A file dropped just outside the library would otherwise make the browser navigate
  // away to open it, discarding the editor. Only file drags are affected.
  useEffect(() => {
    const blockFileDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', blockFileDrop)
    window.addEventListener('drop', blockFileDrop)
    return () => {
      window.removeEventListener('dragover', blockFileDrop)
      window.removeEventListener('drop', blockFileDrop)
    }
  }, [])

  const importModelFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return
    try {
      // Any number of .glb files, and .gltf files with their .bin/texture files, in one go.
      // Names already in the library (built-in or imported) and repeat content are skipped.
      // Models over the real-time budget are optimised on import
      const { added, skipped, optimised, unoptimised } = await addUserAssets(
        Array.from(files),
        visibleAssets.map((asset) => asset.label),
        assetCatalog.flatMap((asset) => (asset.modelUrl ? [{ label: asset.label, url: asset.modelUrl }] : [])),
        (message) => setAssetNotice({ tone: 'info', lines: [message] }),
      )
      if (added.length > 0) setUserAssets((prev) => [...prev, ...added])
      const lines = [
        ...(added.length > 0 ? [`Added ${added.map((asset) => asset.label).join(', ')}`] : []),
        ...unoptimised.map((item) => `Imported ${item.fileName} as-is, over the real-time budget: ${item.reason}`),
        ...skipped.map((item) => `Skipped ${item.fileName}: ${item.reason}`),
      ]
      setAssetNotice({ tone: skipped.length > 0 || unoptimised.length > 0 ? 'error' : 'success', lines, optimised })
    } catch (error) {
      setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not import these files'] })
    }
  }
  // Replaces an optimised import with its original files. Only offered in the import
  // notice: the original is held in memory until then, not stored alongside.
  const keepOriginalModel = async (item: OptimisedImport) => {
    try {
      const original = await item.keepOriginal()
      setUserAssets((prev) => prev.map((asset) => (asset.assetId === original.assetId ? original : asset)))
      setSyncToken((value) => value + 1)
      setAssetNotice((notice) => notice && {
        ...notice,
        lines: [...notice.lines, `Kept the original ${original.label}`],
        optimised: notice.optimised?.filter((entry) => entry !== item),
      })
    } catch (error) {
      setAssetNotice({ tone: 'error', lines: [error instanceof Error ? error.message : `Could not restore the original ${item.asset.label}`] })
    }
  }
  const isFileDrag = (event: ReactDragEvent) => event.dataTransfer.types.includes('Files')
  const deleteUserAsset = async (asset: AssetDefinition) => {
    // Removing an asset that placed objects still use would leave them with no model
    // ("Asset unavailable"), so it is refused until those objects are deleted.
    const uses = countAssetUses(project, asset.assetId)
    if (uses > 0) {
      setAssetNotice({ tone: 'error', lines: [`Can't remove ${asset.label}: ${uses} object${uses === 1 ? '' : 's'} in the project use${uses === 1 ? 's' : ''} it. Delete ${uses === 1 ? 'that object' : 'those objects'} first.`] })
      return
    }
    await removeUserAsset(asset.assetId)
    setUserAssets((prev) => prev.filter((item) => item.assetId !== asset.assetId))
  }

  /**
   * Imports every .ogg/.mp3/.wav in `files` (selected via the Import Audio button or
   * dropped into the Assets panel). addUserAudio() does the real work — existing-name
   * and duplicate-content checks (mirroring importModelFiles' guards for models) plus
   * a playability check (actually decoding the bytes with the Web Audio API) that has
   * no model equivalent, since a GLB either parses or it doesn't at load time, while a
   * corrupt or mislabelled audio file would otherwise sit in the library looking fine
   * until a rule tries to play it. Accepted clips are stored in IndexedDB so they
   * survive a reload; audioAssetCatalog is mutated in place by addUserAudio, so bumping
   * audioCatalogToken is enough to make the dropdown and this panel pick them up.
   */
  const importAudioFiles = async (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return
    try {
      const { added, skipped } = await addUserAudio(
        Array.from(files),
        audioAssetCatalog.map((asset) => asset.label),
        audioAssetCatalog.filter((asset) => !isUserAudioAsset(asset.assetId)).map((asset) => ({ label: asset.label, url: asset.url })),
      )
      if (added.length > 0) setAudioCatalogToken((value) => value + 1)
      const lines = [
        ...(added.length > 0 ? [`Added ${added.map((asset) => asset.label).join(', ')}`] : []),
        ...skipped.map((item) => `Skipped ${item.fileName}: ${item.reason}`),
      ]
      setAudioNotice({ tone: skipped.length > 0 ? 'error' : 'success', lines })
    } catch (error) {
      setAudioNotice({ tone: 'error', lines: [error instanceof Error ? error.message : 'Could not import these audio files'] })
    }
  }
  const deleteUserAudio = async (asset: AudioAssetDefinition) => {
    // Same reasoning as deleteUserAsset: removing a sound a rule still plays would
    // leave that rule with nothing to play, so it's refused until the rule is removed.
    const uses = countAudioAssetUses(project, asset.assetId)
    if (uses > 0) {
      setAudioNotice({ tone: 'error', lines: [`Can't remove ${asset.label}: ${uses} rule action${uses === 1 ? '' : 's'} still play${uses === 1 ? 's' : ''} it. Remove that interaction first.`] })
      return
    }
    await removeUserAudio(asset.assetId)
    setAudioCatalogToken((value) => value + 1)
  }

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
  /**
   * The single entry point for transform edits. The command service owns whether
   * an edit reaches history; this only reflects the outcome into React.
   *
   * A rejected edit leaves ProjectData untouched, so the viewport's render
   * signature would not change and the previewed mesh would stay at the invalid
   * pose. Bumping syncToken forces the viewport to rebuild from ProjectData.
   * An 'unchanged' result needs no resync: the mesh is already correct.
   */
  const runCommand = (build: EditorCommandBuilder) => {
    const result = executeCommand(timelineRef.current, build)
    if (result.status === 'committed') setProject(timelineRef.current.current)
    if (result.status === 'rejected') {
      logger.warn('Transform rejected; no history entry was created', { error: result.error })
      setSyncToken((value) => value + 1)
    }
    return result
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
  const addObject = (asset: AssetDefinition) => {
    const result = createEditorObject(project, scene.id, asset.kind, asset.assetId)
    commit('Create object', result.project)
    setSelectedId(result.objectId ?? null)
  }
  const updateSelected = (changes: Partial<SceneObject['transform']>) => {
    if (!selected) return
    const builder = transformEditorObjectCommand(scene.id, selected.id, changes)
    if (builder) runCommand(builder)
  }
  const moveObject = (id: string, position: [number, number, number]) => {
    runCommand(moveEditorObjectCommand(scene.id, id, position))
  }
  const scaleObject = (id: string, scale: [number, number, number]) => {
    runCommand(scaleEditorObjectCommand(scene.id, id, scale))
  }
  const rotateObject = (id: string, rotation: [number, number, number], position?: [number, number, number]) => {
    runCommand(position
      ? rotateEditorObjectAboutPivotCommand(scene.id, id, rotation, position)
      : rotateEditorObjectCommand(scene.id, id, rotation))
  }
  const renameSelected = (name: string) => {
    if (!selected) return
    commit('Rename object', renameEditorObject(project, scene.id, selected.id, name).project)
  }
  const setSelectedAssetId = (assetId: string) => {
    if (!selected) return
    commit('Change asset ID', setEditorObjectAssetId(project, scene.id, selected.id, assetId).project)
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
  const reparentObjectTo = (objectId: string, parentId: string | null) => {
    commit('Reparent object', reparentEditorObject(project, scene.id, objectId, parentId).project)
  }
  const indentObject = (objectId: string) => {
    const target = previousSibling(scene.objects, objectId)
    if (target) reparentObjectTo(objectId, target.id)
  }
  const outdentObject = (objectId: string) => {
    const object = scene.objects.find((item) => item.id === objectId)
    if (object?.parentId === undefined) return
    reparentObjectTo(objectId, grandparentId(scene.objects, objectId))
  }
  const setSelectedVisible = (value: boolean) => {
    if (!selected) return
    commit('Set object visibility', setEditorObjectVisible(project, scene.id, selected.id, value).project)
  }

  // adds a "when clicked" rule with the chosen action to the selected object as one undoable step
  const addSelectedClickRule = (choice: ClickRuleChoice) => {
    if (!selected) return
    commit('Add interaction rule', addEditorClickRule(project, scene.id, selected.id, choice).project)
  }

  // removes one interaction rule by its id as one undoable step
  const removeRuleById = (ruleId: string) => {
    commit('Remove interaction rule', removeRule(project, { ruleId }).project)
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
  /**
   * Dual write: Tier 1 (serializer.ts's localStorage save) happens synchronously
   * first so a reload never loses an edit even if sync never completes; Tier 2
   * (packages/sync's queue) is then staged for background delivery. Save status
   * text reflects Tier 1; sync status is tracked separately via syncStatus.
   */
  const persist = (nextProject: ProjectData, label: string) => {
    const result = saveProject(nextProject)
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setSavedAt(result === 'failed' ? 'Save failed' : `${label} ${time}`)
    setPersistenceState(result === 'saved' ? 'Primary + backup ready' : 
      result === 'saved-with-backup' ? 'Backup copy only' : 'Export JSON now')
    if (result !== 'failed') stageProjectSync(nextProject)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => persist(project, 'Autosaved'), 750)
    return () => window.clearTimeout(timer)
  }, [project])
  useEffect(() => subscribeProjectSync(setSyncStatus), [])
  useStressTestKey(project, commit) // STRESS TEST — F8 spawns 100 pedestels
  const syncStatusLabel: Record<ProjectSyncStatus, string> = {
    idle: 'Synced',
    pending: 'Syncing to server…',
    conflict: 'Sync conflict; local edits kept',
    failed: 'Sync failed, will retry',
  }
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
  // True once the demo's rules are present in the project, so the button becomes a
  // no-op rather than appending a second copy (applyDemoAudioScene is additive and
  // has no de-dupe of its own — see demoAudioScene.test.ts's note on that).
  const isAudioDemoLoaded = demoAudioRules.every((rule) => project.rules?.some((existing) => existing.id === rule.id))
  /**
   * Appends the bundled audio demo (zones, SFX click targets, When-Do rules,
   * per-asset volume) into the active scene/project. Opt-in and additive — see
   * demoAudioScene.ts — rather than baked into defaultProject(), so it never
   * surprises unrelated work. Guarded to run once: the button disables itself
   * once loaded (isAudioDemoLoaded) instead of relying on the user not to
   * click twice.
   *
   * Before touching project state, every assetId the demo's rules/audioAssets
   * reference is checked against the bundled audio catalog (resolveLocalAudioUrl,
   * the same lookup playback uses) so a renamed or missing bundled file is caught
   * right here with a clear message, instead of surfacing later as a silent
   * no-op the first time a rule tries to play it.
   */
  const loadAudioDemo = () => {
    if (isAudioDemoLoaded) return
    const referencedAssetIds = new Set(demoAudioAssets.map((asset) => asset.assetId))
    const missing = [...referencedAssetIds].filter((assetId) => !resolveLocalAudioUrl(assetId))
    if (missing.length > 0) {
      setSavedAt('Audio demo not loaded')
      setPersistenceState(`Missing bundled audio for: ${missing.join(', ')} — check public/audio/ and audioAssets.ts`)
      return
    }
    const { project: nextProject, scene: nextScene } = applyDemoAudioScene(project, scene)
    const nextScenes = nextProject.scenes.map((item) => (item.id === nextScene.id ? nextScene : item))
    resetTimeline({ ...nextProject, scenes: nextScenes })
    setSavedAt('Loaded audio demo (zones, rules, SFX targets)')
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
