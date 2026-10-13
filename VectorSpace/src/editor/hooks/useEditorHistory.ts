/**
 * @file        useEditorHistory.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       The editor's project value and its undo/redo timeline.
 *
 * @responsibility
 * Holds the current ProjectData, the command timeline behind undo/redo, and the only
 * functions that change either: commit, runCommand, resetTimeline, undo, redo.
 *
 * @inputs
 * The project loaded when the page mounted, and a bumpSync callback.
 *
 * @outputs
 * project, timelineRef and the five mutators.
 *
 * @boundary
 * Every change to the project goes through commit or resetTimeline, which call
 * setProject. EditorPage reads timelineRef.current.canUndo during render and relies on
 * that: a mutator that skipped setProject would leave the Undo button stale.
 * No useCallback/useMemo: handlers are re-created each render, as they were in EditorPage.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useRef, useState } from 'react'
import { createCommandTimeline, executeCommand } from '@vectorspace/authoring-engine'
import { createLogger } from '../../../packages/debugging/src/index'
import type { ProjectData } from '../../project/model'
import type { EditorCommandBuilder } from '../editorOperations'

const logger = createLogger('editor.commands')

export function useEditorHistory(initialProject: ProjectData, bumpSync: () => void) {
  const [project, setProject] = useState<ProjectData>(initialProject)
  const timelineRef = useRef(createCommandTimeline(initialProject, (state) => JSON.parse(JSON.stringify(state)) as ProjectData))

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
      bumpSync()
    }
    return result
  }
  const resetTimeline = (next: ProjectData) => {
    timelineRef.current = createCommandTimeline(next, (state) => JSON.parse(JSON.stringify(state)) as ProjectData)
    setProject(timelineRef.current.current)
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

  return { project, timelineRef, commit, runCommand, resetTimeline, undo, redo }
}
