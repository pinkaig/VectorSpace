/**
 * @file        useProjectFile.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       Replacing the whole project: load a draft, import a file, reset, load the demo.
 *
 * @responsibility
 * Owns the four operations that swap the entire ProjectData (and so reset undo history)
 * and report the outcome through the save-status text.
 *
 * @inputs
 * The project and active scene, resetTimeline, setSelectedId, the two status setters
 * from useAutosave and the hidden file input's ref.
 *
 * @outputs
 * loadDraft, importFile, reset, isAudioDemoLoaded and loadAudioDemo.
 *
 * @boundary
 * Saving the current project (save) is in useAutosave and exporting it (downloadProject)
 * is called straight from the page; this hook only brings a project in.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import type { RefObject } from 'react'
import { ProjectData, SceneData, defaultProject } from '../../project/model'
import { importProjectFile, loadProjectWithSource } from '../../project/serializer'
import { applyDemoAudioScene, demoAudioAssets, demoAudioRules } from '../../content/demoAudioScene'
import { resolveLocalAudioUrl } from '../../content/audioResolution'

type ProjectFileInputs = {
  project: ProjectData
  scene: SceneData
  resetTimeline: (next: ProjectData) => void
  setSelectedId: (id: string | null) => void
  setSavedAt: (text: string) => void
  setPersistenceState: (text: string) => void
  fileInputRef: RefObject<HTMLInputElement | null>
}

export function useProjectFile({ project, scene, resetTimeline, setSelectedId, setSavedAt, setPersistenceState, fileInputRef }: ProjectFileInputs) {
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

  return { loadDraft, importFile, reset, isAudioDemoLoaded, loadAudioDemo }
}
