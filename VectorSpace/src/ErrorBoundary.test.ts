import { describe, expect, it } from 'vitest'
import { ApiError } from './api/client'
import { crashState } from './crashState'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  it('turns a thrown Error into its message', () => {
    expect(crashState(new Error('bad scene')).message).toBe('bad scene')
  })

  it('turns a server error into a sentence with the request id', () => {
    const error = new ApiError(500, 'boom', { requestId: 'abc123' })
    expect(crashState(error).message).toContain('request abc123')
  })

  it('never shows an empty message for an odd thrown value', () => {
    expect(crashState(undefined).message).toBe('Something went wrong. Please try again.')
  })

  it('is wired as a real error boundary', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('x')).message).toBe('x')
  })
})
