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

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/admin/accounts?school=org-1')
    expect(accounts[0]).toEqual({
      id: 'a1', schoolId: 'org-1', name: 'Aisyah Rahman', email: 'aisyah@demo.test',
      role: 'student', classNames: ['1A Science', 'Art Club'], lastActive: null, status: 'invited',
    })
  })

  it('sends All schools through as the filter the API understands', async () => {
    const fetchMock = reply({ tiles: {}, schools: [], attention: [], recent: [] })
    vi.stubGlobal('fetch', fetchMock)
    await api().getOverview(ALL_SCHOOLS)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/admin/overview?school=all')
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
    expect(url).toBe('http://api/api/v1/admin/accounts/a1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ active: false })
    expect(account.status).toBe('turned_off')
  })

  it('asks for a new sign-in link and hands back only the link', async () => {
    const fetchMock = reply({ account_id: 'a1', invite_link: 'https://tenant.test/again/a1' })
    vi.stubGlobal('fetch', fetchMock)

    const link = await api().newSignInLink('a1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/api/v1/admin/accounts/a1/invite')
    expect(init.method).toBe('POST')
    expect(link).toBe('https://tenant.test/again/a1')
  })

  it('passes a turned-off account 409 through to the popup', async () => {
    vi.stubGlobal('fetch', reply({ detail: 'X is turned off. Turn it on first.' }, 409))
    await expect(api().newSignInLink('a1')).rejects.toMatchObject({ status: 409 })
  })

  it('adds an account with the database\'s own field names, and keeps the invite link', async () => {
    const fetchMock = reply({
      id: 'a2', school_id: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher',
      class_names: ['1A Science'], last_active: null, status: 'invited',
      invite_link: 'https://tenant.test/invite/abc',
    }, 201)
    vi.stubGlobal('fetch', fetchMock)

    const created = await api().addAccount({
      schoolId: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher', classNames: ['1A Science'],
    })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      school_id: 'org-1', name: 'New Person', email: 'new@demo.test', role: 'teacher', class_names: ['1A Science'],
    })
    // the one-time password link rides along with the create reply and nowhere else
    expect(created.inviteLink).toBe('https://tenant.test/invite/abc')
    expect(created.status).toBe('invited')
  })

  it('reports no invite link as null, because the local login has no tenant to mint one', async () => {
    vi.stubGlobal('fetch', reply({
      id: 'a3', school_id: 'org-1', name: 'Dev Person', email: 'dev@demo.test', role: 'student',
      class_names: [], last_active: null, status: 'invited', invite_link: null,
    }, 201))

    const created = await api().addAccount({
      schoolId: 'org-1', name: 'Dev Person', email: 'dev@demo.test', role: 'student', classNames: [],
    })

    expect(created.inviteLink).toBeNull()
  })

  it('passes the API\'s reason for refusing a duplicate address straight through', async () => {
    vi.stubGlobal('fetch', reply({ detail: 'aisyah@demo.test already belongs to Aisyah Rahman (student)' }, 409))
    await expect(api().addAccount({
      schoolId: 'org-1', name: 'Someone Else', email: 'aisyah@demo.test', role: 'teacher', classNames: [],
    })).rejects.toThrow(/already belongs to Aisyah Rahman/)
  })

  it('sends the new school\'s name and returns the school the API made', async () => {
    const fetchMock = reply({ id: 'org-9', name: 'New School', students: 0, educators: 0, status: 'setting_up' }, 201)
    vi.stubGlobal('fetch', fetchMock)
    const made = await api().addSchool('New School')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'New School' })
    expect(made).toEqual({ id: 'org-9', name: 'New School', students: 0, educators: 0, status: 'setting_up' })
  })

  it('passes the API\'s reason for refusing a duplicate school straight through', async () => {
    vi.stubGlobal('fetch', reply({ detail: 'A school called New School already exists' }, 409))
    await expect(api().addSchool('New School')).rejects.toThrow(/already exists/)
  })

  it('reads one school permission settings from the API', async () => {
    const fetchMock = reply([
      { key: 'from-templates', group: 'Projects and data', label: 'Set up projects from templates', students: false, educators: true, can_adjust: false, enforced: true },
    ])
    vi.stubGlobal('fetch', fetchMock)
    const rows = await api().getPermissions('org-1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/admin/schools/org-1/permissions')
    expect(rows).toEqual([
      { key: 'from-templates', group: 'Projects and data', label: 'Set up projects from templates', students: false, educators: true, canAdjust: false, enforced: true },
    ])
  })

  it('saves only the switches and answers what the API kept', async () => {
    const kept = { key: 'public-links', group: 'Sharing', label: 'Public links', students: true, educators: true, can_adjust: true, enforced: false }
    const fetchMock = reply([kept])
    vi.stubGlobal('fetch', fetchMock)
    const rows = await api().savePermissions('org-1', [
      { key: 'public-links', group: 'Sharing', label: 'Public links', students: true, educators: true, canAdjust: true, enforced: false },
    ])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/api/v1/admin/schools/org-1/permissions')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual([{ key: 'public-links', students: true, educators: true, can_adjust: true }])
    expect(rows[0].canAdjust).toBe(true)
  })

  it('reads asset packs from the API and keeps room shells in memory', async () => {
    const fetchMock = reply([{ id: 'p1', slug: 'fossils', title: 'Fossils', description: null, kind: 'objects', item_count: 6, revision: 1, enabled: true }])
    vi.stubGlobal('fetch', fetchMock)
    const rooms = await api().getRooms('org-1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/admin/schools/org-1/packs')
    expect(rooms.packs).toEqual([{ id: 'p1', name: 'Fossils', description: '', enabled: true, itemCount: 6 }])
    expect(rooms.environments.length).toBeGreaterThan(0)
  })

  it('saves a pack switch to the API, but an environment switch only in memory', async () => {
    const fetchMock = reply({})
    vi.stubGlobal('fetch', fetchMock)
    await api().setRoomEnabled('org-1', 'pack', 'p1', false)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/admin/schools/org-1/packs/p1')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ enabled: false })

    await api().setRoomEnabled('org-1', 'environment', 'classroom', false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
