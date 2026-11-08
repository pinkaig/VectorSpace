import { describeError } from './api/client'

export interface CrashState {
  message: string | null
}

/** The state to show after something threw; kept out of ErrorBoundary.tsx so it can be tested without a DOM. */
export const crashState = (error: unknown): CrashState => ({ message: describeError(error) })
