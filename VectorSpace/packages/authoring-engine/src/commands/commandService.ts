/**
 * @file        commandService.ts
 * @brief       The single entry point that turns an authoring command into history.
 *
 * @responsibility
 * Builds a command against live timeline state, rejects unusable edits without
 * recording history, skips edits that would change nothing, and commits exactly
 * one labelled snapshot for every accepted user action.
 *
 * @inputs
 * A CommandTimeline of ProjectData and a builder that produces a ProjectCommand
 * for a given project snapshot.
 *
 * @outputs
 * A CommandExecutionResult reporting committed, unchanged, or rejected, and a
 * mutated timeline in the committed case only.
 *
 * @ownership
 * Owns the decision of whether an edit reaches history. It does not own the
 * transform semantics (transformCommands.ts), the history storage itself
 * (createCommandTimeline), or any renderer or React state.
 *
 * @testing
 * Covered by commandService.test.ts for one-action-one-entry, rejection,
 * no-op suppression, and history branching.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import { ProjectData } from '@vectorspace/project'
import type { CommandTimeline } from '../index'
import { CommandExecutionResult, ProjectCommand } from './types'

export type ProjectCommandBuilder = (project: ProjectData) => ProjectCommand

const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

/**
 * Takes a builder rather than a finished command so the command's captured
 * before-value always comes from live timeline state. A caller holding a stale
 * project reference (a React closure, for example) therefore cannot record an
 * undo entry that restores the wrong snapshot.
 */
export const executeCommand = (
  timeline: CommandTimeline<ProjectData>,
  build: ProjectCommandBuilder,
): CommandExecutionResult => {
  const current = timeline.current

  let command: ProjectCommand
  try {
    command = build(current)
  } catch (error) {
    return { status: 'rejected', error: asError(error) }
  }

  // A drag that ends where it started, or a re-entered inspector value, is a
  // real user action with no state change. It must not consume a history slot.
  if (command.isNoop?.(current)) return { status: 'unchanged' }

  let next: ProjectData
  try {
    next = command.execute(current)
  } catch (error) {
    return { status: 'rejected', error: asError(error) }
  }

  timeline.commit(command.label, next)
  return { status: 'committed' }
}
