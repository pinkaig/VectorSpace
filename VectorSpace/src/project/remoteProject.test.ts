import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncSuccess, type QueuedChange } from '../../packages/sync/src/index'
import { isRemoteProject, loadRemoteProject, ServerSyncTransport } from './remoteProject'
import { defaultProject, type ProjectData } from './model'
import { serializeProject } from './serializer'

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })
const token = async () => 'dev|teacher'
const API = 'http://api'

afterEach(() => vi.unstubAllGlobals())

const change = (project: ProjectData): QueuedChange<ProjectData> => ({
  id: `${project.id}-1`, op: 'update', revision: 1, payload: project, idempotencyKey: 'k', retries: 0,
})

describe('loadRemoteProject', () => {
  it('opens a project with no saves as a clean project at revision 0, carrying the server id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { id: 'p-new', name: 'Fresh', current_version_id: null })))
    const { project, revision } = await loadRemoteProject(token, 'p-new', API)
    expect(revision).toBe(0)
    expect(project.id).toBe('p-new')
    expect(project.name).toBe('Fresh')
    expect(isRemoteProject('p-new')).toBe(true)
  })

  it('reads the current version and uses its scene and revision, under the project row\'s name', async () => {
    const saved = { ...defaultProject(), name: 'Saved scene' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(200, { id: 'p-saved', name: 'Row name', current_version_id: 'v3' }))
      .mockResolvedValueOnce(reply(200, { revision: 3, data: JSON.parse(serializeProject(saved)) }))
    vi.stubGlobal('fetch', fetchMock)
    const { project, revision } = await loadRemoteProject(token, 'p-saved', API)
    expect(fetchMock.mock.calls[1][0]).toBe('http://api/projects/p-saved/versions/v3')
    expect(revision).toBe(3)
    // the home page lists the row's name, so the editor shows the same one
    expect(project.name).toBe('Row name')
    expect(project.id).toBe('p-saved')
  })

  it('does not register a project the server refused', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(404, { detail: 'Project not found' })))
    await expect(loadRemoteProject(token, 'p-missing', API)).rejects.toMatchObject({ status: 404 })
    expect(isRemoteProject('p-missing')).toBe(false)
  })
})

describe('ServerSyncTransport', () => {
  const fallback = { send: vi.fn().mockResolvedValue(syncSuccess(1)) }

  const open = async (id: string) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { id, name: 'n', current_version_id: null })))
    await loadRemoteProject(token, id, API)
    vi.stubGlobal('fetch', vi.fn())
    return { ...defaultProject(), id }
  }

  it('leaves a project it did not load to the fallback, without calling the server', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const transport = new ServerSyncTransport(fallback, API)
    const local = { ...defaultProject(), id: 'local-only' }
    await transport.send(change(local))
    expect(fallback.send).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('saves against the revision it last knew, then moves on to the one the server returned', async () => {
    const project = await open('p-save')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(201, { revision: 1 }))
      .mockResolvedValueOnce(reply(201, { revision: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const transport = new ServerSyncTransport(fallback, API)
    expect(await transport.send(change(project))).toMatchObject({ success: true, newRevision: 1 })
    await transport.send(change(project))
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string).base_revision)
    expect(bodies).toEqual([0, 1])
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/projects/p-save/versions')
  })

  it('reports a 409 as a conflict carrying the server revision, not as a retry', async () => {
    const project = await open('p-conflict')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(409, { detail: { message: 'x', current_revision: 4 } })))
    const result = await new ServerSyncTransport(fallback, API).send(change(project))
    expect(result).toMatchObject({ success: false, conflictWith: 4 })
  })

  it('retries when offline or the server fails, but not when it refuses', async () => {
    const project = await open('p-fail')
    const transport = new ServerSyncTransport(fallback, API)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await transport.send(change(project))).toMatchObject({ success: false, retryable: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(503)))
    expect(await transport.send(change(project))).toMatchObject({ retryable: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(403, { detail: 'no' })))
    expect(await transport.send(change(project))).toMatchObject({ success: false, retryable: false })
  })
})
