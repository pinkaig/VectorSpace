import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProject, listMyProjects, sendToStudent } from './projects'

afterEach(() => vi.unstubAllGlobals())

describe('projects api', () => {
  it('lists only my projects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await listMyProjects(async () => 't', 'http://api')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/projects?kind=project&mine=true')
  })

  it('creates from a template by sending its id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"p1"}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await createProject(async () => 't', 'My museum', 'tpl-1', 'http://api')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/projects')
    expect(JSON.parse(init.body)).toEqual({ name: 'My museum', template_id: 'tpl-1' })
  })

  it('sends a copy to a student by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"p2"}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendToStudent(async () => 't', 'p1', 'aisyah', 'http://api')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/projects/p1/assign')
    expect(JSON.parse(init.body)).toEqual({ student_id: 'aisyah' })
  })
})
