/**
 * @file        ErrorBoundary.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-08
 * @brief       Last-resort screen for a page that crashes while drawing.
 *
 * @responsibility
 * Without this, one thrown error in any page blanks the whole app. The boundary
 * catches it, shows a plain sentence (through describeError, so a request id is
 * quoted for server errors) and a "Try again" button that redraws the page.
 *
 * @members
 * - ErrorBoundary: the class component App wraps around the router.
 *
 * @documentation
 * Rubric H4 (errors shown as sentences). Errors from requests are handled where
 * they happen; this only catches what nobody else did.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { crashState, type CrashState } from './crashState'

export class ErrorBoundary extends Component<{ children: ReactNode }, CrashState> {
  state: CrashState = { message: null }

  static getDerivedStateFromError(error: unknown): CrashState {
    return crashState(error)
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Kept in the browser console so it can be quoted in a bug report.
    console.error('Page crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.message === null) return this.props.children
    return (
      <div role="alert" style={{ padding: '2rem', maxWidth: '40rem', margin: '0 auto' }}>
        <h1>Something went wrong</h1>
        <p>{this.state.message}</p>
        <button type="button" onClick={() => this.setState({ message: null })}>
          Try again
        </button>
      </div>
    )
  }
}
