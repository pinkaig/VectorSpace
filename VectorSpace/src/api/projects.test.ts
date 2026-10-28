import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProject, listMyProjects, sendToClass, sendToStudent } from './projects'

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

  it('sends to every student in the class who has no copy yet', async () => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/classes/c1/members'))
        return json([
          { id: 'tan', role: 'teacher' },
          { id: 'aisyah', role: 'student' },
          { id: 'ethan', role: 'student' },
          { id: 'chloe', role: 'student' },
        ])
      if (url.includes('/projects?'))
        return json([
          { id: 'p1', name: 'Volcano museum', created_by_id: 'tan' }, // the teacher's own
          { id: 'p2', name: 'Volcano museum (2)', created_by_id: 'aisyah' }, // already sent
          { id: 'p3', name: 'Volcano museum trip', created_by_id: 'ethan' }, // a different project
        ])
      if (url.endsWith('/projects/p1/assign')) return json({ id: 'copy' }, 201)
      return json({ detail: 'unexpected' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendToClass(async () => 't', 'p1', 'Volcano museum', 'c1', 'http://api')
    expect(result).toEqual({ sent: 2, alreadyHad: 1, failed: 0 })
    const sentTo = fetchMock.mock.calls
      .filter(([url]) => url.endsWith('/assign'))
      .map(([, init]) => JSON.parse(init?.body as string).student_id)
    expect(sentTo.sort()).toEqual(['chloe', 'ethan'])
  })
})
