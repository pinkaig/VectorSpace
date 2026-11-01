/**
 * @file        ProjectEditorPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-18
 * @brief       /editor/:projectId: fetches the project from the API, then hands it to the editor.
 *
 * @responsibility
 * Shows loading, not-found, not-allowed and no-server states; once the project arrives,
 * renders the editor with it as its starting project.
 *
 * @boundary
 * Knows nothing about editing. The editor is lazy-loaded through apps/editor, as /editor is.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, apiUrl } from '../api/client'
import { loadRemoteProject } from '../project/remoteProject'
import type { ProjectLoadResult } from '../project/serializer'
import { useSession } from '../session/session'

const EditorApplication = lazy(() => import('../../apps/editor/src/EditorApplication'))

type State = { kind: 'loading' } | { kind: 'ready'; start: ProjectLoadResult } | { kind: 'problem'; text: string }

const describe = (error: unknown): string =>
  error instanceof ApiError && error.status === 404 ? 'Project not found.'
  : error instanceof ApiError && error.status === 403 ? 'You cannot open this project.'
  : error instanceof ApiError && error.status === 401 ? 'Please sign in again.'
  : `Could not open the project: ${error instanceof Error ? error.message : 'unknown error'}`

export default function ProjectEditorPage() {
  const { projectId } = useParams()
  const { getToken } = useSession()
  const [state, setState] = useState<State>({ kind: 'loading' })
  // getToken changes when an admin switches role; reloading then would throw away open edits
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  useEffect(() => {
    if (!apiUrl || !projectId) return
    let current = true
    setState({ kind: 'loading' })
    loadRemoteProject((() => getTokenRef.current()), projectId).then(
      ({ project, status, sharing }) => current && setState({ kind: 'ready', start: { project, source: 'server', status, sharing } }),
      (error: unknown) => current && setState({ kind: 'problem', text: describe(error) }),
    )
    return () => { current = false }
  }, [projectId])

  if (!apiUrl) return <p role="alert">Opening a project by id needs the server: set VITE_API_URL. <Link to="/editor">Open the local editor</Link></p>
  if (state.kind === 'loading') return <p>Opening project…</p>
  if (state.kind === 'problem') return <p role="alert">{state.text}</p>
  // keyed by project so moving between ids starts a fresh editor
  return <Suspense fallback={<p>Loading editor…</p>}><EditorApplication key={state.start.project.id} start={state.start} /></Suspense>
}
