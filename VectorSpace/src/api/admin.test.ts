import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_SCHOOLS, createAdminApi } from './admin'

afterEach(() => vi.unstubAllGlobals())

const reply = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

const api = () => createAdminApi(async () => 'token', 'http://api')

describe('admin api', () => {
  it('asks for the picked school and turns the reply into the shape the pages use', async () => {
    const fetchMock = reply([
      {
        id: 'a1', school_id: 'org-1', name: 'Aisyah Rahman', email: 'aisyah@demo.test',
        role: 'student', class_names: ['1A Science', 'Art Club'], last_active: null, status: 'invited',
      },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const accounts = await api().listAccounts('org-1')

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/admin/accounts?school=org-1')
    expect(accounts[0]).toEqual({
      id: 'a1', schoolId: 'org-1', name: 'Aisyah Rahman', email: 'aisyah@demo.test',
      role: 'student', classNames: ['1A Science', 'Art Club'], lastActive: null, status: 'invited',
    })
  })

  it('sends All schools through as the filter the API understands', async () => {
    const fetchMock = reply({ tiles: {}, schools: [], attention: [], recent: [] })
    vi.stubGlobal('fetch', fetchMock)
    await api().getOverview(ALL_SCHOOLS)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/admin/overview?school=all')
  })

  it('renames the overview fields the pages read, and leaves the tiles alone', async () => {
    vi.stubGlobal('fetch', reply({
      tiles: { students: { value: 24, sub: '2 active this week' } },
      schools: [{ id: 'org-1', name: 'Demo School', students: 24, educators: 3, status: 'active' }],
      attention: [{ id: 'n1', text: '6 people have never signed in', action_label: 'See who', go_to: 'accounts' }],
      recent: [{ id: 'p1', title: 'Ancient Rome', where: 'Demo School · 1A Science', published_at: '2026-10-01T00:00:00Z' }],
    }))

    const overview = await api().getOverview('org-1')

    expect(overview.tiles.students).toEqual({ value: 24, sub: '2 active this week' })
    expect(overview.attention[0]).toEqual({
      id: 'n1', text: '6 people have never signed in', actionLabel: 'See who', goTo: 'accounts',
    })
    expect(overview.recent[0].publishedAt).toBe('2026-10-01T00:00:00Z')
  })

  it('turning an account off patches active to false, because off is not a column', async () => {
    const fetchMock = reply({
      id: 'a1', school_id: 'org-1', name: 'X', email: 'x@y.test', role: 'student',
      class_names: [], last_active: null, status: 'turned_off',
    })
    vi.stubGlobal('fetch', fetchMock)

    const account = await api().setAccountOff('a1', true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/admin/accounts/a1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ active: false })
    expect(account.status).toBe('turned_off')
  })

  it('adds an account with the database\'s own field names', async () => {
    const fetchMock = reply({
      id: 'a2', school_id: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher',
      class_names: ['1A Science'], last_active: null, status: 'invited',
    }, 201)
    vi.stubGlobal('fetch', fetchMock)

    await api().addAccount({
      schoolId: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher', classNames: ['1A Science'],
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      school_id: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher', class_names: ['1A Science'],
    })
  })

  it('passes the API\'s reason for refusing to add a school straight through', async () => {
    vi.stubGlobal('fetch', reply({ detail: 'Adding a school needs a VThere operator role' }, 501))
    await expect(api().addSchool('New School')).rejects.toThrow(/operator role/)
  })

  it('still answers permissions and rooms from memory, because no table holds them', async () => {
    // no fetch stub on purpose: these must not reach the network
    const admin = api()
    const rows = await admin.getPermissions('org-1')
    expect(rows.length).toBeGreaterThan(0)

    await admin.savePermissions('org-1', rows.map((row) => ({ ...row, students: true })))
    expect((await admin.getPermissions('org-1')).every((row) => row.students)).toBe(true)

    const rooms = await admin.getRooms('org-1')
    expect(rooms.packs.find((pack) => pack.id === 'museum-basics')?.locked).toBe(true)
  })
})
