import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMediaLink, checkUploadFile, playableChoices, reviewMediaLink, uploadMediaFile, type MediaEntry } from './media'

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

// stands in for the browser's XMLHttpRequest PUT to storage
class FakeUpload {
  static last: FakeUpload | undefined
  method = ''
  url = ''
  headers: Record<string, string> = {}
  status = 200
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {}
  onload?: () => void
  onerror?: () => void
  constructor() { FakeUpload.last = this }
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    this.onload?.()
  }
}

const entry = (overrides: Partial<MediaEntry>): MediaEntry => ({
  id: 'm', project_id: 'p', kind: 'image', source: 'file', label: 'a.png', status: 'uploaded', content_type: 'image/png', size_bytes: 1,
  provider: null, provider_id: null, url: null, approval: null, review_comment: null, created_at: '', ...overrides,
})

describe('checkUploadFile', () => {
  it('accepts allowed images and videos within their caps', () => {
    expect(checkUploadFile({ type: 'image/webp', size: 1000 })).toEqual({ kind: 'image' })
    expect(checkUploadFile({ type: 'video/mp4', size: 200_000_000 })).toEqual({ kind: 'video' })
  })

  it('refuses other types, SVG, empty and over-cap files before anything is sent', () => {
    for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'audio/mpeg', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: 10_000_001 }]) {
      expect(checkUploadFile(file)).toHaveProperty('error')
    }
  })
})

describe('uploadMediaFile', () => {
  it('asks for a URL, PUTs the file with its type and progress, then confirms', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ media_asset_id: 'm1', upload_url: 'https://store.test/put', storage_key: 'k' }, 201))
      .mockResolvedValueOnce(json(entry({ id: 'm1' })))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('XMLHttpRequest', FakeUpload)
    const progress: number[] = []
    const file = new File(['12345'], 'stone.png', { type: 'image/png' })

    const confirmed = await uploadMediaFile(async () => 't', 'p 1', file, (value) => progress.push(value), 'http://api')

    expect(fetchMock.mock.calls[0][0]).toBe('http://api/api/v1/projects/p%201/media')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: 'image', content_type: 'image/png', size_bytes: 5, filename: 'stone.png' })
    expect(FakeUpload.last).toMatchObject({ method: 'PUT', url: 'https://store.test/put', headers: { 'Content-Type': 'image/png' } })
    expect(progress).toEqual([0.5])
    expect(fetchMock.mock.calls[1][0]).toBe('http://api/api/v1/projects/p%201/media/m1/confirm')
    expect(confirmed.id).toBe('m1')
  })

  it('refuses a disallowed file without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(uploadMediaFile(async () => 't', 'p', new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }), undefined, 'http://api')).rejects.toThrow(/can be uploaded/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('links', () => {
  it('adds a link and reviews it with a comment', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(entry({ source: 'external' })))
    vi.stubGlobal('fetch', fetchMock)
    await addMediaLink(async () => 't', 'p', 'https://youtu.be/dQw4w9WgXcQ', 'http://api')
    await reviewMediaLink(async () => 't', 'p', 'l1', 'rejected', 'Too long', 'http://api')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(fetchMock.mock.calls[1][0]).toBe('http://api/api/v1/projects/p/media/links/l1')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ approval: 'rejected', comment: 'Too long' })
  })

  it('offers only uploaded files and approved links to the card editor', () => {
    const choices = playableChoices([
      entry({ id: 'ok-file' }),
      entry({ id: 'pending-file', status: 'pending' }),
      entry({ id: 'ok-link', source: 'external', kind: 'video', approval: 'approved', label: 'YouTube video x' }),
      entry({ id: 'waiting-link', source: 'external', kind: 'video', approval: 'pending' }),
      entry({ id: 'sent-back', source: 'external', kind: 'video', approval: 'rejected' }),
    ])
    expect(choices.map((choice) => choice.assetId)).toEqual(['ok-file', 'ok-link'])
  })
})
