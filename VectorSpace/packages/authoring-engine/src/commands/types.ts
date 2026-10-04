/**
 * @file        types.ts
 * @brief       The command contract every authoring edit is expected to satisfy.
 *
 * @responsibility
 * Defines a reversible, framework-free command shape and the result vocabulary
 * the command service reports back to the application.
 *
 * @inputs
 * Type parameters only; this module contains no executable policy.
 *
 * @outputs
 * Command, ProjectCommand, CommandStatus, CommandExecutionResult, and
 * TransformValidationError.
 *
 * @ownership
 * A command owns a single reversible state transition and its history label.
 * It must not own history storage, persistence, renderer state, or React state.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Authoring-Engine
 * Links point at the project wiki; migration is still in progress.
 */
import { ProjectData } from '@vthere/project'
import { ObjectOperationError } from '../objectAccess'

export interface Command<T> {
  /** History label recorded when the command commits. */
  readonly label: string
  /** Returns a new state with the command applied. Throws to reject the edit. */
  execute(project: T): T
  /** Returns a new state with the command reversed; the inverse of execute(). */
  undo(project: T): T
  /**
   * Optional constant-time fast path: true when execute() would change nothing.
   * The command service skips such commands so a no-op drag or a re-entered
   * value never reaches the history timeline.
   */
  isNoop?(project: T): boolean
}

export type ProjectCommand = Command<ProjectData>

export type CommandStatus = 'committed' | 'unchanged' | 'rejected'

export interface CommandExecutionResult {
  status: CommandStatus
  /** Present only when status is 'rejected'. */
  error?: Error
}

/**
 * Raised when a transform value is not something the project may store.
 * Extends ObjectOperationError so one catch at the application boundary covers
 * both an unresolvable object address and an unusable transform value.
 */
export class TransformValidationError extends ObjectOperationError {
  constructor(message: string) {
    super(message)
    this.name = 'TransformValidationError'
  }
}
